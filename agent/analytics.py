"""
Analytics and metrics tracking for the RAG system.
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
import logging

from .db_utils import db_pool
from .models import ChatMetrics, DocumentUsageStats, RealTimeMetrics

logger = logging.getLogger(__name__)


class AnalyticsTracker:
    """
    Handles real-time analytics and metrics tracking for the RAG system.

    This class provides methods to track various user and system activities,
    such as chat messages, search queries, and document usage. It interacts
    with the database to store and retrieve analytics data.
    """
    
    def __init__(self):
        """Initializes the AnalyticsTracker."""
        self.active_sessions = set()
        self.message_buffer = []
        self.buffer_size = 100
        
    async def track_chat_activity(
        self,
        session_id: str,
        user_id: Optional[str] = None,
        message_count: int = 1,
        tool_calls_count: int = 0,
        search_queries_count: int = 0,
        documents_referenced: int = 0,
        response_time_ms: Optional[int] = None
    ) -> bool:
        """
        Tracks chat activity and stores it in the database.

        Args:
            session_id: The ID of the chat session.
            user_id: The ID of the user.
            message_count: The number of messages in the activity.
            tool_calls_count: The number of tool calls made.
            search_queries_count: The number of search queries performed.
            documents_referenced: The number of documents referenced.
            response_time_ms: The response time in milliseconds.

        Returns:
            True if the activity was tracked successfully, False otherwise.
        """
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO chat_analytics (
                        session_id, user_id, message_count, tool_calls_count,
                        search_queries_count, documents_referenced, response_time_ms
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (session_id) DO UPDATE SET
                        message_count = chat_analytics.message_count + EXCLUDED.message_count,
                        tool_calls_count = chat_analytics.tool_calls_count + EXCLUDED.tool_calls_count,
                        search_queries_count = chat_analytics.search_queries_count + EXCLUDED.search_queries_count,
                        documents_referenced = chat_analytics.documents_referenced + EXCLUDED.documents_referenced,
                        response_time_ms = COALESCE(EXCLUDED.response_time_ms, chat_analytics.response_time_ms),
                        created_at = CURRENT_TIMESTAMP
                """, session_id, user_id, message_count, tool_calls_count,
                    search_queries_count, documents_referenced, response_time_ms)
                return True
        except Exception as e:
            logger.error(f"Failed to track chat activity: {e}")
            return False
    
    async def track_search_query(
        self,
        session_id: Optional[str],
        user_id: Optional[str],
        query: str,
        search_type: str,
        results_count: int = 0,
        response_time_ms: Optional[int] = None,
        relevance_scores: Optional[List[float]] = None
    ) -> bool:
        """
        Tracks a search query and stores it in the database.

        Args:
            session_id: The ID of the chat session.
            user_id: The ID of the user.
            query: The search query string.
            search_type: The type of search performed (e.g., 'vector', 'graph').
            results_count: The number of results returned.
            response_time_ms: The response time in milliseconds.
            relevance_scores: A list of relevance scores for the results.

        Returns:
            True if the query was tracked successfully, False otherwise.
        """
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO search_analytics (
                        session_id, user_id, query, search_type, results_count,
                        response_time_ms, relevance_scores
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, session_id, user_id, query, search_type, results_count,
                    response_time_ms, relevance_scores or [])
                return True
        except Exception as e:
            logger.error(f"Failed to track search query: {e}")
            return False
    
    async def update_daily_metrics(self, date: Optional[datetime] = None) -> bool:
        """
        Updates the aggregated daily metrics for a specific date.

        If no date is provided, it updates the metrics for the current day.

        Args:
            date: The date for which to update the metrics.

        Returns:
            True if the metrics were updated successfully, False otherwise.
        """
        target_date = date or datetime.now().date()
        
        try:
            async with db_pool.acquire() as conn:
                # Calculate daily metrics
                result = await conn.fetchrow("""
                    WITH daily_stats AS (
                        SELECT
                            COUNT(DISTINCT s.id) as total_sessions,
                            COUNT(DISTINCT s.user_id) as unique_users,
                            COALESCE(SUM(ca.message_count), 0) as total_messages,
                            COUNT(DISTINCT CASE WHEN d.created_at::date = $1 THEN d.id END) as documents_uploaded,
                            COALESCE(SUM(ca.search_queries_count), 0) as total_searches,
                            COALESCE(SUM(ca.tool_calls_count), 0) as total_tool_calls,
                            AVG(EXTRACT(EPOCH FROM (s.updated_at - s.created_at))) as avg_session_duration
                        FROM sessions s
                        LEFT JOIN chat_analytics ca ON s.id::text = ca.session_id
                        LEFT JOIN documents d ON d.created_at::date = $1
                        WHERE s.created_at::date = $1
                    )
                    INSERT INTO daily_metrics (
                        date, total_messages, unique_users, total_sessions,
                        avg_session_duration, total_documents_uploaded,
                        total_searches, total_tool_calls
                    )
                    SELECT
                        $1, total_messages::integer, unique_users::integer, total_sessions::integer,
                        avg_session_duration::integer, documents_uploaded::integer,
                        total_searches::integer, total_tool_calls::integer
                    FROM daily_stats
                    ON CONFLICT (date) DO UPDATE SET
                        total_messages = EXCLUDED.total_messages,
                        unique_users = EXCLUDED.unique_users,
                        total_sessions = EXCLUDED.total_sessions,
                        avg_session_duration = EXCLUDED.avg_session_duration,
                        total_documents_uploaded = EXCLUDED.total_documents_uploaded,
                        total_searches = EXCLUDED.total_searches,
                        total_tool_calls = EXCLUDED.total_tool_calls
                    RETURNING *
                """, target_date)
                
                return result is not None
        except Exception as e:
            logger.error(f"Failed to update daily metrics: {e}")
            return False
    
    async def get_real_time_metrics(self) -> Optional[RealTimeMetrics]:
        """
        Retrieves real-time metrics from the database.

        Returns:
            A RealTimeMetrics object containing the current metrics, or None if an error occurs.
        """
        try:
            async with db_pool.acquire() as conn:
                result = await conn.fetchrow("""
                    SELECT
                        active_sessions,
                        messages_last_hour,
                        new_users_last_hour,
                        total_documents,
                        documents_today,
                        public_templates,
                        total_collections
                    FROM real_time_metrics
                """)
                
                if result:
                    return RealTimeMetrics(
                        active_sessions=result['active_sessions'] or 0,
                        messages_last_hour=result['messages_last_hour'] or 0,
                        new_users_last_hour=result['new_users_last_hour'] or 0,
                        total_documents=result['total_documents'] or 0,
                        documents_today=result['documents_today'] or 0,
                        public_templates=result['public_templates'] or 0,
                        total_collections=result['total_collections'] or 0
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get real-time metrics: {e}")
            return None
    
    async def get_chat_activity_metrics(
        self,
        days: int = 7
    ) -> Optional[ChatMetrics]:
        """
        Retrieves chat activity metrics over a specified number of days.

        Args:
            days: The number of days to look back for chat activity.

        Returns:
            A ChatMetrics object containing the activity metrics, or None if an error occurs.
        """
        try:
            async with db_pool.acquire() as conn:
                start_date = datetime.now() - timedelta(days=days)
                result = await conn.fetchrow("""
                    SELECT * FROM get_chat_activity_metrics($1, $2)
                """, start_date, datetime.now())
                
                if result:
                    return ChatMetrics(
                        total_messages=result['total_messages'] or 0,
                        total_sessions=result['total_sessions'] or 0,
                        unique_users=result['unique_users'] or 0,
                        avg_messages_per_session=result['avg_messages_per_session'] or 0,
                        total_tool_calls=result['total_tool_calls'] or 0,
                        avg_response_time_ms=result['avg_response_time_ms'] or 0
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get chat activity metrics: {e}")
            return None
    
    async def get_document_usage_stats(self) -> Optional[DocumentUsageStats]:
        """
        Retrieves statistics about document usage.

        Returns:
            A DocumentUsageStats object containing the usage statistics, or None if an error occurs.
        """
        try:
            async with db_pool.acquire() as conn:
                result = await conn.fetchrow("""
                    SELECT * FROM get_document_usage_stats()
                """)
                
                if result:
                    return DocumentUsageStats(
                        total_documents=result['total_documents'] or 0,
                        documents_uploaded_today=result['documents_uploaded_today'] or 0,
                        most_referenced_document_id=result['most_referenced_document_id'],
                        most_referenced_document_title=result['most_referenced_document_title'],
                        avg_document_size=result['avg_document_size'] or 0
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get document usage stats: {e}")
            return None
    
    async def track_prompt_usage(
        self,
        template_id: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        execution_time_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> bool:
        """
        Tracks the usage of a prompt template.

        Args:
            template_id: The ID of the prompt template.
            session_id: The ID of the chat session.
            user_id: The ID of the user.
            variables: The variables used to fill the prompt template.
            execution_time_ms: The execution time in milliseconds.
            success: A boolean indicating if the prompt execution was successful.
            error_message: Any error message that occurred during execution.

        Returns:
            True if the usage was tracked successfully, False otherwise.
        """
        try:
            async with db_pool.acquire() as conn:
                # Log usage
                await conn.execute("""
                    INSERT INTO prompt_usage_logs (
                        template_id, session_id, user_id, variables,
                        execution_time_ms, success, error_message
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, UUID(template_id), UUID(session_id) if session_id else None,
                    user_id, json.dumps(variables) if variables else '{}',
                    execution_time_ms, success, error_message)
                
                # Update usage count
                await conn.execute("""
                    UPDATE prompt_templates
                    SET usage_count = usage_count + 1
                    WHERE id = $1
                """, UUID(template_id))
                
                return True
        except Exception as e:
            logger.error(f"Failed to track prompt usage: {e}")
            return False
    
    async def track_collection_access(
        self,
        collection_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Tracks when a collection is accessed.

        Args:
            collection_id: The ID of the collection.
            user_id: The ID of the user accessing the collection.

        Returns:
            True if the access was tracked successfully, False otherwise.
        """
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    UPDATE collections
                    SET last_accessed = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, UUID(collection_id))
                return True
        except Exception as e:
            logger.error(f"Failed to track collection access: {e}")
            return False
    
    async def get_trending_searches(
        self,
        days: int = 7,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Retrieves a list of trending search queries.

        Args:
            days: The number of days to look back for trending searches.
            limit: The maximum number of trending searches to return.

        Returns:
            A list of dictionaries, each representing a trending search query.
        """
        try:
            async with db_pool.acquire() as conn:
                start_date = datetime.now() - timedelta(days=days)
                results = await conn.fetch("""
                    SELECT
                        query,
                        COUNT(*) as query_count,
                        AVG(results_count) as avg_results,
                        AVG(response_time_ms) as avg_response_time,
                        COUNT(CASE WHEN user_satisfied = true THEN 1 END) as satisfied_users,
                        COUNT(CASE WHEN user_satisfied = false THEN 1 END) as unsatisfied_users
                    FROM search_analytics
                    WHERE created_at >= $1
                    GROUP BY query
                    HAVING COUNT(*) > 1
                    ORDER BY query_count DESC, avg_results DESC
                    LIMIT $2
                """, start_date, limit)
                
                return [dict(result) for result in results]
        except Exception as e:
            logger.error(f"Failed to get trending searches: {e}")
            return []
    
    async def get_user_engagement_metrics(
        self,
        user_id: Optional[str] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Retrieves user engagement metrics.

        If a user_id is provided, it retrieves metrics for that specific user.
        Otherwise, it retrieves system-wide engagement metrics.

        Args:
            user_id: The ID of the user to get metrics for.
            days: The number of days to look back for engagement data.

        Returns:
            A dictionary containing user engagement metrics.
        """
        try:
            async with db_pool.acquire() as conn:
                start_date = datetime.now() - timedelta(days=days)
                
                where_clause = "WHERE ca.created_at >= $1"
                params = [start_date]
                
                if user_id:
                    where_clause += " AND ca.user_id = $2"
                    params.append(user_id)
                
                result = await conn.fetchrow(f"""
                    SELECT
                        COUNT(DISTINCT ca.session_id) as total_sessions,
                        AVG(ca.message_count) as avg_messages_per_session,
                        SUM(ca.message_count) as total_messages,
                        SUM(ca.tool_calls_count) as total_tool_calls,
                        SUM(ca.search_queries_count) as total_searches,
                        AVG(ca.response_time_ms) as avg_response_time,
                        COUNT(CASE WHEN ca.satisfaction_rating >= 4 THEN 1 END) as high_satisfaction_count,
                        COUNT(CASE WHEN ca.satisfaction_rating <= 2 THEN 1 END) as low_satisfaction_count,
                        AVG(ca.satisfaction_rating) as avg_satisfaction_rating
                    FROM chat_analytics ca
                    {where_clause}
                """, *params)
                
                return dict(result) if result else {}
        except Exception as e:
            logger.error(f"Failed to get user engagement metrics: {e}")
            return {}


# Global analytics instance
analytics_tracker = AnalyticsTracker()


# Utility functions for easy access
async def track_message(
    session_id: str,
    user_id: Optional[str] = None,
    tool_calls: int = 0,
    response_time_ms: Optional[int] = None
):
    """
    A utility function to quickly track a chat message.

    This is a convenience wrapper around `AnalyticsTracker.track_chat_activity`.

    Args:
        session_id: The ID of the chat session.
        user_id: The ID of the user.
        tool_calls: The number of tool calls made in the message.
        response_time_ms: The response time in milliseconds.
    """
    await analytics_tracker.track_chat_activity(
        session_id=session_id,
        user_id=user_id,
        message_count=1,
        tool_calls_count=tool_calls,
        response_time_ms=response_time_ms
    )


async def track_search(
    query: str,
    search_type: str,
    results_count: int,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    response_time_ms: Optional[int] = None
):
    """
    A utility function to quickly track a search query.

    This is a convenience wrapper around `AnalyticsTracker.track_search_query`.

    Args:
        query: The search query string.
        search_type: The type of search performed.
        results_count: The number of results returned.
        session_id: The ID of the chat session.
        user_id: The ID of the user.
        response_time_ms: The response time in milliseconds.
    """
    await analytics_tracker.track_search_query(
        session_id=session_id,
        user_id=user_id,
        query=query,
        search_type=search_type,
        results_count=results_count,
        response_time_ms=response_time_ms
    )