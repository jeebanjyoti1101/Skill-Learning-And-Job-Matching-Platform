from typing import Dict, List, Optional
import time

import pandas as pd
from huggingface_hub import InferenceClient

from feature_engineering import (
    compute_engagement_score,
    compute_semantic_similarity,
    compute_sentiment_score,
    generate_label,
    compute_advanced_engagement_score,
    compute_semantic_similarity_batch,
    compute_sentiment_score_batch,
    compute_advanced_similarity_score,
    compute_emotion_sentiment_score,
    compute_comprehensive_score,
    batch_processor,
)
from youtube_client import get_all_comments, get_top_comments, get_video_details, search_videos_for_skill


def collect_videos_for_skills(
    api_key: str,
    skills: List[str],
    videos_per_skill: int,
    comments_per_video: int,
    use_all_comments: bool = False,
) -> List[Dict]:
    """Collect raw video metadata and comments for each skill."""
    rows: List[Dict] = []

    for skill in skills:
        video_ids = search_videos_for_skill(api_key, skill, videos_per_skill)
        video_details = get_video_details(api_key, video_ids)

        for video in video_details:
            if use_all_comments:
                # Fetch ALL comments using web crawling approach
                comments = get_all_comments(api_key, video["video_id"], max_pages=10)  # Default 10 pages
                print(f"[INFO] Collected {len(comments)} comments for video: {video['video_title'][:50]}...")
            else:
                # Fetch only top comments (original behavior)
                comments = get_top_comments(api_key, video["video_id"], comments_per_video)

            rows.append(
                {
                    "skill": skill,
                    **video,
                    "comments": comments,
                    "comment_count": len(comments),
                }
            )

    return rows


def build_raw_datasets(raw_rows: List[Dict]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create separate raw datasets for videos and comments."""
    video_records: List[Dict] = []
    comment_records: List[Dict] = []

    for row in raw_rows:
        video_records.append(
            {
                "skill": row.get("skill", ""),
                "video_id": row.get("video_id", ""),
                "title": row.get("video_title", ""),
                "description": row.get("video_description", ""),
                "channel": row.get("channel", ""),
                "views": int(row.get("views", 0) or 0),
                "likes": int(row.get("likes", 0) or 0),
            }
        )

        for comment in row.get("comments", []) or []:
            comment_records.append(
                {
                    "skill": row.get("skill", ""),
                    "video_id": row.get("video_id", ""),
                    "comment": comment,
                }
            )

    videos_df = pd.DataFrame(video_records)
    comments_df = pd.DataFrame(comment_records)
    return videos_df, comments_df


def build_feature_dataset(raw_rows: List[Dict], hf_client: Optional[InferenceClient] = None,
                         use_advanced_features: bool = True) -> pd.DataFrame:
    """Convert raw rows into ML-ready dataset with engineered features.

    Args:
        raw_rows: List of raw video/comment data
        hf_client: Optional InferenceClient for real-time HF API calls
        use_advanced_features: Whether to use advanced performance features
    """
    if not raw_rows:
        return pd.DataFrame()

        print(f"[INFO] Processing {len(raw_rows)} videos with advanced features..." if use_advanced_features
            else f"[INFO] Processing {len(raw_rows)} videos with basic features...")

    start_time = time.time()

    if use_advanced_features:
        # Advanced batch processing for better performance
        records = build_feature_dataset_advanced(raw_rows, hf_client)
    else:
        # Basic processing (original method)
        records = build_feature_dataset_basic(raw_rows, hf_client)

    processing_time = time.time() - start_time
    print(f"[OK] Feature engineering completed in {processing_time:.2f}s")

    return pd.DataFrame(records)


def build_feature_dataset_basic(raw_rows: List[Dict], hf_client: Optional[InferenceClient] = None) -> List[Dict]:
    """Basic feature engineering (original method)."""
    records = []

    for row in raw_rows:
        skill = row["skill"]
        title = row.get("video_title", "")
        description = row.get("video_description", "")
        views = int(row.get("views", 0) or 0)
        likes = int(row.get("likes", 0) or 0)
        comments = row.get("comments", []) or []

        content_text = f"{title}. {description}"

        engagement_score = compute_engagement_score(views, likes)
        semantic_similarity = compute_semantic_similarity(skill, content_text, hf_client=hf_client)
        sentiment_score = compute_sentiment_score(comments, hf_client=hf_client)
        label = generate_label(engagement_score, sentiment_score)

        records.append({
            "skill": skill,
            "video_id": row.get("video_id", ""),
            "video_title": title,
            "video_description": description,
            "channel": row.get("channel", ""),
            "channel_subscribers": int(row.get("channel_subscribers", 0) or 0),
            "channel_verified": int(bool(row.get("channel_verified", False))),
            "views": views,
            "likes": likes,
            "engagement_score": engagement_score,
            "semantic_similarity": semantic_similarity,
            "sentiment_score": sentiment_score,
            "comment_count": len(comments),
            "engagement": engagement_score,
            "similarity": semantic_similarity,
            "sentiment": sentiment_score,
            "label": label,
        })

    return records


def build_feature_dataset_advanced(raw_rows: List[Dict], hf_client: Optional[InferenceClient] = None) -> List[Dict]:
    """Advanced feature engineering with performance optimizations."""
    records = []

    # Prepare data for batch processing
    skills = [row["skill"] for row in raw_rows]
    titles = [row.get("video_title", "") for row in raw_rows]
    descriptions = [row.get("video_description", "") for row in raw_rows]
    views_list = [int(row.get("views", 0) or 0) for row in raw_rows]
    likes_list = [int(row.get("likes", 0) or 0) for row in raw_rows]
    comments_list = [row.get("comments", []) or [] for row in raw_rows]

    # Batch compute similarities (title + description)
    print("[INFO] Computing semantic similarities...")
    title_similarities = compute_semantic_similarity_batch(skills, titles, hf_client)
    content_texts = [f"{title}. {desc}" for title, desc in zip(titles, descriptions)]
    content_similarities = compute_semantic_similarity_batch(skills, content_texts, hf_client)

    # Compute advanced similarities
    advanced_similarities = []
    for i, (skill, title, desc) in enumerate(zip(skills, titles, descriptions)):
        adv_sim = compute_advanced_similarity_score(skill, title, desc, hf_client)
        advanced_similarities.append(adv_sim)

    # Batch compute sentiment scores
    print("[INFO] Computing sentiment scores...")
    sentiment_scores = compute_sentiment_score_batch(comments_list, hf_client)

    # Compute emotion-based sentiment for high-comment videos
    emotion_sentiments = []
    for comments in comments_list:
        if len(comments) > 20:  # Only for videos with many comments
            emotion_score = compute_emotion_sentiment_score(comments, hf_client)
            emotion_sentiments.append(emotion_score)
        else:
            emotion_sentiments.append(None)

    # Process each video with advanced features
    for i, row in enumerate(raw_rows):
        skill = skills[i]
        title = titles[i]
        description = descriptions[i]
        views = views_list[i]
        likes = likes_list[i]
        comments = comments_list[i]

        # Advanced engagement score
        engagement_score = compute_advanced_engagement_score(views, likes, len(comments))

        # Use advanced similarity
        semantic_similarity = advanced_similarities[i]

        # Use emotion sentiment if available, otherwise regular sentiment
        sentiment_score = emotion_sentiments[i] if emotion_sentiments[i] is not None else sentiment_scores[i]

        # Comprehensive scoring
        comprehensive_score = compute_comprehensive_score(
            engagement_score, semantic_similarity, sentiment_score, views, len(comments)
        )

        label = generate_label(engagement_score, sentiment_score)

        records.append({
            "skill": skill,
            "video_id": row.get("video_id", ""),
            "video_title": title,
            "video_description": description,
            "channel": row.get("channel", ""),
            "channel_subscribers": int(row.get("channel_subscribers", 0) or 0),
            "channel_verified": int(bool(row.get("channel_verified", False))),
            "views": views,
            "likes": likes,
            "engagement_score": engagement_score,
            "semantic_similarity": semantic_similarity,
            "sentiment_score": sentiment_score,
            "comment_count": len(comments),
            "comprehensive_score": comprehensive_score,
            "title_similarity": title_similarities[i],
            "content_similarity": content_similarities[i],
            "engagement": engagement_score,
            "similarity": semantic_similarity,
            "sentiment": sentiment_score,
            "label": label,
        })

    return records
