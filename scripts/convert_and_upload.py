#!/usr/bin/env python3
"""
Convert supported documents to Markdown locally, then upload the generated .md
file(s) to the backend /upload endpoint. This avoids server-side converter
variability and gives consistent ingestion results.

Usage examples:

  python3 scripts/convert_and_upload.py \
    --api https://datadiver.replit.app \
    "/Users/you/rag/docs/25-218 PHI.docx"

  python3 scripts/convert_and_upload.py \
    --api https://datadiver.replit.app \
    /Users/you/rag/docs/25-218\ DBR.pdf /Users/you/rag/docs/PHI\ Tags.xlsx

  # Convert and upload everything under docs/
  python3 scripts/convert_and_upload.py --api https://datadiver.replit.app /Users/you/rag/docs

Options:
  --api, -a           Backend API base URL (default: env API_BASE or NEXT_PUBLIC_API_BASE)
  --collection-id, -c Optional collection ID to associate with uploads (future use)
  --output, -o        Output directory for generated .md (default: system temp)
  --verbose, -v       Verbose logging

Supported extensions: .pdf .doc .docx .xls .xlsx .txt .md .markdown .csv .tsv .html .htm .pptx
"""

import argparse
import os
import sys
import pathlib
import tempfile
import json
import mimetypes
from typing import Iterable

import requests

# Ensure project import for the converter
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ingestion.converters import convert_to_markdown  # type: ignore

ALLOWED_EXTS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".md", ".markdown",
    ".csv", ".tsv", ".html", ".htm", ".pptx"
}


def iter_input_paths(inputs: Iterable[str]) -> Iterable[pathlib.Path]:
    for raw in inputs:
        p = pathlib.Path(raw)
        if p.is_dir():
            for sub in p.rglob("*"):
                if sub.is_file() and sub.suffix.lower() in ALLOWED_EXTS:
                    yield sub
        elif p.is_file():
            if p.suffix.lower() in ALLOWED_EXTS:
                yield p
        else:
            # Ignore non-existing paths
            continue


def convert_to_md_file(src: pathlib.Path, out_dir: pathlib.Path, verbose: bool = False) -> pathlib.Path:
    text, meta = convert_to_markdown(str(src))
    # Ensure text is a string
    text = text or ""
    # Write to mirrored relative path under out_dir
    rel = src.name  # keep flat; or use src.relative_to(root) in more advanced usage
    out = out_dir / pathlib.Path(rel).with_suffix(".md")
    out.parent.mkdir(parents=True, exist_ok=True)
    if verbose:
        print(f"[convert] {src} -> {out} (chars={len(text)})")
    with open(out, "w", encoding="utf-8") as f:
        # Add lightweight frontmatter with original path
        f.write(f"---\noriginal_path: {src}\n---\n\n")
        f.write(text)
    return out


def upload_file(api_base: str, md_path: pathlib.Path, verbose: bool = False) -> dict:
    url = api_base.rstrip("/") + "/upload"
    mime, _ = mimetypes.guess_type(str(md_path))
    mime = mime or "text/markdown"
    if verbose:
        print(f"[upload] POST {url} file={md_path} type={mime}")
    with open(md_path, "rb") as fh:
        files = {"file": (md_path.name, fh, mime)}
        resp = requests.post(url, files=files, headers={"Expect": ""})
    try:
        return resp.json()
    except Exception:
        return {"status": resp.status_code, "text": resp.text}


def main():
    parser = argparse.ArgumentParser(description="Convert to Markdown locally and upload to backend")
    parser.add_argument("paths", nargs="+", help="Files or directories to process")
    parser.add_argument("--api", "-a", default=os.getenv("API_BASE") or os.getenv("NEXT_PUBLIC_API_BASE"), help="Backend API base URL")
    parser.add_argument("--collection-id", "-c", default=None, help="Collection ID (reserved)")
    parser.add_argument("--output", "-o", default=None, help="Output directory for .md (default: temp dir)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    args = parser.parse_args()

    if not args.api:
        print("Error: --api is required (or set API_BASE / NEXT_PUBLIC_API_BASE)", file=sys.stderr)
        sys.exit(2)

    out_dir = pathlib.Path(args.output) if args.output else pathlib.Path(tempfile.mkdtemp(prefix="dd_md_"))
    if args.verbose:
        print(f"[info] Output dir: {out_dir}")

    converted = []
    for p in iter_input_paths(args.paths):
        try:
            md_path = convert_to_md_file(p, out_dir, verbose=args.verbose)
            converted.append(md_path)
        except Exception as e:
            print(f"[error] convert failed: {p}: {e}", file=sys.stderr)

    if not converted:
        print("No files converted.")
        return

    # Upload each converted file
    results = []
    for md in converted:
        res = upload_file(args.api, md, verbose=args.verbose)
        results.append({"file": md.name, "result": res})
        if args.verbose:
            print(json.dumps(results[-1], indent=2))

    print(json.dumps({
        "api": args.api,
        "output_dir": str(out_dir),
        "converted_count": len(converted),
        "results": results,
    }, indent=2))


if __name__ == "__main__":
    main()
