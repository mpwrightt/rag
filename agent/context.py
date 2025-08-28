"""
Shared context for tracking search results across agent execution.
"""

from typing import List
from .models import ChunkResult

# Global context for tracking search results during agent execution
_current_search_results: List[ChunkResult] = []


def capture_search_results(results: List[ChunkResult]) -> List[ChunkResult]:
    """Capture search results for later use in creating sources."""
    global _current_search_results
    _current_search_results.extend(results)
    return results


def get_current_search_results() -> List[ChunkResult]:
    """Get the current search results."""
    return _current_search_results.copy()


def clear_search_results():
    """Clear the current search results."""
    global _current_search_results
    _current_search_results = []