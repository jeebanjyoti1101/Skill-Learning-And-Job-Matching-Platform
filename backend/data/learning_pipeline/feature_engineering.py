from functools import lru_cache
from typing import List, Optional, Dict, Any
import logging
import asyncio
import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
import threading

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import pipeline
from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)
SENTIMENT_MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest"
ADVANCED_SENTIMENT_MODEL = "j-hartmann/emotion-english-distilroberta-base"

# Global thread pool for async processing
executor = ThreadPoolExecutor(max_workers=8)

# Cache for embeddings to avoid recomputation
_embedding_cache = {}
_sentiment_cache = {}


def _read_attr_or_key(item, name: str, default=None):
    if hasattr(item, name):
        return getattr(item, name)
    if isinstance(item, dict):
        return item.get(name, default)
    return default


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer("all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def get_sentiment_model():
    return pipeline("sentiment-analysis", model=SENTIMENT_MODEL_ID)


@lru_cache(maxsize=1)
def get_hf_client(api_key: Optional[str] = None) -> Optional[InferenceClient]:
    """Get InferenceClient for real-time API calls. Returns None if no token."""
    if not api_key:
        return None
    try:
        return InferenceClient(provider="hf-inference", api_key=api_key)
    except Exception as e:
        logger.warning(f"Failed to init InferenceClient: {e}. Falling back to local models.")
        return None


def compute_engagement_score(views: int, likes: int) -> float:
    if views <= 0:
        return 0.0
    return float(likes) / float(views)


def compute_semantic_similarity(skill: str, text: str, hf_client: Optional[InferenceClient] = None) -> float:
    """Compute semantic similarity using HF API (real-time) or local model."""
    if hf_client:
        try:
            result = hf_client.sentence_similarity(
                skill,
                [text],
                model="sentence-transformers/all-MiniLM-L6-v2"
            )
            if result is not None:
                values = list(result) if isinstance(result, (list, tuple, np.ndarray)) else [result]
                if values:
                    return float(values[0])
        except Exception as e:
            logger.warning(f"HF API call failed: {e}. Using local model.")
    
    # Fallback to local model
    model = get_embedding_model()
    skill_vec = model.encode([skill], convert_to_numpy=True)
    text_vec = model.encode([text], convert_to_numpy=True)
    score = cosine_similarity(skill_vec, text_vec)[0][0]
    return float(score)


def compute_sentiment_score(comments: List[str], hf_client: Optional[InferenceClient] = None) -> float:
    """Compute sentiment score using HF API (real-time) or local model."""
    if not comments:
        return 0.5

    # Use HF API for real-time if available
    if hf_client:
        try:
            positivity = []
            for comment in comments[:20]:  # Limit to avoid rate limits
                result = hf_client.text_classification(
                    comment,
                    model=SENTIMENT_MODEL_ID
                )
                result_items = list(result) if isinstance(result, (list, tuple)) else [result]
                if result_items:
                    top = result_items[0]
                    label = str(_read_attr_or_key(top, "label", "")).upper()
                    raw_score = _read_attr_or_key(top, "score", 0.0)
                    score = float(raw_score)
                    positivity.append(score if label == "POSITIVE" else (1.0 - score))
            if positivity:
                return float(np.mean(positivity))
        except Exception as e:
            logger.warning(f"HF API sentiment call failed: {e}. Using local model.")
    
    # Fallback to local model
    analyzer = get_sentiment_model()
    results = analyzer(comments, truncation=True)

    positivity = []
    for result in results:
        label = result.get("label", "").upper()
        score = float(result.get("score", 0.0))
        positivity.append(score if label == "POSITIVE" else (1.0 - score))

    return float(np.mean(positivity)) if positivity else 0.5


def generate_label(engagement_score: float, sentiment_score: float) -> int:
    return int(engagement_score > 0.04 and sentiment_score > 0.6)


# ============================================================================
# ADVANCED PERFORMANCE FEATURES
# ============================================================================

def compute_advanced_engagement_score(views: int, likes: int, comment_count: int) -> float:
    """Advanced engagement score combining likes, views, and comments."""
    if views <= 0:
        return 0.0
    
    like_ratio = float(likes) / float(views)
    comment_ratio = float(comment_count) / max(float(views), 1.0)
    
    # Weighted combination: 70% likes, 30% comments
    advanced_score = (0.7 * like_ratio) + (0.3 * min(comment_ratio, 0.1))
    return float(np.clip(advanced_score, 0.0, 1.0))


def compute_semantic_similarity_batch(skills: List[str], texts: List[str], 
                                     hf_client: Optional[InferenceClient] = None) -> List[float]:
    """Batch compute semantic similarities for performance."""
    if not skills or not texts:
        return [0.5] * len(texts)
    
    model = get_embedding_model()
    
    # Encode all skills and texts at once
    skill_vecs = model.encode(skills, convert_to_numpy=True, batch_size=32)
    text_vecs = model.encode(texts, convert_to_numpy=True, batch_size=32)
    
    # Compute similarities
    similarities = []
    for i in range(len(skills)):
        sim = cosine_similarity([skill_vecs[i]], [text_vecs[i]])[0][0]
        similarities.append(float(sim))
    
    return similarities


def compute_sentiment_score_batch(comments_list: List[List[str]], 
                                 hf_client: Optional[InferenceClient] = None) -> List[float]:
    """Batch compute sentiment scores for performance."""
    analyzer = get_sentiment_model()
    sentiment_scores = []
    
    for comments in comments_list:
        if not comments:
            sentiment_scores.append(0.5)
            continue
        
        # Sample comments if too many
        sample_comments = comments[:50] if len(comments) > 50 else comments
        
        try:
            results = analyzer(sample_comments, truncation=True)
            positivity = []
            for result in results:
                label = result.get("label", "").upper()
                score = float(result.get("score", 0.0))
                positivity.append(score if label == "POSITIVE" else (1.0 - score))
            
            sentiment_scores.append(float(np.mean(positivity)) if positivity else 0.5)
        except Exception as e:
            logger.warning(f"Sentiment computation failed: {e}")
            sentiment_scores.append(0.5)
    
    return sentiment_scores


def compute_advanced_similarity_score(skill: str, title: str, description: str,
                                     hf_client: Optional[InferenceClient] = None) -> float:
    """Advanced similarity combining title and description relevance."""
    model = get_embedding_model()
    
    skill_vec = model.encode([skill], convert_to_numpy=True)[0]
    title_vec = model.encode([title], convert_to_numpy=True)[0]
    desc_vec = model.encode([description], convert_to_numpy=True)[0]
    
    # Title is more important (60%) than description (40%)
    title_sim = float(cosine_similarity([skill_vec], [title_vec])[0][0])
    desc_sim = float(cosine_similarity([skill_vec], [desc_vec])[0][0])
    
    advanced_sim = (0.6 * title_sim) + (0.4 * desc_sim)
    return float(np.clip(advanced_sim, 0.0, 1.0))


def compute_emotion_sentiment_score(comments: List[str], 
                                   hf_client: Optional[InferenceClient] = None) -> float:
    """Compute emotion-based sentiment for richer analysis."""
    if not comments:
        return 0.5
    
    try:
        # Use emotion model for deeper sentiment understanding
        emotion_analyzer = pipeline("text-classification", model=ADVANCED_SENTIMENT_MODEL)
        sample_comments = comments[:30] if len(comments) > 30 else comments
        
        emotion_scores = []
        for comment in sample_comments:
            try:
                result = emotion_analyzer(comment[:512], truncation=True)
                if result:
                    score = float(result[0].get("score", 0.5))
                    emotion_scores.append(score)
            except:
                continue
        
        return float(np.mean(emotion_scores)) if emotion_scores else 0.5
    except Exception as e:
        logger.warning(f"Emotion sentiment failed: {e}")
        return compute_sentiment_score(comments, hf_client)


def compute_comprehensive_score(engagement: float, similarity: float, sentiment: float,
                               views: int, comment_count: int) -> float:
    """Comprehensive scoring combining all factors with view/comment weighting."""
    # Base weighted score
    base_score = (0.4 * similarity) + (0.35 * engagement) + (0.25 * sentiment)
    
    # Boost for high engagement content
    view_boost = min(float(views) / 100000.0, 0.2)  # Max 20% boost
    comment_boost = min(float(comment_count) / 500.0, 0.15)  # Max 15% boost
    
    comprehensive = base_score + view_boost + comment_boost
    return float(np.clip(comprehensive, 0.0, 1.0))


def batch_processor(items: List[Any], batch_size: int = 32):
    """Generator for batch processing large datasets."""
    for i in range(0, len(items), batch_size):
        yield items[i:i + batch_size]
