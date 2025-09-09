"""
Advanced Query Processing and Understanding Module
Extracts entities, keywords, intent, and prepares optimized search queries.
"""

import re
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class QueryIntent(Enum):
    """Types of query intents."""
    FACTUAL = "factual"  # Looking for specific facts
    EXPLORATORY = "exploratory"  # Broad exploration of a topic
    COMPARISON = "comparison"  # Comparing entities
    TEMPORAL = "temporal"  # Time-based queries
    RELATIONSHIP = "relationship"  # Entity relationships
    PROCEDURAL = "procedural"  # How-to questions
    ANALYTICAL = "analytical"  # Analysis or reasoning


@dataclass
class ProcessedQuery:
    """Structured representation of a processed query."""
    original: str
    cleaned: str
    intent: QueryIntent
    entities: List[Dict[str, str]]  # [{"text": "Hercules Chemical", "type": "company"}]
    keywords: List[str]
    temporal_refs: List[str]
    key_phrases: List[str]
    graph_query: str  # Optimized for graph search
    vector_query: str  # Optimized for vector search
    search_filters: Dict[str, Any]
    confidence_scores: Dict[str, float]


class QueryProcessor:
    """Advanced query processor for comprehensive query understanding."""
    
    def __init__(self):
        # Common stop words to filter
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
            # Conversational filler and generic reporting verbs
            'report', 'reports', 'reported', 'say', 'says', 'said', 'regarding'
        }
        
        # Entity patterns
        self.entity_patterns = {
            'company': [
                r'\b[A-Z][a-z]+\s+(?:Inc|Corp|LLC|Ltd|Company|Co|Chemical|Industries|Technologies|Systems)\b',
                r'\b(?:Google|Microsoft|Apple|Amazon|Meta|OpenAI|Anthropic|IBM|Oracle|SAP)\b',
            ],
            'technology': [
                r'\b(?:AI|ML|blockchain|cloud|quantum|IoT|5G|API|SDK|LLM|RAG|vector database)\b',
                r'\b[A-Z][a-z]+(?:DB|OS|Stack|Framework|Platform|Tool|Service)\b',
            ],
            'person': [
                r'\b[A-Z][a-z]+\s+[A-Z][a-z]+\b',  # Basic name pattern
                r'\b(?:CEO|CTO|CFO|Director|Manager|Engineer|Scientist|Dr\.|Prof\.)\s+[A-Z][a-z]+\b',
            ],
            'location': [
                r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*(?:USA|US|UK|Canada|Europe|Asia)\b',
                r'\b(?:New York|San Francisco|London|Tokyo|Berlin|Paris|Seattle|Austin)\b',
            ],
            'date': [
                r'\b\d{4}\b',  # Year
                r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',
                r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
                r'\b(?:Q[1-4]\s+\d{4})\b',
            ],
            'concept': [
                r'\b(?:remediation|assessment|cleanup|contamination|pollution|sustainability)\b',
                r'\b(?:strategy|plan|approach|method|process|system|framework|model)\b',
            ]
        }
        
        # Intent keywords
        self.intent_keywords = {
            QueryIntent.FACTUAL: ['what is', 'who is', 'define', 'meaning of', 'facts about'],
            QueryIntent.EXPLORATORY: ['tell me about', 'explain', 'describe', 'overview of'],
            QueryIntent.COMPARISON: ['compare', 'difference between', 'versus', 'vs', 'better than'],
            QueryIntent.TEMPORAL: ['when', 'timeline', 'history of', 'evolution of', 'before', 'after'],
            QueryIntent.RELATIONSHIP: ['relationship between', 'how does', 'connected to', 'related to'],
            QueryIntent.PROCEDURAL: ['how to', 'steps to', 'process for', 'guide to', 'tutorial'],
            QueryIntent.ANALYTICAL: ['why', 'analyze', 'evaluate', 'impact of', 'consequences of']
        }

    def process(self, query: str) -> ProcessedQuery:
        """
        Process a query to extract all relevant information.
        
        Args:
            query: Raw user query
            
        Returns:
            ProcessedQuery with extracted information
        """
        logger.info(f"Processing query: {query[:100]}...")
        
        # Clean and normalize
        cleaned = self._clean_query(query)
        
        # Detect intent
        intent = self._detect_intent(query.lower())
        
        # Extract entities
        entities = self._extract_entities(query)
        
        # Extract keywords and phrases
        keywords = self._extract_keywords(cleaned)
        key_phrases = self._extract_key_phrases(cleaned)
        
        # Extract temporal references
        temporal_refs = self._extract_temporal_refs(query)
        
        # Generate optimized search queries
        graph_query = self._optimize_for_graph(query, entities, keywords)
        vector_query = self._optimize_for_vector(query, entities, key_phrases)
        
        # Generate search filters
        search_filters = self._generate_filters(entities, temporal_refs)
        
        # Calculate confidence scores
        confidence_scores = self._calculate_confidence(entities, keywords, intent)
        
        result = ProcessedQuery(
            original=query,
            cleaned=cleaned,
            intent=intent,
            entities=entities,
            keywords=keywords,
            temporal_refs=temporal_refs,
            key_phrases=key_phrases,
            graph_query=graph_query,
            vector_query=vector_query,
            search_filters=search_filters,
            confidence_scores=confidence_scores
        )
        
        logger.info(f"Query processing complete: intent={intent.value}, entities={len(entities)}, keywords={len(keywords)}")
        return result

    def _clean_query(self, query: str) -> str:
        """Clean and normalize the query."""
        # Remove extra whitespace
        cleaned = ' '.join(query.split())
        # Remove special characters but keep meaningful punctuation
        cleaned = re.sub(r'[^\w\s\-\.,!?]', ' ', cleaned)
        return cleaned

    def _detect_intent(self, query_lower: str) -> QueryIntent:
        """Detect the primary intent of the query."""
        for intent, keywords in self.intent_keywords.items():
            for keyword in keywords:
                if keyword in query_lower:
                    return intent
        
        # Default based on question words
        if query_lower.startswith('why'):
            return QueryIntent.ANALYTICAL
        elif query_lower.startswith('how'):
            return QueryIntent.PROCEDURAL
        elif query_lower.startswith('when'):
            return QueryIntent.TEMPORAL
        elif query_lower.startswith('what'):
            return QueryIntent.FACTUAL
        
        return QueryIntent.EXPLORATORY

    def _extract_entities(self, query: str) -> List[Dict[str, str]]:
        """Extract named entities from the query."""
        entities = []
        seen = set()
        
        for entity_type, patterns in self.entity_patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, query, re.IGNORECASE)
                for match in matches:
                    text = match.group().strip()
                    if text.lower() not in seen:
                        entities.append({
                            "text": text,
                            "type": entity_type,
                            "start": match.start(),
                            "end": match.end()
                        })
                        seen.add(text.lower())
        
        # Sort by position in query
        entities.sort(key=lambda x: x["start"])
        return entities

    def _extract_keywords(self, query: str) -> List[str]:
        """Extract important keywords from the query."""
        words = query.lower().split()
        keywords = []
        
        for word in words:
            # Clean word
            word = re.sub(r'[^\w\-]', '', word)
            
            # Skip stop words and short words
            if word in self.stop_words or len(word) < 3:
                continue
            
            # Check if it's a meaningful keyword
            if self._is_meaningful_keyword(word):
                keywords.append(word)
        
        return list(set(keywords))

    def _extract_key_phrases(self, query: str) -> List[str]:
        """Extract meaningful phrases from the query."""
        phrases = []
        
        # Common phrase patterns
        phrase_patterns = [
            r'\b(?:green|sustainable|environmental)\s+\w+\s+\w+\b',
            r'\b\w+\s+(?:plan|strategy|approach|method|system)\b',
            r'\b(?:key|main|primary|important)\s+\w+\b',
            r'\b\w+\s+(?:assessment|evaluation|analysis)\b',
        ]
        
        for pattern in phrase_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                phrase = match.group().strip()
                if len(phrase.split()) >= 2:
                    phrases.append(phrase.lower())
        
        return list(set(phrases))

    def _extract_temporal_refs(self, query: str) -> List[str]:
        """Extract temporal references from the query."""
        temporal = []
        
        # Date patterns
        date_patterns = [
            r'\b\d{4}\b',
            r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b',
            r'\b(?:Q[1-4]\s+\d{4})\b',
            r'\b(?:last|next|this|previous)\s+(?:year|month|quarter|week)\b',
            r'\b(?:\d+\s+(?:years?|months?|weeks?|days?)\s+ago)\b',
        ]
        
        for pattern in date_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                temporal.append(match.group().strip())
        
        return temporal

    def _optimize_for_graph(self, query: str, entities: List[Dict], keywords: List[str]) -> str:
        """Generate an optimized query for graph search."""
        # Focus on entities and relationships
        graph_terms = []
        
        # Add entity names
        for entity in entities:
            graph_terms.append(entity["text"])
        
        # Add relationship keywords
        relationship_keywords = ['relationship', 'connected', 'related', 'associated', 'linked']
        for kw in keywords:
            if any(rel in kw for rel in relationship_keywords):
                graph_terms.append(kw)
        
        # If we have entities, focus on them
        if graph_terms:
            return ' '.join(graph_terms[:5])  # Limit to top 5 terms
        
        # Otherwise use top keywords
        return ' '.join(keywords[:5])

    def _optimize_for_vector(self, query: str, entities: List[Dict], phrases: List[str]) -> str:
        """Generate an optimized query for vector search."""
        # Combine original query with extracted entities and phrases for richer semantic search
        vector_parts = [query]
        
        # Add entity context
        entity_context = ' '.join([e["text"] for e in entities[:3]])
        if entity_context:
            vector_parts.append(f"Related to: {entity_context}")
        
        # Add key phrases
        if phrases:
            vector_parts.append(' '.join(phrases[:2]))
        
        return ' '.join(vector_parts)

    def _generate_filters(self, entities: List[Dict], temporal_refs: List[str]) -> Dict[str, Any]:
        """Generate search filters based on extracted information."""
        filters = {}
        
        # Date filters
        if temporal_refs:
            filters["temporal"] = temporal_refs
        
        # Entity type filters
        entity_types = list(set(e["type"] for e in entities))
        if entity_types:
            filters["entity_types"] = entity_types
        
        # Specific entity filters
        if entities:
            filters["entities"] = [e["text"] for e in entities]
        
        return filters

    def _calculate_confidence(self, entities: List[Dict], keywords: List[str], intent: QueryIntent) -> Dict[str, float]:
        """Calculate confidence scores for various aspects of the query processing."""
        scores = {}
        
        # Entity extraction confidence
        scores["entity_extraction"] = min(1.0, len(entities) * 0.3)
        
        # Keyword extraction confidence
        scores["keyword_extraction"] = min(1.0, len(keywords) * 0.15)
        
        # Intent detection confidence
        scores["intent_detection"] = 0.8 if intent != QueryIntent.EXPLORATORY else 0.5
        
        # Overall confidence
        scores["overall"] = sum(scores.values()) / len(scores)
        
        return scores

    def _is_meaningful_keyword(self, word: str) -> bool:
        """Check if a word is meaningful enough to be a keyword."""
        # Check length
        if len(word) < 3:
            return False
        
        # Check if it's not just numbers
        if word.isdigit():
            return False
        
        # Check if it contains meaningful patterns
        meaningful_patterns = [
            r'.*tion$',  # Words ending in -tion
            r'.*ment$',  # Words ending in -ment
            r'.*ance$',  # Words ending in -ance
            r'.*ence$',  # Words ending in -ence
            r'^[A-Z]',   # Capitalized words (in lowercase query)
        ]
        
        for pattern in meaningful_patterns:
            if re.match(pattern, word):
                return True
        
        return True  # Default to true if not filtered out
