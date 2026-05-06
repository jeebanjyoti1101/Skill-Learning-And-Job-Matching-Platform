import argparse
import logging
import os

from dotenv import load_dotenv

from config import PipelineConfig, create_config_with_realtime
from feature_engineering import get_hf_client
from dataset_builder import (
    build_feature_dataset,
    collect_videos_for_skills,
)
from modeling import rank_top_resources_realtime

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SkillMatch AI real-time learning-resource recommendation pipeline"
    )
    parser.add_argument(
        "--skills",
        nargs="+",
        default=["Python", "Machine Learning", "React", "Data Science"],
        help="List of skills to query from YouTube",
    )
    parser.add_argument("--videos-per-skill", type=int, default=15)
    parser.add_argument("--comments-per-video", type=int, default=10)
    parser.add_argument("--output-dir", default="dataset")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--semantic-weight", type=float, default=0.5)
    parser.add_argument("--engagement-weight", type=float, default=0.3)
    parser.add_argument("--sentiment-weight", type=float, default=0.2)
    parser.add_argument("--use-all-comments", action="store_true",
                       help="Fetch ALL comments for each video (web crawling mode)")
    parser.add_argument("--max-comment-pages", type=int, default=10,
                       help="Maximum pages of comments to fetch when using --use-all-comments")
    return parser.parse_args()


def run_pipeline(config: PipelineConfig) -> None:
    os.makedirs(config.output_dir, exist_ok=True)
    
    # Initialize HF client if realtime API is enabled
    hf_client = None
    if config.use_realtime_hf_api:
        hf_client = get_hf_client(config.hf_token)
        if hf_client:
            print("[OK] Real-time Hugging Face API enabled")
        else:
            print("[WARN] Hugging Face API initialization failed, using local models")

    raw_rows = collect_videos_for_skills(
        api_key=config.youtube_api_key,
        skills=config.skills,
        videos_per_skill=config.videos_per_skill,
        comments_per_video=config.comments_per_video,
        use_all_comments=config.use_all_comments,
    )

    dataset = build_feature_dataset(raw_rows, hf_client=hf_client)
    if dataset.empty:
        raise RuntimeError("No videos were collected. Check API key or query parameters.")

    ranked = rank_top_resources_realtime(
        dataset,
        top_k_per_skill=config.top_k_per_skill,
        semantic_weight=config.semantic_weight,
        engagement_weight=config.engagement_weight,
        sentiment_weight=config.sentiment_weight,
    )
    ranked_path = os.path.join(config.output_dir, config.ranked_output_filename)
    ranked.to_csv(ranked_path, index=False)

    print(f"\nSaved top recommendations: {ranked_path}")
    print("\nTop recommendations by skill:")
    for skill, group in ranked.groupby("skill"):
        print(f"\n{skill}:")
        for _, row in group.iterrows():
            title = str(row["video_title"])
            # Keep console output safe on Windows code pages while preserving CSV content.
            title_safe = title.encode("cp1252", errors="replace").decode("cp1252")
            score = row["realtime_score"]
            print(f"  - {title_safe} (score={score:.4f})")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    load_dotenv(dotenv_path=env_path)
    args = parse_args()

    try:
        config = create_config_with_realtime()
        # Override with CLI args if provided
        if args.skills:
            config.skills = args.skills
        if args.videos_per_skill:
            config.videos_per_skill = args.videos_per_skill
        if args.comments_per_video:
            config.comments_per_video = args.comments_per_video
        config.output_dir = args.output_dir
        config.top_k_per_skill = args.top_k
        config.semantic_weight = args.semantic_weight
        config.engagement_weight = args.engagement_weight
        config.sentiment_weight = args.sentiment_weight
        config.use_all_comments = args.use_all_comments
        config.max_comment_pages = args.max_comment_pages
    except ValueError as e:
        print(f"Error: {e}")
        return

    run_pipeline(config)


if __name__ == "__main__":
    main()
