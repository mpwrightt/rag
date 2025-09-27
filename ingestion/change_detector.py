"""
Change detection utilities for incremental RAG updates (Phase 2).

Provides fast hashing, content diffing, change summarization, and
severity classification to guide update strategies.
"""

from __future__ import annotations

import hashlib
import difflib
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any, Literal

try:
    # Local import for chunk mapping (optional; used by map_changes_to_chunks)
    from .chunker import DocumentChunk
except Exception:  # pragma: no cover - optional when running standalone
    @dataclass
    class DocumentChunk:  # minimal stub
        content: str
        index: int
        start_char: int
        end_char: int
        metadata: Dict[str, Any]


UpdateStrategy = Literal["metadata", "minor", "major", "structural"]


@dataclass
class ChangeHunk:
    """Represents a contiguous change between old and new content."""
    op: Literal["insert", "delete", "replace"]
    old_line_range: Tuple[int, int]  # inclusive start, exclusive end (lines)
    new_line_range: Tuple[int, int]
    old_char_range: Tuple[int, int]
    new_char_range: Tuple[int, int]


@dataclass
class ChangeReport:
    """Aggregated change information for two content versions."""
    has_changes: bool
    old_hash: str
    new_hash: str
    similarity: float
    total_old_lines: int
    total_new_lines: int
    added_lines: int
    deleted_lines: int
    replaced_lines: int
    hunks: List[ChangeHunk]
    signals: Dict[str, Any]


class ContentChangeDetector:
    """Detects content changes and classifies update severity.

    Fast path for no-changes: hash comparison.
    Slow path: line-based diff using difflib.SequenceMatcher opcodes.
    """

    def __init__(self, header_pattern: str = r"^\s*#{1,6}\s+", code_fence_pattern: str = r"^\s*```"):
        self.header_re = re.compile(header_pattern)
        self.code_fence_re = re.compile(code_fence_pattern)

    def calculate_content_hash(self, content: str) -> str:
        """Return a stable SHA256 over normalized content (LF newlines, strip trailing ws)."""
        if content is None:
            content = ""
        normalized = "\n".join(line.rstrip() for line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n"))
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def detect_changes(self, old_content: str, new_content: str) -> ChangeReport:
        # Normalize and split lines
        old = (old_content or "").replace("\r\n", "\n").replace("\r", "\n")
        new = (new_content or "").replace("\r\n", "\n").replace("\r", "\n")
        old_lines = old.split("\n")
        new_lines = new.split("\n")

        old_hash = self.calculate_content_hash(old)
        new_hash = self.calculate_content_hash(new)

        if old_hash == new_hash:
            return ChangeReport(
                has_changes=False,
                old_hash=old_hash,
                new_hash=new_hash,
                similarity=1.0,
                total_old_lines=len(old_lines),
                total_new_lines=len(new_lines),
                added_lines=0,
                deleted_lines=0,
                replaced_lines=0,
                hunks=[],
                signals={"headers_changed": 0, "code_fences_changed": 0},
            )

        # Compute opcodes
        sm = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=True)
        opcodes = sm.get_opcodes()
        similarity = sm.ratio()  # 0..1

        # Precompute char offsets per line for both texts
        old_offsets = _line_start_offsets(old_lines)
        new_offsets = _line_start_offsets(new_lines)

        added_lines = deleted_lines = replaced_lines = 0
        hunks: List[ChangeHunk] = []

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                continue
            if tag == "insert":
                added_lines += (j2 - j1)
            elif tag == "delete":
                deleted_lines += (i2 - i1)
            elif tag == "replace":
                replaced_lines += max(i2 - i1, j2 - j1)

            old_char_range = (old_offsets[i1], old_offsets[i2] if i2 < len(old_offsets) else len("\n".join(old_lines)))
            new_char_range = (new_offsets[j1], new_offsets[j2] if j2 < len(new_offsets) else len("\n".join(new_lines)))

            hunks.append(ChangeHunk(
                op=tag if tag in ("insert", "delete", "replace") else "replace",
                old_line_range=(i1, i2),
                new_line_range=(j1, j2),
                old_char_range=old_char_range,
                new_char_range=new_char_range,
            ))

        # Structural signals
        headers_changed, code_fences_changed = self._count_structural_changes(old_lines, new_lines, opcodes)

        return ChangeReport(
            has_changes=True,
            old_hash=old_hash,
            new_hash=new_hash,
            similarity=float(similarity),
            total_old_lines=len(old_lines),
            total_new_lines=len(new_lines),
            added_lines=added_lines,
            deleted_lines=deleted_lines,
            replaced_lines=replaced_lines,
            hunks=hunks,
            signals={
                "headers_changed": headers_changed,
                "code_fences_changed": code_fences_changed,
            },
        )

    def classify_change_severity(self, changes: ChangeReport) -> UpdateStrategy:
        """Classify changes into a recommended update strategy."""
        if not changes.has_changes:
            return "metadata"

        total_lines = max(changes.total_new_lines, changes.total_old_lines, 1)
        changed_lines = changes.added_lines + changes.deleted_lines + changes.replaced_lines
        pct = changed_lines / total_lines
        similarity = changes.similarity

        structural_signal = (changes.signals.get("headers_changed", 0) + changes.signals.get("code_fences_changed", 0))

        # Heuristics
        if similarity >= 0.985 and changed_lines <= max(3, int(0.01 * total_lines)) and structural_signal == 0:
            return "minor"
        if similarity >= 0.9 and pct <= 0.3 and structural_signal <= 3:
            return "major"
        return "structural"

    def map_changes_to_chunks(self, new_content: str, changes: ChangeReport, chunks: List[DocumentChunk]) -> List[int]:
        """Return indices of chunks whose character ranges overlap changed regions in new_content.

        Assumes chunk positions refer to the NEW content if you pass the new chunks.
        """
        if not changes.has_changes or not chunks:
            return []
        changed_spans = [h.new_char_range for h in changes.hunks]
        affected: List[int] = []
        for ch in chunks:
            for (s, e) in changed_spans:
                if _overlap((s, e), (ch.start_char, ch.end_char)):
                    affected.append(ch.index)
                    break
        return sorted(set(affected))

    def _count_structural_changes(self, old_lines: List[str], new_lines: List[str], opcodes) -> Tuple[int, int]:
        headers_changed = 0
        code_fences_changed = 0
        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                continue
            # Examine only changed ranges
            for ln in old_lines[i1:i2]:
                if self.header_re.search(ln):
                    headers_changed += 1
                if self.code_fence_re.search(ln):
                    code_fences_changed += 1
            for ln in new_lines[j1:j2]:
                if self.header_re.search(ln):
                    headers_changed += 1
                if self.code_fence_re.search(ln):
                    code_fences_changed += 1
        return headers_changed, code_fences_changed


def _line_start_offsets(lines: List[str]) -> List[int]:
    """Return char start offsets for each line index in a text rebased with '\n'.
    The returned list has len(lines)+1 entries to safely index end positions.
    """
    offsets = [0]
    total = 0
    for ln in lines:
        total += len(ln) + 1  # +1 for newline
        offsets.append(total)
    return offsets


def _overlap(a: Tuple[int, int], b: Tuple[int, int]) -> bool:
    as_, ae = a
    bs, be = b
    return not (ae <= bs or be <= as_)
