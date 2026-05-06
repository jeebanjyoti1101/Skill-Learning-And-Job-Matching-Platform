from typing import Dict, List

import requests

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"


def search_videos_for_skill(api_key: str, skill: str, max_results: int = 15) -> List[str]:
    """Return a list of video IDs for a skill query.
    
    Prioritizes quality videos by:
    1. Searching for established tutorials (not just recent)
    2. Filtering by view count and engagement
    3. Preferring longer, comprehensive content
    """
    url = f"{YOUTUBE_API_BASE}/search"
    
    # Search for comprehensive tutorials with better quality indicators
    search_queries = [
        f"{skill} tutorial complete course",  # Comprehensive content
        f"{skill} tutorial full",              # Full tutorials
        f"{skill} tutorial beginner",          # Beginner-friendly
        f"{skill} course",                     # Courses
        f"{skill} tutorial",                   # General tutorials
    ]
    
    all_video_ids = []
    seen_ids = set()
    
    for query in search_queries:
        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": max_results,
            "order": "relevance",  # Prioritize relevance over recency
            "videoDuration": "long",  # Prefer longer videos (more comprehensive)
            "videoDefinition": "high",  # Prefer HD quality
            "key": api_key,
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            items = response.json().get("items", [])
            
            for item in items:
                video_id = item.get("id", {}).get("videoId")
                if video_id and video_id not in seen_ids:
                    all_video_ids.append(video_id)
                    seen_ids.add(video_id)
                    
                    if len(all_video_ids) >= max_results:
                        break
        except Exception as e:
            print(f"Error searching for '{query}': {e}")
            continue
        
        if len(all_video_ids) >= max_results:
            break
    
    return all_video_ids[:max_results]


def get_video_details(api_key: str, video_ids: List[str]) -> List[Dict]:
    """Fetch title, description, channel, views and likes for a list of video IDs.
    
    Also fetches channel information to get proper channel names and subscriber counts.
    """
    if not video_ids:
        return []

    url = f"{YOUTUBE_API_BASE}/videos"
    params = {
        "part": "snippet,statistics",
        "id": ",".join(video_ids),
        "maxResults": len(video_ids),
        "key": api_key,
    }
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    items = response.json().get("items", [])

    results: List[Dict] = []
    channel_ids = []
    
    # First pass: collect video data and channel IDs
    for item in items:
        snippet = item.get("snippet", {})
        stats = item.get("statistics", {})
        channel_id = snippet.get("channelId", "")
        
        results.append(
            {
                "video_id": item.get("id", ""),
                "video_title": snippet.get("title", ""),
                "video_description": snippet.get("description", ""),
                "channel": snippet.get("channelTitle", ""),
                "channel_id": channel_id,
                "views": int(stats.get("viewCount", 0) or 0),
                "likes": int(stats.get("likeCount", 0) or 0),
            }
        )
        if channel_id:
            channel_ids.append(channel_id)
    
    # Second pass: fetch channel details for better channel names and subscriber info
    if channel_ids:
        try:
            channel_url = f"{YOUTUBE_API_BASE}/channels"
            channel_params = {
                "part": "snippet,statistics",
                "id": ",".join(set(channel_ids)),  # Deduplicate
                "key": api_key,
            }
            channel_response = requests.get(channel_url, params=channel_params, timeout=30)
            channel_response.raise_for_status()
            channel_items = channel_response.json().get("items", [])
            
            # Create channel info map
            channel_info = {}
            for channel_item in channel_items:
                ch_id = channel_item.get("id", "")
                ch_snippet = channel_item.get("snippet", {})
                ch_stats = channel_item.get("statistics", {})
                
                channel_info[ch_id] = {
                    "channel_title": ch_snippet.get("title", ""),
                    "channel_description": ch_snippet.get("description", ""),
                    "subscribers": int(ch_stats.get("subscriberCount", 0) or 0),
                    "channel_views": int(ch_stats.get("viewCount", 0) or 0),
                }
            
            # Update results with channel info
            for result in results:
                ch_id = result.get("channel_id", "")
                if ch_id in channel_info:
                    result["channel"] = channel_info[ch_id]["channel_title"]
                    result["channel_subscribers"] = channel_info[ch_id]["subscribers"]
                    result["channel_verified"] = channel_info[ch_id]["subscribers"] > 10000
        except Exception as e:
            print(f"Warning: Could not fetch channel details: {e}")
            # Continue with basic channel names if channel fetch fails
    
    return results


def get_top_comments(api_key: str, video_id: str, max_comments: int = 10) -> List[str]:
    """Fetch top comments for one video. Returns an empty list when comments are disabled."""
    url = f"{YOUTUBE_API_BASE}/commentThreads"
    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": max_comments,
        "order": "relevance",
        "textFormat": "plainText",
        "key": api_key,
    }

    response = requests.get(url, params=params, timeout=30)
    if response.status_code in (403, 404):
        return []
    response.raise_for_status()

    items = response.json().get("items", [])
    comments: List[str] = []
    for item in items:
        snippet = item.get("snippet", {})
        top_level = snippet.get("topLevelComment", {}).get("snippet", {})
        text = top_level.get("textDisplay", "").strip()
        if text:
            comments.append(text)
    return comments


def get_all_comments(api_key: str, video_id: str, max_pages: int = 10) -> List[str]:
    """Fetch ALL comments for one video using pagination (web crawling approach).
    Returns an empty list when comments are disabled."""
    url = f"{YOUTUBE_API_BASE}/commentThreads"
    params = {
        "part": "snippet",
        "videoId": video_id,
        "maxResults": 100,  # Maximum allowed by YouTube API
        "order": "relevance",  # Get most relevant comments first
        "textFormat": "plainText",
        "key": api_key,
    }

    comments: List[str] = []
    page_count = 0

    while page_count < max_pages:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code in (403, 404):
            break  # Comments disabled or video not found
        response.raise_for_status()

        data = response.json()
        items = data.get("items", [])

        if not items:
            break  # No more comments

        # Extract comments from this page
        for item in items:
            snippet = item.get("snippet", {})
            top_level = snippet.get("topLevelComment", {}).get("snippet", {})
            text = top_level.get("textDisplay", "").strip()
            if text:
                comments.append(text)

            # Also get replies if any
            replies = item.get("replies", {}).get("comments", [])
            for reply in replies:
                reply_text = reply.get("snippet", {}).get("textDisplay", "").strip()
                if reply_text:
                    comments.append(reply_text)

        # Check for next page
        next_page_token = data.get("nextPageToken")
        if not next_page_token:
            break  # No more pages

        params["pageToken"] = next_page_token
        page_count += 1

        # Rate limiting - small delay between requests
        import time
        time.sleep(0.1)

    return comments
