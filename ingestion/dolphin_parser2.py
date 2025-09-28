"""
Dolphin document parser integration for enhanced document structure extraction.

This module provides a wrapper around the ByteDance Dolphin multimodal document parser
to extract structured content from complex documents containing text, tables, formulas, and figures.
"""

import os
import logging
import json
import tempfile
import shutil
import glob
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


class DolphinParser:
    """Wrapper for ByteDance Dolphin document parser."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        device: str = "auto",
        max_batch_size: int = 8,
        enable_caching: bool = True,
    ):
        """
        Initialize the Dolphin parser.

        Args:
            model_path: Path to Dolphin model. If None, downloads from HuggingFace
            device: Device to run on ('cpu', 'cuda', 'auto')
            max_batch_size: Maximum batch size for processing
            enable_caching: Whether to cache processed results
        """
        self.model_path = model_path or os.getenv("DOLPHIN_MODEL_PATH", "./hf_model")
        self.device = device
        self.max_batch_size = max_batch_size
        self.enable_caching = enable_caching

        # Model components (lazy loaded)
        self._model = None
        self._processor = None
        self._tokenizer = None

        # Cache for processed documents
        self._cache = {} if enable_caching else None

        # Configuration
        self.config = {
            "parsing_mode": os.getenv("DOLPHIN_PARSING_MODE", "page"),  # 'page' or 'element'
            "output_format": os.getenv("DOLPHIN_OUTPUT_FORMAT", "markdown"),  # 'markdown' or 'json'
            "preserve_layout": True,
            "extract_tables": True,
            "extract_formulas": True,
            "extract_figures": True,
            "confidence_threshold": float(os.getenv("DOLPHIN_CONFIDENCE_THRESHOLD", "0.7")),
        }

    def _load_model(self):
        """Lazy load the Dolphin model components."""
        if self._model is not None:
            return

        try:
            from transformers import VisionEncoderDecoderModel, AutoTokenizer, AutoProcessor
            import torch

            logger.info(f"Loading Dolphin model from {self.model_path}")

            # Load model components
            self._model = VisionEncoderDecoderModel.from_pretrained(
                self.model_path,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            )
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            self._processor = AutoProcessor.from_pretrained(self.model_path)

            # Move to appropriate device
            if self.device == "auto":
                self.device = "cuda" if torch.cuda.is_available() else "cpu"

            self._model.to(self.device)
            self._model.eval()

            logger.info(f"Dolphin model loaded successfully on {self.device}")

        except ImportError as e:
            logger.error("Failed to import required packages for Dolphin: %s", e)
            logger.error("Please install: pip install transformers torch torchvision")
            raise
        except Exception as e:
            logger.error("Failed to load Dolphin model: %s", e)
            raise

    def _get_cache_key(self, file_path: str) -> Optional[str]:
        """Generate cache key for a file."""
        if not self.enable_caching:
            return None
        file_stat = os.stat(file_path)
        return f"{file_path}_{file_stat.st_mtime}_{file_stat.st_size}"

    def _discover_poppler_path(self) -> Optional[str]:
        """Locate Poppler utilities (pdftoppm) on typical Linux/Nix paths.

        Returns directory containing pdftoppm, or None to rely on PATH.
        """
        # Respect explicit override
        env_path = os.getenv("POPPLER_PATH")
        if env_path:
            try:
                if os.path.isfile(env_path) and os.path.basename(env_path) == "pdftoppm":
                    return os.path.dirname(env_path)
                if os.path.isdir(env_path) and os.path.exists(os.path.join(env_path, "pdftoppm")):
                    return env_path
            except Exception:
                pass

        # Try PATH
        which = shutil.which("pdftoppm")
        if which:
            return os.path.dirname(which)

        # Probe common directories, including Nix store
        candidates: List[str] = [
            "/usr/bin",
            "/usr/local/bin",
        ]
        try:
            candidates += glob.glob("/nix/store/*-poppler-*/bin")
            candidates += glob.glob("/nix/store/*-poppler-utils-*/bin")
        except Exception:
            pass

        for c in candidates:
            try:
                if os.path.exists(os.path.join(c, "pdftoppm")):
                    return c
            except Exception:
                continue

        return None

    def _convert_pdf_to_images(self, pdf_path: str) -> List[str]:
        """Convert PDF pages to images for processing."""
        try:
            from pdf2image import convert_from_path
            from PIL import Image  # noqa: F401

            # Resolve Poppler
            poppler_path = self._discover_poppler_path()
            if not poppler_path:
                logger.warning("Poppler not explicitly found; relying on PATH for pdftoppm")

            # Convert PDF to images
            images = convert_from_path(
                pdf_path,
                dpi=200,  # Good balance of quality vs size
                fmt="PNG",
                poppler_path=poppler_path,
            )

            # Persist images in a temp dir that survives until process exit
            temp_dir = tempfile.mkdtemp(prefix="dolphin_pdf_")
            temp_images: List[str] = []
            for i, image in enumerate(images):
                temp_path = os.path.join(temp_dir, f"page_{i+1}.png")
                image.save(temp_path, "PNG")
                temp_images.append(temp_path)

            return temp_images

        except ImportError:
            logger.error("pdf2image not available. Install with: pip install pdf2image")
            raise
        except Exception as e:
            logger.error("Failed to convert PDF to images: %s", e)
            raise

    def _parse_with_dolphin(self, image_paths: List[str]) -> Dict[str, Any]:
        """Parse document images using Dolphin model."""
        self._load_model()

        try:
            from PIL import Image
            import torch

            results = {
                "pages": [],
                "metadata": {
                    "parser": "dolphin",
                    "timestamp": datetime.now().isoformat(),
                    "config": self.config,
                },
            }

            # Process images in batches
            for i in range(0, len(image_paths), self.max_batch_size):
                batch_paths = image_paths[i : i + self.max_batch_size]
                batch_images = [Image.open(path).convert("RGB") for path in batch_paths]

                # Process batch
                with torch.no_grad():
                    # Prepare inputs
                    inputs = self._processor(images=batch_images, return_tensors="pt").to(self.device)

                    # Generate outputs
                    outputs = self._model.generate(
                        **inputs,
                        max_length=2048,
                        num_beams=3,
                        do_sample=False,
                        pad_token_id=self._tokenizer.pad_token_id,
                        eos_token_id=self._tokenizer.eos_token_id,
                    )

                    # Decode results
                    for j, output in enumerate(outputs):
                        decoded = self._tokenizer.decode(output, skip_special_tokens=True)

                        page_result = {
                            "page_number": i + j + 1,
                            "content": decoded,
                            "image_path": batch_paths[j],
                        }

                        # Try to parse as structured JSON if possible
                        try:
                            structured_content = json.loads(decoded)
                            page_result["structured"] = structured_content
                        except json.JSONDecodeError:
                            # Treat as markdown/text content
                            page_result["markdown"] = decoded

                        results["pages"].append(page_result)

            return results

        except Exception as e:
            logger.error("Failed to parse with Dolphin: %s", e)
            raise

    def _combine_pages_to_markdown(self, dolphin_results: Dict[str, Any]) -> str:
        """Combine parsed pages into unified markdown."""
        markdown_parts: List[str] = []

        for page in dolphin_results.get("pages", []):
            page_num = page.get("page_number", 1)

            # Add page separator
            if page_num > 1:
                markdown_parts.append(f"\n\n---\n\n# Page {page_num}\n\n")

            # Get content
            if "structured" in page:
                # Convert structured content to markdown
                structured = page["structured"]
                markdown_parts.append(self._structured_to_markdown(structured))
            elif "markdown" in page:
                markdown_parts.append(page["markdown"])
            else:
                markdown_parts.append(page.get("content", ""))

        return "".join(markdown_parts)

    def _structured_to_markdown(self, structured: Dict[str, Any]) -> str:
        """Convert structured Dolphin output to markdown."""
        if isinstance(structured, dict):
            parts: List[str] = []

            # Handle different element types
            for element in structured.get("elements", []):
                element_type = element.get("type", "text")
                content = element.get("content", "")

                if element_type == "title":
                    parts.append(f"# {content}\n\n")
                elif element_type == "heading":
                    level = element.get("level", 2)
                    parts.append(f"{'#' * level} {content}\n\n")
                elif element_type == "paragraph":
                    parts.append(f"{content}\n\n")
                elif element_type == "table":
                    # Convert table structure to markdown
                    parts.append(self._table_to_markdown(element))
                elif element_type == "formula":
                    parts.append(f"$$\n{content}\n$$\n\n")
                elif element_type == "figure":
                    caption = element.get("caption", "")
                    parts.append(f"![{caption}](figure)\n\n")
                else:
                    parts.append(f"{content}\n\n")

            return "".join(parts)

        return str(structured)

    def _table_to_markdown(self, table_element: Dict[str, Any]) -> str:
        """Convert table element to markdown table."""
        rows = table_element.get("rows", [])
        if not rows:
            return ""

        markdown_table: List[str] = []

        # Header row
        if rows:
            header = rows[0]
            markdown_table.append("| " + " | ".join(str(cell) for cell in header) + " |")
            markdown_table.append("|" + "|".join([" --- "] * len(header)) + "|")

            # Data rows
            for row in rows[1:]:
                markdown_table.append("| " + " | ".join(str(cell) for cell in row) + " |")

        return "\n".join(markdown_table) + "\n\n"

    def parse_document(self, file_path: str) -> Tuple[str, Dict[str, Any]]:
        """
        Parse a document using Dolphin.

        Args:
            file_path: Path to the document file

        Returns:
            Tuple of (markdown_content, metadata)
        """
        # Check cache first
        cache_key = self._get_cache_key(file_path)
        if cache_key and self._cache is not None and cache_key in self._cache:
            logger.debug(f"Using cached result for {file_path}")
            return self._cache[cache_key]

        try:
            file_ext = Path(file_path).suffix.lower()

            if file_ext == ".pdf":
                # Convert PDF to images
                image_paths = self._convert_pdf_to_images(file_path)

                # Parse with Dolphin
                results = self._parse_with_dolphin(image_paths)

                # Convert to markdown
                markdown_content = self._combine_pages_to_markdown(results)

                metadata = {
                    "parser": "dolphin",
                    "original_path": file_path,
                    "pages_processed": len(results.get("pages", [])),
                    "config": self.config,
                    "timestamp": datetime.now().isoformat(),
                }

                # Cache result
                if cache_key and self._cache is not None:
                    self._cache[cache_key] = (markdown_content, metadata)

                return markdown_content, metadata

            else:
                raise ValueError(f"Unsupported file type for Dolphin: {file_ext}")

        except Exception as e:
            logger.error(f"Dolphin parsing failed for {file_path}: {e}")
            raise


# Global instance (lazy initialized)
_dolphin_parser: Optional[DolphinParser] = None


def get_dolphin_parser() -> DolphinParser:
    """Get the global Dolphin parser instance."""
    global _dolphin_parser
    if _dolphin_parser is None:
        _dolphin_parser = DolphinParser()
    return _dolphin_parser


def is_dolphin_available() -> bool:
    """Check if Dolphin dependencies are available."""
    try:
        import transformers  # noqa: F401
        import torch  # noqa: F401
        import pdf2image  # noqa: F401
        return True
    except ImportError:
        return False
