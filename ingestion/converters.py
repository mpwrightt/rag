"""
Utilities to convert various document types to Markdown for unified ingestion.
"""
from __future__ import annotations

import os
import io
import logging
from pathlib import Path
from typing import Tuple, Dict, Any

logger = logging.getLogger(__name__)

# Optional heavy deps imported lazily

def _read_text(path: str, encodings=("utf-8", "latin-1")) -> str:
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except Exception:
            continue
    # Last resort: binary read then decode ignoring errors
    try:
        with open(path, "rb") as f:
            return f.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""


def convert_to_markdown(file_path: str) -> Tuple[str, Dict[str, Any]]:
    """
    Convert a file to Markdown text.

    Returns: (markdown_text, metadata)
    """
    p = Path(file_path)
    ext = p.suffix.lower().strip(".")
    meta: Dict[str, Any] = {
        "original_path": str(p),
        "original_ext": ext,
    }

    try:
        if ext in {"md", "markdown", "txt"}:
            text = _read_text(str(p))
            return text, meta

        if ext == "pdf":
            # First attempt: pdfminer text extraction
            try:
                from pdfminer.high_level import extract_text
                text = extract_text(str(p)) or ""
                if text.strip():
                    return text, meta
                else:
                    logger.warning("PDF conversion via pdfminer returned empty text for %s", p.name)
            except Exception as e:
                logger.warning("PDF conversion failed via pdfminer: %s", e)

            # Optional OCR fallback if enabled
            if os.getenv("OCR_PDF", "0").lower() in {"1", "true", "yes", "on"}:
                try:
                    from pdf2image import convert_from_path
                    import pytesseract
                    from PIL import Image
                except Exception as e:
                    logger.warning("OCR requested but pdf2image/pytesseract/Pillow not available: %s", e)
                else:
                    try:
                        poppler_path = os.getenv("POPPLER_PATH") or None
                        # Convert up to first 20 pages to limit processing time
                        images = convert_from_path(str(p), dpi=300, fmt="jpeg", poppler_path=poppler_path)
                        ocr_pages = []
                        for idx, img in enumerate(images):
                            if idx >= 20:
                                break
                            if not isinstance(img, Image.Image):
                                img = img.convert("RGB")
                            txt = pytesseract.image_to_string(img)
                            if txt and txt.strip():
                                ocr_pages.append(txt)
                        if ocr_pages:
                            return "\n\n".join(ocr_pages), {**meta, "note": "ocr_fallback"}
                        else:
                            logger.warning("OCR produced no text for %s", p.name)
                    except Exception as e:
                        logger.warning("OCR fallback failed: %s", e)

            # Final fallback: try raw decode
            return _read_text(str(p)), {**meta, "warning": "pdf extraction failed; raw decode used"}

        if ext in {"docx"}:
            try:
                from docx import Document
                doc = Document(str(p))
                parts = []
                for para in doc.paragraphs:
                    parts.append(para.text)
                text = "\n\n".join(filter(None, parts))
                return text, meta
            except Exception as e:
                logger.warning("DOCX conversion failed: %s", e)
                return _read_text(str(p)), {**meta, "warning": "docx read failed"}

        if ext in {"pptx"}:
            try:
                from pptx import Presentation
                prs = Presentation(str(p))
                slides_text = []
                for s in prs.slides:
                    buf = []
                    for shape in s.shapes:
                        if hasattr(shape, "text"):
                            t = shape.text.strip()
                            if t:
                                buf.append(t)
                    if buf:
                        slides_text.append("\n".join(buf))
                return "\n\n---\n\n".join(slides_text), meta
            except Exception as e:
                logger.warning("PPTX conversion failed: %s", e)
                return _read_text(str(p)), {**meta, "warning": "pptx read failed"}

        if ext in {"html", "htm"}:
            try:
                from bs4 import BeautifulSoup
                from markdownify import markdownify as md
                html = _read_text(str(p))
                soup = BeautifulSoup(html, "html.parser")
                # Remove script/style
                for tag in soup(["script", "style"]):
                    tag.decompose()
                markdown = md(str(soup), heading_style="ATX")
                return markdown, meta
            except Exception as e:
                logger.warning("HTML conversion failed: %s", e)
                return _read_text(str(p)), {**meta, "warning": "html to md failed"}

        if ext in {"csv", "tsv"}:
            try:
                import csv
                delimiter = "," if ext == "csv" else "\t"
                out = io.StringIO()
                writer = out.write
                with open(str(p), newline="", encoding="utf-8") as f:
                    reader = csv.reader(f, delimiter=delimiter)
                    rows = list(reader)
                if rows:
                    # Simple Markdown table
                    header = rows[0]
                    writer("| " + " | ".join(header) + " |\n")
                    writer("|" + "|".join([" --- "] * len(header)) + "|\n")
                    for r in rows[1:]:
                        writer("| " + " | ".join(r) + " |\n")
                return out.getvalue(), meta
            except Exception as e:
                logger.warning("CSV/TSV conversion failed: %s", e)
                return _read_text(str(p)), {**meta, "warning": "csv/tsv to md failed"}

        if ext in {"xlsx", "xls"}:
            try:
                import pandas as pd
                xls = pd.ExcelFile(str(p))
                md_parts = []
                for sheet in xls.sheet_names:
                    df = xls.parse(sheet)
                    md_parts.append(f"\n\n## {sheet}\n\n")
                    md_parts.append(df.to_markdown(index=False))
                return "".join(md_parts), meta
            except Exception as e:
                logger.warning("Excel conversion via pandas failed: %s", e)
                # Fallback: openpyxl direct parsing (no pandas)
                try:
                    from openpyxl import load_workbook
                    wb = load_workbook(filename=str(p), data_only=True)
                    md_parts = []
                    for ws in wb.worksheets:
                        md_parts.append(f"\n\n## {ws.title}\n\n")
                        # Collect rows
                        rows = []
                        for row in ws.iter_rows(values_only=True):
                            rows.append(["" if v is None else str(v) for v in row])
                        if rows:
                            # Build simple Markdown table
                            headers = rows[0]
                            md_parts.append("| " + " | ".join(headers) + " |\n")
                            md_parts.append("|" + "|".join([" --- "] * len(headers)) + "|\n")
                            for r in rows[1:]:
                                md_parts.append("| " + " | ".join(r) + " |\n")
                    return "".join(md_parts), {**meta, "note": "excel parsed via openpyxl fallback"}
                except Exception as e2:
                    logger.warning("Excel conversion via openpyxl failed: %s", e2)
                    return _read_text(str(p)), {**meta, "warning": "excel to md failed"}

        # Images and others: best-effort (no OCR by default)
        if ext in {"png", "jpg", "jpeg", "gif", "webp", "svg"}:
            # Placeholder markdown with link
            return f"![{p.name}]({p.name})", {**meta, "note": "image placeholder; OCR not enabled"}

        # Default fallback: attempt text read
        return _read_text(str(p)), {**meta, "warning": "unknown extension; raw text read"}

    except Exception as e:
        logger.error("Failed to convert %s: %s", file_path, e)
        return "", {**meta, "error": str(e)}
