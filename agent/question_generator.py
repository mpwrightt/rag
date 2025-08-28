"""
AI-powered question generation based on document content.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional
import google.generativeai as genai
import json
from datetime import datetime, timedelta

from .db_utils import db_pool
from .models import Document, ChunkResult

logger = logging.getLogger(__name__)

class QuestionGenerator:
    """Generates relevant questions based on document content."""
    
    def __init__(self, gemini_api_key: str):
        """Initialize the question generator with Gemini client."""
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        self._cache = {}  # Simple in-memory cache
        self._cache_ttl = timedelta(hours=1)
    
    async def generate_questions_for_collection(
        self, 
        collection_id: str, 
        limit: int = 6
    ) -> List[str]:
        """
        Generate relevant questions for a specific collection.
        
        Args:
            collection_id: ID of the collection to generate questions for
            limit: Maximum number of questions to generate
            
        Returns:
            List of generated questions
        """
        # Check cache first
        cache_key = f"collection_{collection_id}_{limit}"
        if cache_key in self._cache:
            cached_data = self._cache[cache_key]
            if datetime.now() - cached_data['timestamp'] < self._cache_ttl:
                return cached_data['questions']
        
        try:
            # Get document summaries from the collection
            document_summaries = await self._get_collection_document_summaries(collection_id)
            
            if not document_summaries:
                return self._get_default_questions()
            
            # Generate questions using OpenAI
            questions = await self._generate_questions_from_content(document_summaries, limit)
            
            # Cache the results
            self._cache[cache_key] = {
                'questions': questions,
                'timestamp': datetime.now()
            }
            
            return questions
            
        except Exception as e:
            logger.error(f"Error generating questions for collection {collection_id}: {e}")
            return self._get_default_questions()
    
    async def generate_questions_for_all_documents(
        self, 
        limit: int = 6
    ) -> List[str]:
        """
        Generate relevant questions based on all documents in the database.
        
        Args:
            limit: Maximum number of questions to generate
            
        Returns:
            List of generated questions
        """
        # Check cache first
        cache_key = f"all_documents_{limit}"
        if cache_key in self._cache:
            cached_data = self._cache[cache_key]
            if datetime.now() - cached_data['timestamp'] < self._cache_ttl:
                return cached_data['questions']
        
        try:
            # Get sample of document content
            document_summaries = await self._get_all_document_summaries(limit=20)
            
            if not document_summaries:
                logger.warning("No documents found in database for question generation")
                return self._get_default_questions()
            
            logger.info(f"Generating questions from {len(document_summaries)} document summaries")
            # Generate questions using OpenAI
            questions = await self._generate_questions_from_content(document_summaries, limit)
            
            # Cache the results
            self._cache[cache_key] = {
                'questions': questions,
                'timestamp': datetime.now()
            }
            
            return questions
            
        except Exception as e:
            logger.error(f"Error generating questions for all documents: {e}")
            return self._get_default_questions()
    
    async def _get_collection_document_summaries(self, collection_id: str) -> List[Dict[str, Any]]:
        """Get document summaries from a specific collection."""
        if not db_pool:
            return []
        
        query = """
            SELECT d.id, d.title, d.source, d.metadata,
                   LEFT(d.content, 1000) as content_preview,
                   COUNT(c.id) as chunk_count
            FROM documents d
            LEFT JOIN chunks c ON d.id = c.document_id
            WHERE d.metadata->>'collection_id' = $1
            GROUP BY d.id, d.title, d.source, d.metadata, d.content
            ORDER BY d.created_at DESC
            LIMIT 15
        """
        
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch(query, collection_id)
                
                return [
                    {
                        'id': str(row['id']),
                        'title': row['title'],
                        'source': row['source'],
                        'content_preview': row['content_preview'],
                        'chunk_count': row['chunk_count'],
                        'metadata': row['metadata']
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"Error fetching collection documents: {e}")
            return []
    
    async def _get_all_document_summaries(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get summaries from all documents."""
        if not db_pool:
            return []
        
        query = """
            SELECT d.id, d.title, d.source, d.metadata,
                   LEFT(d.content, 800) as content_preview,
                   COUNT(c.id) as chunk_count
            FROM documents d
            LEFT JOIN chunks c ON d.id = c.document_id
            GROUP BY d.id, d.title, d.source, d.metadata, d.content
            ORDER BY d.created_at DESC
            LIMIT $1
        """
        
        try:
            async with db_pool.acquire() as conn:
                rows = await conn.fetch(query, limit)
                
                logger.info(f"Found {len(rows)} documents for question generation")
                
                return [
                    {
                        'id': str(row['id']),
                        'title': row['title'],
                        'source': row['source'],
                        'content_preview': row['content_preview'],
                        'chunk_count': row['chunk_count'],
                        'metadata': row['metadata'] or {}
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"Error fetching all documents: {e}")
            return []
    
    async def _generate_questions_from_content(
        self, 
        document_summaries: List[Dict[str, Any]], 
        limit: int
    ) -> List[str]:
        """Generate questions using OpenAI based on document content."""
        
        # Create a prompt with document information
        content_info = []
        for doc in document_summaries:
            content_info.append({
                'title': doc['title'],
                'source': doc['source'],
                'preview': doc['content_preview'][:500],  # Limit preview length
                'metadata': doc.get('metadata', {})
            })
        
        system_prompt = """You are an expert at analyzing document collections and generating insightful questions that users would want to ask about the content. 

Your task is to analyze the provided document summaries and generate relevant, specific questions that would help users explore and understand the content better.

Guidelines:
1. Generate questions that are specific to the actual content, not generic
2. Focus on key topics, themes, and entities mentioned in the documents
3. Create questions that would lead to insightful answers
4. Vary the question types (what, how, why, when, who)
5. Make questions natural and conversational
6. Avoid overly technical jargon unless the content is highly technical
7. Consider different user intents: summarization, specific details, comparisons, analysis

Return only a JSON array of question strings, nothing else."""

        user_prompt = f"""Based on these document summaries, generate {limit} relevant questions users would want to ask:

{json.dumps(content_info, indent=2)}

Focus on the actual content, topics, and themes present in these documents. Make the questions specific and useful for exploring this particular collection."""

        try:
            # Combine system and user prompts for Gemini
            full_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            # Ask the model to return strict JSON
            response = await asyncio.to_thread(
                self.model.generate_content,
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=1000,
                    # Try to force JSON so parsing is reliable (supported in recent SDKs)
                    response_mime_type="application/json",
                )
            )

            # Extract text robustly across SDK versions
            questions_text = ""
            try:
                questions_text = (response.text or "").strip()
            except Exception:
                try:
                    # Fallback for different response shapes
                    questions_text = (
                        response.candidates[0].content.parts[0].text  # type: ignore[attr-defined]
                    ).strip()
                except Exception:
                    questions_text = ""

            # Log a small preview for debugging
            preview = (questions_text[:400] + '...') if len(questions_text) > 400 else questions_text
            logger.debug(f"Gemini questions raw preview: {preview}")
            
            # Try to parse as JSON
            try:
                questions = json.loads(questions_text)
                if isinstance(questions, list):
                    # Normalize and filter
                    cleaned = [self._clean_question(q) for q in questions if isinstance(q, str) and q.strip()]
                    cleaned = [q for q in cleaned if q]
                    if cleaned:
                        return cleaned[:limit]
            except json.JSONDecodeError:
                pass

            # If JSON parsing fails or empty, try to extract from plain text
            lines = questions_text.split('\n') if questions_text else []
            extracted: List[str] = []
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if line.startswith(('{', '[', '```')):
                    # Likely code/JSON block indicator; skip here
                    continue
                if line.endswith('?') or any(line.lower().startswith(w) for w in ['what', 'how', 'why', 'when', 'who', 'where', 'which']):
                    cleaned_line = self._clean_question(line)
                    if cleaned_line:
                        extracted.append(cleaned_line)
            if extracted:
                return extracted[:limit]

            # As a final fallback, produce heuristic questions from titles/content
            return self._heuristic_questions(document_summaries, limit)
            
        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}")
            return self._heuristic_questions(document_summaries, limit)
        
        # Should not reach here; fallback
        return self._heuristic_questions(document_summaries, limit)
    
    def _get_default_questions(self) -> List[str]:
        """Return empty list - no fallback questions."""
        return []
    
    def clear_cache(self):
        """Clear the question cache."""
        self._cache.clear()

    def _clean_question(self, q: str) -> str:
        """Normalize a question string and ensure it ends with a question mark."""
        if not q:
            return ""
        q = q.strip().strip('- "\'[]{}1234567890. ').strip()
        if not q:
            return ""
        # Capitalize first letter if not already
        if q and q[0].isalpha():
            q = q[0].upper() + q[1:]
        # Ensure trailing question mark
        if not q.endswith('?'):
            q += '?'
        return q

    def _heuristic_questions(self, document_summaries: List[Dict[str, Any]], limit: int) -> List[str]:
        """Produce reasonable questions from document titles/content as a fallback."""
        questions: List[str] = []
        for doc in document_summaries:
            title = (doc.get('title') or 'this document').strip()
            # Generate a few templates per doc
            templates = [
                f"What are the key takeaways from '{title}'?",
                f"How does '{title}' impact our current understanding or process?",
                f"Which important entities or topics are discussed in '{title}'?",
            ]
            for t in templates:
                questions.append(t)
                if len(questions) >= limit:
                    break
            if len(questions) >= limit:
                break
        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for q in questions:
            if q not in seen:
                seen.add(q)
                deduped.append(q)
        return deduped[:limit]