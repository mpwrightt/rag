"""
Proposal example analyzer: extracts section structure, style profile, and a style prompt
from an example proposal's plaintext/markdown.
"""
from __future__ import annotations

import re
from typing import Dict, Any, List, Tuple
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    fitz = None

# Basic English stopwords to avoid pulling filler as phrase bank
_STOP = set(
    """
    a an and are as at be by for from has he in is it its of on that the to was were will with this those these you your our we us their they i me my or if then else not no yes so also may can shall should could would about above below between into over under more most less few many much very via per which who whom whose when where why how due than across against within without among because while before after during since unless until each any some such include includes included including etc et al
    """.split()
)


def extract_text_or_markdown(file_path: str) -> str:
    """Convert the source file to plaintext/markdown for downstream analysis."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    if suffix == ".pdf" and fitz is not None:
        doc = fitz.open(file_path)
        text = []
        for page in doc:
            text.append(page.get_text("text"))
        doc.close()
        return "\n".join(text)
    # Fallback: rely on existing converter (if available)
    try:
        from ingestion.converters import convert_to_markdown  # type: ignore
        md_text, _ = convert_to_markdown(str(path))
        if md_text:
            return md_text
    except Exception:
        pass
    return path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""


def _split_headings(text: str) -> List[Dict[str, Any]]:
    """Extract a best-effort section outline based on common heading patterns.
    Supports:
      - Markdown headings: ^#{1,6}\s+Title
      - ALL CAPS lines with optional numbers: ^\d+\.\s+TITLE or TITLE
      - Title Case lines surrounded by blank lines
    Returns a list of sections: {title, start_index, end_index, content}
    """
    lines = text.splitlines()
    indices: List[Tuple[int, str]] = []
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        if re.match(r"^#{1,6}\s+.+", s):
            title = re.sub(r"^#{1,6}\s+", "", s).strip()
            indices.append((i, title))
            continue
        if re.match(r"^\d+\s*[\.)-]\s+.+", s) and s.upper() == s:
            indices.append((i, s))
            continue
        if (len(s.split()) <= 8 and s[:1].isupper() and s.endswith(":") == False and
                (i == 0 or not lines[i-1].strip()) and (i+1 < len(lines) and not lines[i+1].strip() == "")):
            # Short title-like line with surrounding whitespace
            indices.append((i, s))
            continue
    # Build sections with content ranges
    sections: List[Dict[str, Any]] = []
    if not indices:
        return sections
    indices.sort(key=lambda x: x[0])
    for idx, (start, title) in enumerate(indices):
        end = indices[idx + 1][0] if idx + 1 < len(indices) else len(lines)
        content = "\n".join(lines[start + 1:end]).strip()
        sections.append({
            "title": title.strip(),
            "start_index": start,
            "end_index": end,
            "content": content
        })
    return sections

def _extract_letter_structure(text: str, sections: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Identify cover-letter style blocks (recipient, RE, salutation, intro)."""
    lines = text.splitlines()
    if not lines:
        return {}

    first_heading_idx = sections[0]["start_index"] if sections else len(lines)

    def _strip(idx: int) -> str:
        return lines[idx].strip()

    idx_re = next((i for i, line in enumerate(lines) if line.strip().upper().startswith("RE:")), None)
    idx_dear = next((i for i, line in enumerate(lines) if line.strip().lower().startswith("dear ")), None)

    recipient_lines: List[str] = []
    if idx_re is not None:
        recipient_lines = [lines[i].strip() for i in range(idx_re) if lines[i].strip()]
    elif idx_dear is not None:
        recipient_lines = [lines[i].strip() for i in range(idx_dear) if lines[i].strip()]

    re_line = _strip(idx_re) if idx_re is not None else ""
    salutation = _strip(idx_dear) if idx_dear is not None else ""

    intro_start = (idx_dear + 1) if idx_dear is not None else ((idx_re + 1) if idx_re is not None else 0)
    intro_end = min(first_heading_idx, len(lines))

    # Skip leading blanks within intro
    while intro_start < intro_end and not lines[intro_start].strip():
        intro_start += 1

    intro_lines: List[str] = []
    for i in range(intro_start, intro_end):
        intro_lines.append(lines[i].rstrip())
    intro_text = "\n".join(intro_lines).strip()

    # Create a shorter preview sentence
    intro_preview = " ".join(intro_text.split())
    if len(intro_preview) > 240:
        intro_preview = intro_preview[:240].rstrip() + "…"

    structure: Dict[str, Any] = {}
    if recipient_lines:
        structure["recipient_lines"] = recipient_lines
    if re_line:
        structure["re_line"] = re_line
    if salutation:
        structure["salutation"] = salutation
    if intro_text:
        structure["intro_paragraph"] = intro_text
        structure["intro_preview"] = intro_preview
    if sections:
        structure["first_section_title"] = sections[0].get("title")
    return structure


def _build_section_outline(sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    outline: List[Dict[str, Any]] = []
    for sec in sections:
        content = sec.get("content") or ""
        preview_words = " ".join(content.split())
        preview = preview_words[:240].rstrip()
        if preview_words and len(preview_words) > len(preview):
            preview += "…"
        outline.append({
            "title": sec.get("title", ""),
            "preview": preview,
            "word_count": len(re.findall(r"[A-Za-z0-9']+", content)),
            "start_index": sec.get("start_index"),
        })
    return outline


def _extract_task_sections(text: str, sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identify Task-style sections (e.g., 'Task 1: Administrative and Planning')."""
    task_pattern = re.compile(r"^Task\s+(\d+[A-Za-z]?)\s*[:\-]\s*(.+)$", re.IGNORECASE)
    tasks: List[Dict[str, Any]] = []
    for sec in sections:
        title = sec.get("title") or ""
        m = task_pattern.match(title.strip())
        if not m:
            continue
        task_id = m.group(1)
        task_title = m.group(2).strip()
        content = sec.get("content") or ""
        preview = " ".join(content.split())
        if len(preview) > 200:
            preview = preview[:200].rstrip() + "…"
        tasks.append({
            "task_id": task_id,
            "title": task_title,
            "preview": preview,
            "word_count": len(re.findall(r"[A-Za-z0-9']+", content)),
        })
    return tasks


def _extract_aoc_actions(text: str) -> List[str]:
    """Capture detailed AOC action lines (e.g., "AOC-6 – ...") from the example."""
    actions: List[str] = []
    seen = set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.search(r"\bAOC\s*[-–]?\s*\d+", line, flags=re.IGNORECASE):
            snippet = " ".join(line.split())
            if snippet.lower() in seen:
                continue
            seen.add(snippet.lower())
            if len(snippet) > 500:
                snippet = snippet[:497].rstrip() + "…"
            actions.append(snippet)
    return actions


def _build_section_lookup(sections: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}
    for sec in sections:
        title = (sec.get("title") or "").strip()
        if not title:
            continue
        key = title.lower()
        lookup[key] = sec
    return lookup


def _readability(text: str) -> Dict[str, Any]:
    """Compute simple readability metrics without external deps."""
    words = re.findall(r"[A-Za-z']+", text)
    sents = re.split(r"(?<=[\.!?])\s+", text.strip()) if text.strip() else []
    word_count = len(words)
    sent_count = max(1, len([s for s in sents if s and re.search(r"[A-Za-z]", s)]))
    char_count = sum(len(w) for w in words)
    avg_words_per_sentence = word_count / sent_count if sent_count else 0
    avg_chars_per_word = (char_count / word_count) if word_count else 0
    # Rough Flesch-Kincaid grade proxy (not exact syllable-based)
    fk_grade_proxy = 0.39 * avg_words_per_sentence + 11.8 * (avg_chars_per_word / 4.7) - 15.59
    return {
        "word_count": word_count,
        "sentence_count": sent_count,
        "avg_words_per_sentence": round(avg_words_per_sentence, 2),
        "avg_chars_per_word": round(avg_chars_per_word, 2),
        "grade_level_proxy": round(fk_grade_proxy, 1),
    }


def _phrase_bank(text: str, top_n: int = 20) -> List[str]:
    tokens = [t.lower() for t in re.findall(r"[A-Za-z']+", text)]
    tokens = [t for t in tokens if t not in _STOP and len(t) >= 3]
    # count unigrams
    from collections import Counter
    c = Counter(tokens)
    return [w for w, _ in c.most_common(top_n)]


def analyze_example_text(text: str) -> Dict[str, Any]:
    """Analyze example proposal text and return structure + style hints."""
    text = text or ""
    sections = _split_headings(text)
    metrics = _readability(text)
    phrases = _phrase_bank(text)
    letter_structure = _extract_letter_structure(text, sections)
    section_outline = _build_section_outline(sections)
    task_sections = _extract_task_sections(text, sections)
    section_lookup = _build_section_lookup(sections)
    aoc_actions = _extract_aoc_actions(text)

    # Style prompt summarizing tone and format
    style_bits = [
        f"Target reading level ~ Grade {metrics['grade_level_proxy']} (proxy)",
        f"Average sentence length ~ {metrics['avg_words_per_sentence']} words",
        "Use clear declarative tone; minimize passive voice; maintain professional style.",
        "Use lists sparingly; prefer short paragraphs.",
    ]
    if sections:
        style_bits.append(f"Mirroring structure with ~{len(sections)} sections from example.")
    style_prompt = "\n- ".join(["Style Guide:"] + style_bits)

    return {
        "sections": sections,                # list of {title, content}
        "section_outline": section_outline,  # condensed outline with previews
        "section_lookup": section_lookup,    # quick title lookup
        "letter_structure": letter_structure,  # recipient, RE, salutation, intro preview
        "task_sections": task_sections,      # extracted Task blocks
        "aoc_actions": aoc_actions,          # example detailed AOC steps
        "readability": metrics,              # metrics dict
        "phrase_bank": phrases,              # top frequent content words
        "style_prompt": style_prompt,        # human-readable style guidance
    }
