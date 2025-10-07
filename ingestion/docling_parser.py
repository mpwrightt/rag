"""
Docling document parser integration for advanced document processing.
Provides multi-format support with excellent PDF understanding, table extraction,
and structure preservation.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)


def is_docling_available() -> bool:
    """Check if Docling is installed and available."""
    try:
        import docling  # noqa: F401
        return True
    except ImportError:
        return False


class DoclingParser:
    """
    Wrapper for Docling document converter.
    Handles PDF, DOCX, PPTX, XLSX, HTML, images, and more.
    """

    def __init__(self):
        """Initialize the Docling parser."""
        if not is_docling_available():
            raise RuntimeError(
                "Docling is not installed. Install with: pip install docling"
            )

        from docling.document_converter import DocumentConverter
        self.converter = DocumentConverter()
        logger.info("Docling parser initialized successfully")

    def parse_document(
        self,
        file_path: str,
        export_format: str = "markdown"
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Parse a document using Docling and return the content.

        Args:
            file_path: Path to the document file
            export_format: Output format ("markdown", "html", "json")

        Returns:
            Tuple of (content_string, metadata_dict)
        """
        try:
            path = Path(file_path)
            if not path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            logger.info(f"Parsing document with Docling: {path.name}")

            # Convert the document
            result = self.converter.convert(str(path))

            # Extract content based on format
            if export_format == "markdown":
                content = result.document.export_to_markdown()
            elif export_format == "html":
                content = result.document.export_to_html()
            elif export_format == "json":
                content = result.document.export_to_json()
            else:
                logger.warning(f"Unknown format {export_format}, defaulting to markdown")
                content = result.document.export_to_markdown()

            # Build metadata
            metadata = {
                "parser": "docling",
                "file_name": path.name,
                "file_size": path.stat().st_size,
                "export_format": export_format,
            }

            # Try to extract additional metadata from result if available
            if hasattr(result, 'metadata'):
                metadata.update(result.metadata)

            logger.info(
                f"Successfully parsed {path.name} with Docling "
                f"({len(content)} characters)"
            )

            return content, metadata

        except Exception as e:
            logger.error(f"Docling parsing failed for {file_path}: {e}")
            raise


def get_docling_parser() -> Optional[DoclingParser]:
    """
    Factory function to get a Docling parser instance.
    Returns None if Docling is not available.
    """
    try:
        return DoclingParser()
    except Exception as e:
        logger.warning(f"Could not initialize Docling parser: {e}")
        return None
