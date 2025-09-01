"""
Shared context for tracking search results across agent execution.
"""

from typing import List, Dict, Any
import asyncio
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


# Live retrieval events infrastructure
# Map of session_id -> list of asyncio.Queue listeners to receive retrieval events
_retrieval_listeners: Dict[str, List[asyncio.Queue]] = {}


def register_retrieval_listener(session_id: str) -> asyncio.Queue:
    """Register a listener queue for retrieval events for a session.

    Returns an asyncio.Queue that will receive event dicts.
    """
    q: asyncio.Queue = asyncio.Queue()
    listeners = _retrieval_listeners.setdefault(session_id, [])
    listeners.append(q)
    return q


def unregister_retrieval_listener(session_id: str, q: asyncio.Queue) -> None:
    """Unregister a previously registered retrieval listener queue."""
    listeners = _retrieval_listeners.get(session_id)
    if not listeners:
        return
    try:
        listeners.remove(q)
    except ValueError:
        pass
    if not listeners:
        _retrieval_listeners.pop(session_id, None)


async def emit_retrieval_event(session_id: str, event: Dict[str, Any]) -> None:
    """Emit a retrieval event to all listeners for the given session.

    Event should be a JSON-serializable dict. This function never raises.
    """
    try:
        for q in list(_retrieval_listeners.get(session_id, [])):
            try:
                q.put_nowait(event)
            except Exception:
                # Ignore backpressure/errors to avoid disrupting the agent flow
                pass
    except Exception:
        # Never let event emission crash callers
        pass