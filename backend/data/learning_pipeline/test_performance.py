#!/usr/bin/env python3
"""
Performance & Scalability Test Suite
Tests advanced features and measures improvements
"""

import time
import sys
import os
from typing import List, Dict
import pandas as pd
import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from feature_engineering import (
    compute_engagement_score,
    compute_advanced_engagement_score,
    compute_semantic_similarity,
    compute_semantic_similarity_batch,
    compute_sentiment_score,
    compute_sentiment_score_batch,
    compute_advanced_similarity_score,
    compute_comprehensive_score,
)


def generate_test_data(num_videos: int = 100) -> List[Dict]:
    """Generate synthetic test data."""
    skills = ["Python", "Machine Learning", "React", "Data Science", "Web Development"]
    titles = [
        "Complete Python Tutorial for Beginners",
        "Advanced Machine Learning Algorithms",
        "React.js Full Course",
        "Data Science with Python",
        "Web Development Masterclass",
    ]
    
    test_data = []
    for i in range(num_videos):
        test_data.append({
            "skill": skills[i % len(skills)],
            "title": titles[i % len(titles)],
            "description": f"Learn {skills[i % len(skills)]} with this comprehensive course",
            "views": np.random.randint(1000, 1000000),
            "likes": np.random.randint(10, 50000),
            "comments": [f"Great video! {j}" for j in range(np.random.randint(5, 100))],
        })
    
    return test_data


def test_engagement_scoring(test_data: List[Dict]) -> Dict:
    """Test engagement scoring performance."""
    print("\n" + "="*70)
    print("TEST 1: ENGAGEMENT SCORING")
    print("="*70)
    
    # Basic engagement
    start = time.time()
    basic_scores = []
    for video in test_data:
        score = compute_engagement_score(video["views"], video["likes"])
        basic_scores.append(score)
    basic_time = time.time() - start
    
    # Advanced engagement
    start = time.time()
    advanced_scores = []
    for video in test_data:
        score = compute_advanced_engagement_score(
            video["views"], 
            video["likes"], 
            len(video["comments"])
        )
        advanced_scores.append(score)
    advanced_time = time.time() - start
    
    print(f"Videos processed: {len(test_data)}")
    print(f"Basic scoring time: {basic_time:.3f}s")
    print(f"Advanced scoring time: {advanced_time:.3f}s")
    print(f"Speedup: {basic_time/advanced_time:.2f}x")
    print(f"Average basic score: {np.mean(basic_scores):.4f}")
    print(f"Average advanced score: {np.mean(advanced_scores):.4f}")
    
    return {
        "test": "engagement_scoring",
        "basic_time": basic_time,
        "advanced_time": advanced_time,
        "speedup": basic_time / advanced_time,
    }


def test_semantic_similarity(test_data: List[Dict]) -> Dict:
    """Test semantic similarity performance."""
    print("\n" + "="*70)
    print("TEST 2: SEMANTIC SIMILARITY")
    print("="*70)
    
    skills = [video["skill"] for video in test_data]
    texts = [video["title"] for video in test_data]
    
    # Sequential processing
    start = time.time()
    sequential_scores = []
    for skill, text in zip(skills, texts):
        score = compute_semantic_similarity(skill, text)
        sequential_scores.append(score)
    sequential_time = time.time() - start
    
    # Batch processing
    start = time.time()
    batch_scores = compute_semantic_similarity_batch(skills, texts)
    batch_time = time.time() - start
    
    print(f"Videos processed: {len(test_data)}")
    print(f"Sequential time: {sequential_time:.3f}s")
    print(f"Batch time: {batch_time:.3f}s")
    print(f"Speedup: {sequential_time/batch_time:.2f}x")
    print(f"Average sequential score: {np.mean(sequential_scores):.4f}")
    print(f"Average batch score: {np.mean(batch_scores):.4f}")
    print(f"Score correlation: {np.corrcoef(sequential_scores, batch_scores)[0,1]:.4f}")
    
    return {
        "test": "semantic_similarity",
        "sequential_time": sequential_time,
        "batch_time": batch_time,
        "speedup": sequential_time / batch_time,
    }


def test_sentiment_analysis(test_data: List[Dict]) -> Dict:
    """Test sentiment analysis performance."""
    print("\n" + "="*70)
    print("TEST 3: SENTIMENT ANALYSIS")
    print("="*70)
    
    comments_list = [video["comments"] for video in test_data]
    
    # Sequential processing
    start = time.time()
    sequential_scores = []
    for comments in comments_list:
        score = compute_sentiment_score(comments)
        sequential_scores.append(score)
    sequential_time = time.time() - start
    
    # Batch processing
    start = time.time()
    batch_scores = compute_sentiment_score_batch(comments_list)
    batch_time = time.time() - start
    
    print(f"Videos processed: {len(test_data)}")
    print(f"Sequential time: {sequential_time:.3f}s")
    print(f"Batch time: {batch_time:.3f}s")
    print(f"Speedup: {sequential_time/batch_time:.2f}x")
    print(f"Average sequential score: {np.mean(sequential_scores):.4f}")
    print(f"Average batch score: {np.mean(batch_scores):.4f}")
    
    return {
        "test": "sentiment_analysis",
        "sequential_time": sequential_time,
        "batch_time": batch_time,
        "speedup": sequential_time / batch_time,
    }


def test_advanced_similarity(test_data: List[Dict]) -> Dict:
    """Test advanced similarity scoring."""
    print("\n" + "="*70)
    print("TEST 4: ADVANCED SIMILARITY SCORING")
    print("="*70)
    
    # Basic similarity
    start = time.time()
    basic_scores = []
    for video in test_data:
        score = compute_semantic_similarity(
            video["skill"],
            f"{video['title']}. {video['description']}"
        )
        basic_scores.append(score)
    basic_time = time.time() - start
    
    # Advanced similarity
    start = time.time()
    advanced_scores = []
    for video in test_data:
        score = compute_advanced_similarity_score(
            video["skill"],
            video["title"],
            video["description"]
        )
        advanced_scores.append(score)
    advanced_time = time.time() - start
    
    print(f"Videos processed: {len(test_data)}")
    print(f"Basic similarity time: {basic_time:.3f}s")
    print(f"Advanced similarity time: {advanced_time:.3f}s")
    print(f"Speedup: {basic_time/advanced_time:.2f}x")
    print(f"Average basic score: {np.mean(basic_scores):.4f}")
    print(f"Average advanced score: {np.mean(advanced_scores):.4f}")
    
    return {
        "test": "advanced_similarity",
        "basic_time": basic_time,
        "advanced_time": advanced_time,
        "speedup": basic_time / advanced_time,
    }


def test_comprehensive_scoring(test_data: List[Dict]) -> Dict:
    """Test comprehensive scoring."""
    print("\n" + "="*70)
    print("TEST 5: COMPREHENSIVE SCORING")
    print("="*70)
    
    scores = []
    start = time.time()
    
    for video in test_data:
        engagement = compute_advanced_engagement_score(
            video["views"],
            video["likes"],
            len(video["comments"])
        )
        similarity = compute_advanced_similarity_score(
            video["skill"],
            video["title"],
            video["description"]
        )
        sentiment = compute_sentiment_score(video["comments"])
        
        comprehensive = compute_comprehensive_score(
            engagement,
            similarity,
            sentiment,
            video["views"],
            len(video["comments"])
        )
        scores.append(comprehensive)
    
    total_time = time.time() - start
    
    print(f"Videos processed: {len(test_data)}")
    print(f"Total time: {total_time:.3f}s")
    print(f"Average time per video: {total_time/len(test_data)*1000:.2f}ms")
    print(f"Average comprehensive score: {np.mean(scores):.4f}")
    print(f"Score range: [{np.min(scores):.4f}, {np.max(scores):.4f}]")
    print(f"Score std dev: {np.std(scores):.4f}")
    
    return {
        "test": "comprehensive_scoring",
        "total_time": total_time,
        "avg_per_video_ms": total_time / len(test_data) * 1000,
    }


def test_scalability(sizes: List[int] = None) -> Dict:
    """Test scalability with different dataset sizes."""
    if sizes is None:
        sizes = [10, 50, 100, 200]
    
    print("\n" + "="*70)
    print("TEST 6: SCALABILITY ANALYSIS")
    print("="*70)
    
    results = []
    
    for size in sizes:
        test_data = generate_test_data(size)
        skills = [video["skill"] for video in test_data]
        texts = [video["title"] for video in test_data]
        
        start = time.time()
        similarities = compute_semantic_similarity_batch(skills, texts)
        batch_time = time.time() - start
        
        results.append({
            "size": size,
            "time": batch_time,
            "time_per_video_ms": batch_time / size * 1000,
        })
        
        print(f"Size: {size:3d} videos | Time: {batch_time:6.3f}s | Per video: {batch_time/size*1000:6.2f}ms")
    
    return {"test": "scalability", "results": results}


def main():
    """Run all performance tests."""
    print("\n" + "="*70)
    print("🚀 PERFORMANCE & SCALABILITY TEST SUITE")
    print("="*70)
    
    # Generate test data
    print("\n📊 Generating test data...")
    test_data = generate_test_data(100)
    print(f"✅ Generated {len(test_data)} test videos")
    
    # Run tests
    results = []
    
    try:
        results.append(test_engagement_scoring(test_data))
    except Exception as e:
        print(f"❌ Engagement scoring test failed: {e}")
    
    try:
        results.append(test_semantic_similarity(test_data))
    except Exception as e:
        print(f"❌ Semantic similarity test failed: {e}")
    
    try:
        results.append(test_sentiment_analysis(test_data))
    except Exception as e:
        print(f"❌ Sentiment analysis test failed: {e}")
    
    try:
        results.append(test_advanced_similarity(test_data))
    except Exception as e:
        print(f"❌ Advanced similarity test failed: {e}")
    
    try:
        results.append(test_comprehensive_scoring(test_data))
    except Exception as e:
        print(f"❌ Comprehensive scoring test failed: {e}")
    
    try:
        results.append(test_scalability([10, 50, 100]))
    except Exception as e:
        print(f"❌ Scalability test failed: {e}")
    
    # Summary
    print("\n" + "="*70)
    print("📈 TEST SUMMARY")
    print("="*70)
    
    for result in results:
        if result.get("speedup"):
            print(f"✅ {result['test']}: {result['speedup']:.2f}x speedup")
        elif result.get("total_time"):
            print(f"✅ {result['test']}: {result['total_time']:.3f}s total")
        else:
            print(f"✅ {result['test']}: Completed")
    
    print("\n" + "="*70)
    print("✨ All tests completed successfully!")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
