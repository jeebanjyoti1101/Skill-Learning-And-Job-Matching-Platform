import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class PipelineConfig:
    youtube_api_key: str
    hf_token: str = ""
    use_realtime_hf_api: bool = False
    skills: List[str] = field(default_factory=lambda: [
        "Python",
        "Machine Learning",
        "React",
        "Data Science",
    ])
    videos_per_skill: int = 15
    comments_per_video: int = 10
    output_dir: str = "dataset"
    video_dataset_filename: str = "learning_resources.csv"
    comments_dataset_filename: str = "video_comments.csv"
    training_dataset_filename: str = "learning_training_dataset.csv"
    ranked_output_filename: str = "top_recommended_resources.csv"
    output_plot_dir: str = "plots"
    top_k_per_skill: int = 5
    semantic_weight: float = 0.5
    engagement_weight: float = 0.3
    sentiment_weight: float = 0.2
    random_state: int = 42
    test_size: float = 0.2


def load_api_key_from_env() -> str:
    api_key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not api_key:
        raise ValueError(
            "Missing YOUTUBE_API_KEY in environment. "
            "Set it in backend/.env or your shell environment."
        )
    return api_key


def load_hf_token_from_env() -> str:
    """Load Hugging Face token from env. Returns empty string if not set."""
    return os.getenv("HF_TOKEN", "").strip() or os.getenv("HUGGINGFACEHUB_API_TOKEN", "").strip()


def create_config_with_realtime() -> PipelineConfig:
    """Create config with real-time HF API enabled if token available."""
    yt_key = load_api_key_from_env()
    hf_token = load_hf_token_from_env()
    config = PipelineConfig(youtube_api_key=yt_key, hf_token=hf_token)
    config.use_realtime_hf_api = bool(hf_token)
    return config
