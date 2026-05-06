# SkillMatch AI Learning Resource Training Pipeline

This module builds a complete learning-resource recommendation training pipeline for SkillMatch AI.

It collects video/course data from YouTube Data API v3, computes semantic + engagement + sentiment features, creates labels, trains a RandomForest ranking model, evaluates it, and exports top recommendations.

## 1) Collect Learning Resource Data (Primary Dataset)

Data source: YouTube Data API v3

Collected fields:

- title: semantic matching
- description: semantic similarity
- views: popularity
- likes: engagement score
- comments: sentiment analysis
- channel: credibility proxy

## 2) Collect Comment Data (Sentiment Input)

The pipeline calls YouTube `commentThreads` and stores top comments per video.

## 3) Generate Engagement Features

The pipeline computes:

- engagement_score = likes / views

## 4) Create Training Labels

Heuristic labeling used by the pipeline:

- label = 1 if engagement_score > 0.04 and sentiment_score > 0.6
- otherwise label = 0

## 5) Final Training Dataset Structure

The generated training dataset includes:

- skill
- video_title
- views
- likes
- engagement_score
- semantic_similarity
- sentiment_score
- label

The pipeline also includes alias columns for research experiments:

- similarity
- engagement
- sentiment

## 6) Train the Recommendation Model

Model: RandomForestClassifier

Features:

- semantic_similarity
- engagement_score
- sentiment_score

Target:

- label

Train/test split: scikit-learn `train_test_split`

## 7) Evaluate Model

Exported metrics:

- Precision
- Recall
- F1 score
- AUC

Graphs saved with matplotlib:

- ROC curve
- Precision-Recall curve

## 8) Storage Layout

Outputs are stored in:

- dataset/learning_resources.csv
- dataset/video_comments.csv
- dataset/learning_training_dataset.csv
- dataset/top_recommended_resources.csv
- plots/roc_curve.png
- plots/precision_recall_curve.png

## 9) Minimum Dataset Size Guidance

Recommended for research-quality experiments:

- 200 to 500 videos
- 1000 to 3000 comments

Increase `--videos-per-skill` and `--comments-per-video` to reach this target.

## Setup

1. Open terminal in this folder:

```bash
cd backend/data/learning_pipeline
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Ensure `YOUTUBE_API_KEY` is set in `backend/.env`.

### (Optional) Enable Real-time Hugging Face API

For production real-time inference, add `HF_TOKEN` to `backend/.env`:

```env
YOUTUBE_API_KEY=your_youtube_key
HF_TOKEN=hf_yourTokenHere
```

**Features enabled with HF_TOKEN:**
- Real-time sentiment analysis via InferenceClient
- Real-time semantic similarity via HF API
- Automatic fallback to local models if API fails

**Without HF_TOKEN:** Pipeline uses local `sentence-transformers` (offline, no API key needed)

## Run

```bash
python pipeline.py \
  --skills Python "Machine Learning" React "Data Science" \
  --videos-per-skill 15 \
  --comments-per-video 10 \
  --output-dir dataset \
  --plot-dir plots \
  --top-k 5
```

## Project Modules

- config.py: settings and API key loading
- youtube_client.py: YouTube API collection functions
- feature_engineering.py: engagement, semantic similarity, sentiment, labeling
- dataset_builder.py: raw + feature dataset generation
- modeling.py: model training, evaluation, curve plotting, ranking
- pipeline.py: end-to-end CLI entrypoint
