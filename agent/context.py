"""
Shared context for tracking search results across agent execution.
"""

from typing import List, Dict, Any
import asyncio
from .models import ChunkResult

# Global context for tracking search results during agent execution
_current_search_results: List[ChunkResult] = []


def capture_search_results(results: List[ChunkResult]) -> List[ChunkResult]:
    """
    Captures and stores search results in a global context.

    This function allows different parts of the agent to access the results of
    search operations performed during a conversation turn.

    Args:
        results: A list of `ChunkResult` objects from a search operation.

    Returns:
        The same list of results that was passed in.
    """
    global _current_search_results
    _current_search_results.extend(results)
    return results


def get_current_search_results() -> List[ChunkResult]:
    """
    Retrieves the search results that have been captured in the current context.

    Returns:
        A copy of the list of `ChunkResult` objects.
    """
    return _current_search_results.copy()


def clear_search_results():
    """
    Clears the globally stored search results.

    This should be called at the beginning of each new agent execution to ensure
    that results from previous turns do not leak into the current one.
    """
    global _current_search_results
    _current_search_results = []


# Live retrieval events infrastructure
# Map of session_id -> list of asyncio.Queue listeners to receive retrieval events
_retrieval_listeners: Dict[str, List[asyncio.Queue]] = {}


def register_retrieval_listener(session_id: str) -> asyncio.Queue:
    """
    Registers a listener queue for real-time retrieval events for a specific session.

    Args:
        session_id: The ID of the session to listen to.

    Returns:
        An `asyncio.Queue` that will receive retrieval event dictionaries.
    """
    q: asyncio.Queue = asyncio.Queue()
    listeners = _retrieval_listeners.setdefault(session_id, [])
    listeners.append(q)
    return q


def unregister_retrieval_listener(session_id: str, q: asyncio.Queue) -> None:
    """
    Unregisters a previously registered retrieval listener queue.

    Args:
        session_id: The ID of the session from which to unregister.
        q: The `asyncio.Queue` object to be removed.
    """
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
    """
    Emits a retrieval event to all registered listeners for a given session.

    This function is designed to be non-blocking and to fail silently to avoid
    disrupting the main agent flow.

    Args:
        session_id: The ID of the session to which the event belongs.
        event: A JSON-serializable dictionary representing the event.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        listeners = _retrieval_listeners.get(session_id, [])
        logger.info(f"emit_retrieval_event: session_id={session_id}, num_listeners={len(listeners)}, event_type={event.get('type')}")
        
        for q in list(listeners):
            try:
                q.put_nowait(event)
                logger.info(f"Successfully queued event for session {session_id}")
            except Exception as e:
                # Ignore backpressure/errors to avoid disrupting the agent flow
                logger.warning(f"Failed to queue event: {e}")
                pass
    except Exception as e:
        # Never let event emission crash callers
        logger.error(f"Error in emit_retrieval_event: {e}")
        pass