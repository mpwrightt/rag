"""
Proposal example analyzer: extracts section structure, style profile, and a style prompt
from an example proposal's plaintext/markdown.
"""
from __future__ import annotations

import re
from typing import Dict, Any, List, Tuple

# Basic English stopwords to avoid pulling filler as phrase bank
_STOP = set(
    """
    a an and are as at be by for from has he in is it its of on that the to was were will with this those these you your our we us their they i me my or if then else not no yes so also may can shall should could would about above below between into over under more most less few many much very via per which who whom whose when where why how due than across against within without among because while before after during since unless until each any some such include includes included including etc et al
    """.split()
)


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
        "sections": sections,            # list of {title, content}
        "readability": metrics,          # metrics dict
        "phrase_bank": phrases,          # top frequent content words
        "style_prompt": style_prompt,    # human-readable style guidance
    }
