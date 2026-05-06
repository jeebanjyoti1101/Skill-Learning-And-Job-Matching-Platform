import os
from typing import Dict, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    auc,
    precision_recall_curve,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split


FEATURE_COLUMNS = ["semantic_similarity", "engagement_score", "sentiment_score"]
ADVANCED_FEATURE_COLUMNS = [
    "semantic_similarity", "engagement_score", "sentiment_score",
    "comprehensive_score", "title_similarity", "content_similarity", "comment_count"
]


def _minmax(series: pd.Series) -> pd.Series:
    min_v = float(series.min())
    max_v = float(series.max())
    if max_v - min_v <= 1e-12:
        # For single/constant batches, keep meaningful magnitude instead of flattening to zero.
        return pd.Series(np.clip(series.astype(float), 0.0, 1.0), index=series.index)
    return (series - min_v) / (max_v - min_v)


def rank_top_resources_realtime(
    dataset: pd.DataFrame,
    top_k_per_skill: int = 5,
    semantic_weight: float = 0.5,
    engagement_weight: float = 0.3,
    sentiment_weight: float = 0.2,
) -> pd.DataFrame:
    """Rank videos from live signals and channel quality.

    Base score uses exactly:
    - cosine similarity
    - like/view ratio
    - comment sentiment

    Then a channel boost is added so channels with consistently strong videos
    get a modest advantage.
    """
    if dataset.empty:
        return dataset

    scored = dataset.copy()

    # Keep only minimally active videos; if all filtered, fallback to original set.
    filtered = scored[scored["views"] >= 500].copy()
    if not filtered.empty:
        scored = filtered

    # Normalize requested core signals.
    scored["semantic_norm"] = _minmax(scored["semantic_similarity"])
    scored["engagement_norm"] = _minmax(scored["engagement_score"])
    scored["sentiment_norm"] = _minmax(scored["sentiment_score"])

    core_total = semantic_weight + engagement_weight + sentiment_weight
    if core_total <= 0:
        semantic_weight, engagement_weight, sentiment_weight = 0.5, 0.3, 0.2
        core_total = 1.0

    # Base score: exact requested three-factor formula.
    scored["base_score"] = (
        semantic_weight * scored["semantic_norm"]
        + engagement_weight * scored["engagement_norm"]
        + sentiment_weight * scored["sentiment_norm"]
    ) / core_total

    # Channel strength: channels with better average base scores + wider presence win.
    if "channel" not in scored.columns:
        scored["channel"] = "Unknown Channel"
    if "channel_subscribers" not in scored.columns:
        scored["channel_subscribers"] = 0

    channel_stats = (
        scored.groupby(["skill", "channel"], as_index=False)
        .agg(
            channel_mean_base=("base_score", "mean"),
            channel_video_count=("video_id", "count"),
            channel_subscribers=("channel_subscribers", "max"),
        )
    )

    # Normalize channel features per skill for fair comparison inside each skill query.
    channel_stats["channel_mean_norm"] = channel_stats.groupby("skill")["channel_mean_base"].transform(_minmax)
    channel_stats["channel_count_norm"] = channel_stats.groupby("skill")["channel_video_count"].transform(_minmax)
    channel_stats["channel_sub_norm"] = channel_stats.groupby("skill")["channel_subscribers"].transform(
        lambda s: _minmax(np.log1p(s.astype(float)))
    )

    channel_stats["channel_strength"] = (
        0.6 * channel_stats["channel_mean_norm"]
        + 0.25 * channel_stats["channel_count_norm"]
        + 0.15 * channel_stats["channel_sub_norm"]
    )

    scored = scored.merge(
        channel_stats[["skill", "channel", "channel_strength"]],
        on=["skill", "channel"],
        how="left",
    )
    scored["channel_strength"] = scored["channel_strength"].fillna(0.0)

    # Final score: mostly three-factor base, with modest channel boost.
    channel_boost_weight = 0.15
    scored["realtime_score"] = (
        (1.0 - channel_boost_weight) * scored["base_score"]
        + channel_boost_weight * scored["channel_strength"]
    )

    scored["semantic_component"] = ((1.0 - channel_boost_weight) * semantic_weight * scored["semantic_norm"]) / core_total
    scored["engagement_component"] = ((1.0 - channel_boost_weight) * engagement_weight * scored["engagement_norm"]) / core_total
    scored["sentiment_component"] = ((1.0 - channel_boost_weight) * sentiment_weight * scored["sentiment_norm"]) / core_total
    scored["channel_component"] = channel_boost_weight * scored["channel_strength"]

    ranked = (
        scored
        .sort_values(["skill", "realtime_score"], ascending=[True, False])
        .groupby("skill", as_index=False)
        .head(top_k_per_skill)
        .reset_index(drop=True)
    )

    # Include comprehensive score in output if available
    output_columns = [
        "skill",
        "video_id",
        "video_title",
        "channel",
        "channel_subscribers",
        "views",
        "likes",
        "engagement_score",
        "semantic_similarity",
        "sentiment_score",
        "comment_count",
        "semantic_component",
        "engagement_component",
        "sentiment_component",
        "channel_component",
        "channel_strength",
        "realtime_score",
    ]

    if "comprehensive_score" in ranked.columns:
        output_columns.insert(-1, "comprehensive_score")

    return ranked[output_columns]


def _positive_class_proba(model: RandomForestClassifier, X: pd.DataFrame) -> np.ndarray:
    """Return probability of label=1, robust to single-class training."""
    proba = model.predict_proba(X)
    classes = list(model.classes_)
    if 1 in classes:
        positive_idx = classes.index(1)
        return proba[:, positive_idx]
    return np.zeros(len(X), dtype=float)


def train_and_evaluate(
    dataset: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = 42,
    output_plot_dir: str = "plots",
) -> Tuple[RandomForestClassifier, Dict[str, float], pd.DataFrame]:
    """Train RandomForest model, compute metrics, and save ROC/PR plots."""
    if dataset.empty:
        raise ValueError("Dataset is empty. Cannot train a model.")

    X = dataset[FEATURE_COLUMNS]
    y = dataset["label"]

    stratify = y if y.nunique() > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    model = RandomForestClassifier(
        n_estimators=200,
        random_state=random_state,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = _positive_class_proba(model, X_test)

    metrics = {
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall": recall_score(y_test, y_pred, zero_division=0),
        "f1": f1_score(y_test, y_pred, zero_division=0),
        "auc": roc_auc_score(y_test, y_prob) if y_test.nunique() > 1 else 0.5,
    }

    os.makedirs(output_plot_dir, exist_ok=True)
    if y_test.nunique() > 1:
        _save_roc_curve(y_test, y_prob, os.path.join(output_plot_dir, "roc_curve.png"))
    _save_pr_curve(y_test, y_prob, os.path.join(output_plot_dir, "precision_recall_curve.png"))

    scored_dataset = dataset.copy()
    scored_dataset["predicted_probability"] = _positive_class_proba(model, dataset[FEATURE_COLUMNS])

    return model, metrics, scored_dataset


def _save_roc_curve(y_true, y_prob, output_path: str) -> None:
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    roc_auc = auc(fpr, tpr)

    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, color="#5DA5DA", linewidth=2.0, label=f"ROC (AUC={roc_auc:.3f})")
    plt.plot([0, 1], [0, 1], "k--", linewidth=1.0)
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curve")
    plt.legend(loc="lower right")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()


def _save_pr_curve(y_true, y_prob, output_path: str) -> None:
    precision, recall, _ = precision_recall_curve(y_true, y_prob)

    plt.figure(figsize=(7, 6))
    plt.plot(recall, precision, color="#2ECC71", linewidth=2.0)
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.title("Precision-Recall Curve")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()


def rank_top_resources(
    scored_dataset: pd.DataFrame,
    top_k_per_skill: int = 5,
) -> pd.DataFrame:
    """Rank videos by predicted probability and return top-k per skill."""
    ranked = (
        scored_dataset
        .sort_values(["skill", "predicted_probability"], ascending=[True, False])
        .groupby("skill", as_index=False)
        .head(top_k_per_skill)
        .reset_index(drop=True)
    )
    return ranked[[
        "skill",
        "video_title",
        "views",
        "likes",
        "engagement_score",
        "semantic_similarity",
        "sentiment_score",
        "comment_count",
        "predicted_probability",
    ]]
