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
    """Handles real-time analytics and metrics tracking."""
    
    def __init__(self):
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
        """Track chat activity for analytics."""
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
        """Track search analytics."""
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
        """Update daily metrics aggregation."""
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
        """Get current real-time metrics."""
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
        """Get chat activity metrics for specified time period."""
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
        """Get document usage statistics."""
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
        """Track prompt template usage."""
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
        """Track collection access for analytics."""
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
        """Get trending search queries."""
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
        """Get user engagement metrics."""
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
    """Quick function to track a message."""
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
    """Quick function to track a search."""
    await analytics_tracker.track_search_query(
        session_id=session_id,
        user_id=user_id,
        query=query,
        search_type=search_type,
        results_count=results_count,
        response_time_ms=response_time_ms
    )