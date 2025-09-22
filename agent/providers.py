"""
Gemini provider configuration for LLM and embedding models.
"""

import asyncio
import logging
import os
from typing import List, Optional

import google.generativeai as genai
from dotenv import load_dotenv
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

load_dotenv()

logger = logging.getLogger(__name__)

_DEFAULT_LLM_MODEL = "gemini-2.5-flash"
_DEFAULT_EMBEDDING_MODEL = "text-embedding-004"
_GENAI_CONFIGURED = False


def _get_api_key() -> str:
    """Return the configured Gemini API key."""
    return os.getenv("GOOGLE_API_KEY") or os.getenv("LLM_API_KEY") or ""


def _ensure_genai_configured() -> None:
    """Configure the google.generativeai client once per process."""
    global _GENAI_CONFIGURED
    if _GENAI_CONFIGURED:
        return

    api_key = _get_api_key()
    if not api_key:
        raise ValueError("Set GOOGLE_API_KEY or LLM_API_KEY to use Gemini models.")

    genai.configure(api_key=api_key)
    _GENAI_CONFIGURED = True


def get_llm_model(model_choice: Optional[str] = None) -> GoogleModel:
    """
    Create a Pydantic AI GoogleModel configured for Gemini.

    Args:
        model_choice: Optional override of the model name.

    Returns:
        Configured GoogleModel instance.
    """
    llm_choice = model_choice or os.getenv("LLM_CHOICE", _DEFAULT_LLM_MODEL)
    provider = GoogleProvider(api_key=_get_api_key())
    return GoogleModel(llm_choice, provider=provider)


def get_embedding_model() -> str:
    """Return the embedding model identifier."""
    return os.getenv("EMBEDDING_MODEL", _DEFAULT_EMBEDDING_MODEL)


def get_ingestion_model() -> GoogleModel:
    """Return the Gemini model to use during ingestion tasks."""
    ingestion_choice = os.getenv("INGESTION_LLM_CHOICE")
    if not ingestion_choice:
        return get_llm_model()
    return get_llm_model(model_choice=ingestion_choice)


async def generate_embedding(text: str, model: Optional[str] = None) -> List[float]:
    """Generate a single embedding vector using Gemini."""
    embeddings = await generate_embeddings([text], model=model)
    return embeddings[0] if embeddings else []


async def generate_embeddings(texts: List[str], model: Optional[str] = None) -> List[List[float]]:
    """Generate embeddings for a batch of texts using Gemini."""
    if not texts:
        return []

    _ensure_genai_configured()
    model_name = model or get_embedding_model()

    def _embed_batch() -> List[List[float]]:
        results: List[List[float]] = []
        for text in texts:
            content = text or ""
            try:
                response = genai.embed_content(model=model_name, content=content)
                embedding = response.get("embedding") or []
                results.append(list(embedding))
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.error("Gemini embedding request failed: %s", exc)
                raise
        return results

    return await asyncio.to_thread(_embed_batch)


def get_llm_provider() -> str:
    """Return the current LLM provider identifier."""
    return "google"


def get_embedding_provider() -> str:
    """Return the current embedding provider identifier."""
    return "google"


def validate_configuration() -> bool:
    """Validate required Gemini configuration is present."""
    missing_vars = []
    if not _get_api_key():
        missing_vars.append("GOOGLE_API_KEY or LLM_API_KEY")

    for var in ("LLM_CHOICE", "EMBEDDING_MODEL"):
        if not os.getenv(var):
            missing_vars.append(var)

    if missing_vars:
        print(f"Missing required environment variables: {', '.join(missing_vars)}")
        return False
    return True


def get_model_info() -> dict:
    """Return diagnostic information about the current Gemini setup."""
    return {
        "llm_provider": get_llm_provider(),
        "llm_model": os.getenv("LLM_CHOICE", _DEFAULT_LLM_MODEL),
        "embedding_provider": get_embedding_provider(),
        "embedding_model": get_embedding_model(),
        "ingestion_model": os.getenv("INGESTION_LLM_CHOICE", "same as main"),
    }
