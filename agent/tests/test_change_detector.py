import time

import pytest

from ingestion.change_detector import ContentChangeDetector, ChangeReport


def test_no_changes_fast():
    det = ContentChangeDetector()
    text = """# Title\n\nSome content.\n\n- item 1\n- item 2\n"""
    t0 = time.perf_counter()
    report: ChangeReport = det.detect_changes(text, text)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert report.has_changes is False
    assert report.similarity == pytest.approx(1.0)
    # Should generally be very fast
    assert elapsed_ms < 50.0


def test_minor_edits_classification():
    det = ContentChangeDetector()
    old = """# Title\n\nAlpha line.\nBeta line.\nGamma line.\n"""
    new = """# Title\n\nAlpha line.\nBeta line UPDATED.\nGamma line.\n"""
    report = det.detect_changes(old, new)
    strat = det.classify_change_severity(report)
    assert report.has_changes is True
    assert strat in ("minor", "major")


def test_structural_change_detection():
    det = ContentChangeDetector()
    old = """# A\n\nBody\n"""
    new = """# A\n\n## B\n\nBody\n```code\nprint(1)\n```\n"""
    report = det.detect_changes(old, new)
    # Structural signals should have been picked up
    assert report.signals.get("headers_changed", 0) >= 1
    assert report.signals.get("code_fences_changed", 0) >= 1
