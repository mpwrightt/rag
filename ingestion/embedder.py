"""
Document embedding generation for vector search using Gemini embeddings.
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

try:
    from google.api_core import exceptions as google_exceptions  # type: ignore
except ImportError:  # pragma: no cover - optional dependency during testing
    google_exceptions = None

from .chunker import DocumentChunk

# Import provider helpers
try:
    from ..agent.providers import (
        generate_embedding as gemini_generate_embedding,
        generate_embeddings as gemini_generate_embeddings,
        get_embedding_model,
    )
except ImportError:  # pragma: no cover - direct execution fallback
    import sys

    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from agent.providers import (  # type: ignore
        generate_embedding as gemini_generate_embedding,
        generate_embeddings as gemini_generate_embeddings,
        get_embedding_model,
    )

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = get_embedding_model()


class EmbeddingGenerator:
    """Generates embeddings for document chunks using Gemini."""

    def __init__(
        self,
        model: str = EMBEDDING_MODEL,
        batch_size: int = 100,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """Initialize embedding generator."""
        self.model = model
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        # Model-specific configurations
        self.model_configs = {
            "text-embedding-004": {"dimensions": 768, "max_tokens": 8191},
            # Backwards compatibility with OpenAI-style identifiers if env overrides persist
            "text-embedding-3-small": {"dimensions": 1536, "max_tokens": 8191},
            "text-embedding-3-large": {"dimensions": 3072, "max_tokens": 8191},
            "text-embedding-ada-002": {"dimensions": 1536, "max_tokens": 8191},
        }

        if model not in self.model_configs:
            logger.warning("Unknown embedding model %s, using default configuration", model)
            self.config = {"dimensions": 768, "max_tokens": 8191}
        else:
            self.config = self.model_configs[model]

        # Allow environment override to keep storage schema consistent
        env_dim = os.getenv("VECTOR_DIMENSION")
        if env_dim:
            try:
                dim_val = int(env_dim)
                if dim_val > 0:
                    self.config["dimensions"] = dim_val
            except ValueError:
                logger.warning("Invalid VECTOR_DIMENSION value '%s'; using default", env_dim)

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate an embedding for a single text."""
        trimmed = self._truncate(text)
        for attempt in range(self.max_retries):
            try:
                return await gemini_generate_embedding(trimmed, model=self.model)
            except Exception as exc:  # pragma: no cover - defensive fallback
                if self._handle_retry(exc, attempt):
                    await asyncio.sleep(self._backoff_delay(attempt))
                    continue
                raise
        raise RuntimeError("Failed to generate embedding after retries")

    async def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a batch of texts."""
        processed_texts = [self._truncate(text or "") for text in texts]

        for attempt in range(self.max_retries):
            try:
                return await gemini_generate_embeddings(processed_texts, model=self.model)
            except Exception as exc:  # pragma: no cover - defensive fallback
                if self._handle_retry(exc, attempt):
                    await asyncio.sleep(self._backoff_delay(attempt))
                    continue
                if attempt == self.max_retries - 1:
                    return await self._process_individually(processed_texts)
                await asyncio.sleep(self.retry_delay)

        return await self._process_individually(processed_texts)

    async def _process_individually(self, texts: List[str]) -> List[List[float]]:
        """Fallback: embed items individually when batch fails."""
        results: List[List[float]] = []
        for text in texts:
            try:
                vector = await self.generate_embedding(text)
            except Exception as exc:  # pragma: no cover
                logger.error("Embedding failed for text chunk during fallback: %s", exc)
                vector = []
            results.append(vector)
        return results

    def _truncate(self, text: str) -> str:
        """Truncate text roughly to the supported token length."""
        if not text:
            return ""
        limit = self.config["max_tokens"] * 4
        return text if len(text) <= limit else text[:limit]

    def _handle_retry(self, exc: Exception, attempt: int) -> bool:
        """Inspect exception and decide whether to retry."""
        if google_exceptions and isinstance(exc, google_exceptions.ResourceExhausted):
            if attempt == self.max_retries - 1:
                raise
            logger.warning("Gemini rate limit hit; retrying in %.2fs", self._backoff_delay(attempt))
            return True
        if google_exceptions and isinstance(exc, google_exceptions.GoogleAPIError):
            if attempt == self.max_retries - 1:
                raise
            logger.warning("Gemini API error (%s); retrying in %.2fs", exc, self.retry_delay)
            return True
        logger.error("Unexpected embedding error: %s", exc)
        return False

    def _backoff_delay(self, attempt: int) -> float:
        """Return exponential backoff delay."""
        return self.retry_delay * (2 ** attempt)


# Factory function expected by ingestion.ingest
def create_embedder(model: Optional[str] = None, batch_size: int = 100, max_retries: int = 3, retry_delay: float = 1.0) -> EmbeddingGenerator:
    """Create and return an EmbeddingGenerator instance.

    Keeping a simple factory signature to preserve backwards compatibility with
    ingestion pipelines that import create_embedder().
    """
    return EmbeddingGenerator(
        model=model or EMBEDDING_MODEL,
        batch_size=batch_size,
        max_retries=max_retries,
        retry_delay=retry_delay,
    )


async def embed_document_chunks(
    chunks: List[DocumentChunk],
    embedding_generator: Optional[EmbeddingGenerator] = None,
) -> Tuple[List[DocumentChunk], Dict[str, Any]]:
    """Generate embeddings for provided document chunks."""
    if not chunks:
        return [], {"processed_chunks": 0, "failed_chunks": 0}

    generator = embedding_generator or EmbeddingGenerator()
    metrics = {
        "processed_chunks": 0,
        "failed_chunks": 0,
        "start_time": datetime.utcnow().isoformat(),
        "model": generator.model,
        "batch_size": generator.batch_size,
    }

    batch = []
    batch_indices = []

    for idx, chunk in enumerate(chunks):
        batch.append(chunk.content)
        batch_indices.append(idx)

        if len(batch) >= generator.batch_size:
            await _process_batch(batch, batch_indices, chunks, generator, metrics)
            batch, batch_indices = [], []

    if batch:
        await _process_batch(batch, batch_indices, chunks, generator, metrics)

    metrics["end_time"] = datetime.utcnow().isoformat()
    metrics["processed_chunks"] = len(chunks) - metrics["failed_chunks"]
    return chunks, metrics


async def _process_batch(
    batch: List[str],
    batch_indices: List[int],
    chunks: List[DocumentChunk],
    generator: EmbeddingGenerator,
    metrics: Dict[str, Any],
) -> None:
    """Helper to process a batch of embeddings."""
    try:
        embeddings = await generator.generate_embeddings_batch(batch)
    except Exception as exc:  # pragma: no cover
        logger.error("Batch embedding failed: %s", exc)
        metrics["failed_chunks"] += len(batch_indices)
        return

    for idx, embedding in zip(batch_indices, embeddings):
        try:
            chunks[idx].metadata["embedding_model"] = generator.model
            chunks[idx].metadata["embedding_dimension"] = generator.config["dimensions"]
            chunks[idx].embedding = embedding
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to attach embedding to chunk %s: %s", idx, exc)
            metrics["failed_chunks"] += 1


async def embed_texts(texts: List[str], model: Optional[str] = None) -> List[List[float]]:
    """Convenience helper to embed a list of texts."""
    generator = EmbeddingGenerator(model=model or EMBEDDING_MODEL)
    return await generator.generate_embeddings_batch(texts)
