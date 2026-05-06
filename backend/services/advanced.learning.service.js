import axios from "axios";
import LearningResource from "../models/LearningResource.js";

/**
 * ========================================================================
 * ADVANCED YOUTUBE LEARNING RESOURCE SERVICE
 * ========================================================================
 * Fetches YouTube videos with advanced scoring:
 * 1. Cosine Similarity (semantic relevance)
 * 2. Like/View Ratio (engagement)
 * 3. Comment Sentiment Analysis (community feedback)
 * 
 * Returns the BEST video from each channel based on combined score
 * ========================================================================
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Fetch videos from YouTube with full details
 */
async function fetchYouTubeVideos(skill, maxResults = 20) {
  if (!process.env.YOUTUBE_API_KEY) {
    console.log('⚠️ YouTube API key not configured');
    return [];
  }

  try {
    console.log(`🔍 Fetching YouTube videos for: ${skill}`);
    
    // Search for comprehensive tutorials
    const searchQuery = `${skill} tutorial complete course`;
    
    const searchResponse = await axios.get(`${YOUTUBE_API_BASE}/search`, {
      params: {
        part: 'snippet',
        q: searchQuery,
        maxResults: maxResults,
        type: 'video',
        videoDuration: 'long',
        videoDefinition: 'high',
        order: 'relevance',
        relevanceLanguage: 'en',
        key: process.env.YOUTUBE_API_KEY
      },
      timeout: 10000
    });

    const videoIds = searchResponse.data.items
      .map(item => item.id.videoId)
      .filter(id => id);

    if (videoIds.length === 0) {
      console.log('⚠️ No videos found');
      return [];
    }

    console.log(`✅ Found ${videoIds.length} videos, fetching details...`);

    // Fetch video statistics
    const videoResponse = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: 'snippet,statistics',
        id: videoIds.join(','),
        key: process.env.YOUTUBE_API_KEY
      },
      timeout: 10000
    });

    const videos = [];
    for (const item of videoResponse.data.items) {
      const snippet = item.snippet;
      const stats = item.statistics;
      
      videos.push({
        video_id: item.id,
        video_title: snippet.title,
        video_description: snippet.description,
        channel: snippet.channelTitle,
        channel_id: snippet.channelId,
        views: parseInt(stats.viewCount || 0),
        likes: parseInt(stats.likeCount || 0),
        comments_count: parseInt(stats.commentCount || 0),
        thumbnail: snippet.thumbnails.high?.url,
        published_at: snippet.publishedAt,
        skill: skill
      });
    }

    console.log(`✅ Fetched details for ${videos.length} videos`);
    return videos;
  } catch (error) {
    console.error('❌ YouTube API Error:', error.message);
    return [];
  }
}

/**
 * Fetch comments for a video
 */
async function fetchVideoComments(videoId, maxComments = 100) {
  if (!process.env.YOUTUBE_API_KEY) {
    return [];
  }

  try {
    const comments = [];
    let pageToken = null;
    let commentCount = 0;

    while (commentCount < maxComments) {
      const response = await axios.get(`${YOUTUBE_API_BASE}/commentThreads`, {
        params: {
          part: 'snippet',
          videoId: videoId,
          maxResults: Math.min(100, maxComments - commentCount),
          order: 'relevance',
          textFormat: 'plainText',
          pageToken: pageToken,
          key: process.env.YOUTUBE_API_KEY
        },
        timeout: 10000
      });

      const items = response.data.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        const topComment = item.snippet.topLevelComment.snippet;
        comments.push(topComment.textDisplay);
        commentCount++;

        // Also get replies
        const replyCount = item.snippet.totalReplyCount || 0;
        if (replyCount > 0 && item.replies) {
          for (const reply of item.replies.comments || []) {
            if (commentCount < maxComments) {
              comments.push(reply.snippet.textDisplay);
              commentCount++;
            }
          }
        }
      }

      pageToken = response.data.nextPageToken;
      if (!pageToken) break;
    }

    console.log(`✅ Fetched ${comments.length} comments for video ${videoId}`);
    return comments;
  } catch (error) {
    console.error(`⚠️ Error fetching comments for ${videoId}:`, error.message);
    return [];
  }
}

/**
 * Calculate cosine similarity between skill and content
 */
function calculateCosineSimilarity(skill, title, description) {
  // Simple keyword matching for cosine similarity
  const skillWords = skill.toLowerCase().split(/\s+/);
  const contentText = `${title} ${description}`.toLowerCase();
  
  let matches = 0;
  for (const word of skillWords) {
    if (contentText.includes(word)) {
      matches++;
    }
  }
  
  // Normalize to 0-1 range
  const similarity = Math.min(matches / skillWords.length, 1.0);
  
  // Boost if title contains skill
  if (title.toLowerCase().includes(skill.toLowerCase())) {
    return Math.min(similarity + 0.3, 1.0);
  }
  
  return similarity;
}

/**
 * Calculate engagement score (likes/views ratio)
 */
function calculateEngagementScore(views, likes) {
  if (views <= 0) return 0;
  return Math.min(likes / views, 1.0);
}

/**
 * Analyze sentiment of comments (simple implementation)
 */
function analyzeCommentSentiment(comments) {
  if (comments.length === 0) return 0.5;

  const positiveWords = ['great', 'excellent', 'amazing', 'love', 'best', 'perfect', 'helpful', 'thanks', 'awesome', 'good', 'nice', 'clear', 'easy', 'understand', 'learned', 'useful'];
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'confusing', 'unclear', 'hard', 'difficult', 'waste', 'poor', 'useless', 'boring'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const comment of comments) {
    const lowerComment = comment.toLowerCase();
    
    for (const word of positiveWords) {
      if (lowerComment.includes(word)) positiveCount++;
    }
    
    for (const word of negativeWords) {
      if (lowerComment.includes(word)) negativeCount++;
    }
  }

  const totalSentiment = positiveCount + negativeCount;
  if (totalSentiment === 0) return 0.5;

  const sentimentScore = positiveCount / totalSentiment;
  return Math.min(Math.max(sentimentScore, 0), 1.0);
}

/**
 * Calculate combined score for a video
 */
function calculateCombinedScore(video, comments, skill, weights = {}) {
  const {
    semanticWeight = 0.5,
    engagementWeight = 0.3,
    sentimentWeight = 0.2
  } = weights;

  // Calculate individual scores
  const semanticScore = calculateCosineSimilarity(skill, video.video_title, video.video_description);
  const engagementScore = calculateEngagementScore(video.views, video.likes);
  const sentimentScore = analyzeCommentSentiment(comments);

  // Normalize scores
  const totalWeight = semanticWeight + engagementWeight + sentimentWeight;
  const combinedScore = (
    (semanticScore * semanticWeight) +
    (engagementScore * engagementWeight) +
    (sentimentScore * sentimentWeight)
  ) / totalWeight;

  return {
    semantic_score: semanticScore,
    engagement_score: engagementScore,
    sentiment_score: sentimentScore,
    combined_score: combinedScore
  };
}

/**
 * Get best video from each channel
 */
async function getBestVideosByChannel(skill, maxResults = 6, weights = {}) {
  try {
    console.log(`🎬 Fetching best videos for: ${skill}`);

    // Fetch videos
    const videos = await fetchYouTubeVideos(skill, maxResults * 3);
    
    if (videos.length === 0) {
      console.log('⚠️ No videos found');
      return [];
    }

    // Fetch comments and calculate scores for each video
    const scoredVideos = [];
    
    for (const video of videos) {
      try {
        // Fetch comments
        const comments = await fetchVideoComments(video.video_id, 100);
        
        // Calculate scores
        const scores = calculateCombinedScore(video, comments, skill, weights);
        
        scoredVideos.push({
          ...video,
          comments_count: comments.length,
          ...scores
        });
      } catch (error) {
        console.error(`Error processing video ${video.video_id}:`, error.message);
        // Continue with next video
      }
    }

    // Group by channel and get best from each
    const channelMap = {};
    for (const video of scoredVideos) {
      const channel = video.channel;
      
      if (!channelMap[channel] || video.combined_score > channelMap[channel].combined_score) {
        channelMap[channel] = video;
      }
    }

    // Convert to array and sort by combined score
    const bestVideos = Object.values(channelMap)
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, maxResults);

    console.log(`✅ Found ${bestVideos.length} best videos from different channels`);
    return bestVideos;
  } catch (error) {
    console.error('❌ Error getting best videos:', error.message);
    return [];
  }
}

/**
 * Main endpoint: Get ranked YouTube videos
 */
export const getRankedYouTubeVideos = async (skill, options = {}) => {
  try {
    const {
      maxResults = 6,
      semanticWeight = 0.5,
      engagementWeight = 0.3,
      sentimentWeight = 0.2
    } = options;

    console.log(`\n🎯 Getting ranked YouTube videos for: ${skill}`);
    console.log(`📊 Weights - Semantic: ${semanticWeight}, Engagement: ${engagementWeight}, Sentiment: ${sentimentWeight}`);

    const weights = {
      semanticWeight,
      engagementWeight,
      sentimentWeight
    };

    const videos = await getBestVideosByChannel(skill, maxResults, weights);

    if (videos.length === 0) {
      return {
        success: false,
        message: `No videos found for ${skill}`,
        skill: skill,
        resources: []
      };
    }

    return {
      success: true,
      message: `Found ${videos.length} best videos from different channels`,
      skill: skill,
      count: videos.length,
      weights: weights,
      resources: videos.map(v => ({
        video_id: v.video_id,
        title: v.video_title,
        channel: v.channel,
        views: v.views,
        likes: v.likes,
        comments_count: v.comments_count,
        thumbnail: v.thumbnail,
        link: `https://www.youtube.com/watch?v=${v.video_id}`,
        semantic_similarity: v.semantic_score,
        engagement_score: v.engagement_score,
        sentiment_score: v.sentiment_score,
        combined_score: v.combined_score
      }))
    };
  } catch (error) {
    console.error('❌ Error in getRankedYouTubeVideos:', error.message);
    return {
      success: false,
      message: error.message,
      skill: skill,
      resources: []
    };
  }
};

/**
 * Legacy endpoints for compatibility
 */
export const getLearningResources = async (skill, level = "Beginner") => {
  return getRankedYouTubeVideos(skill, {
    maxResults: 6,
    semanticWeight: 0.5,
    engagementWeight: 0.3,
    sentimentWeight: 0.2
  });
};

export const searchLearningResources = async (query, filters = {}) => {
  const { maxResults = 10 } = filters;
  return getRankedYouTubeVideos(query, { maxResults });
};

export const getLearningResourcesForSkills = async (skills, level = "Beginner") => {
  try {
    const resourcePromises = skills.map(skill => 
      getRankedYouTubeVideos(skill, { maxResults: 3 })
    );
    
    const results = await Promise.all(resourcePromises);
    
    const skillResources = {};
    skills.forEach((skill, index) => {
      skillResources[skill] = results[index];
    });
    
    return {
      success: true,
      skillCount: skills.length,
      resources: skillResources
    };
  } catch (error) {
    console.error("Error:", error.message);
    throw new Error("Failed to fetch learning resources");
  }
};

export const getTrendingSkillsWithResources = async () => {
  const trendingSkills = [
    "Python",
    "JavaScript",
    "React",
    "Machine Learning",
    "Web Development",
    "Data Science",
    "AWS",
    "Docker",
    "SQL",
    "Node.js"
  ];

  const resourcesMap = {};
  
  for (const skill of trendingSkills) {
    const resources = await getRankedYouTubeVideos(skill, { maxResults: 1 });
    resourcesMap[skill] = {
      count: resources.count,
      topCourse: resources.resources[0] || null
    };
  }

  return {
    success: true,
    trending: trendingSkills,
    resources: resourcesMap
  };
};

export const getJobLearningPath = async (jobTitle) => {
  const jobSkillsMap = {
    "data analyst": ["Python", "SQL", "Data Science"],
    "web developer": ["JavaScript", "React", "Web Development"],
    "devops engineer": ["Docker", "AWS", "Linux"],
    "machine learning engineer": ["Python", "Machine Learning", "Data Science"],
    "full stack developer": ["JavaScript", "React", "Node.js"]
  };

  const jobLower = jobTitle.toLowerCase();
  const requiredSkills = jobSkillsMap[jobLower] || [];

  if (requiredSkills.length === 0) {
    return {
      success: false,
      message: `No learning path found for job: ${jobTitle}`
    };
  }

  const learningPath = await getLearningResourcesForSkills(requiredSkills);

  return {
    success: true,
    jobTitle: jobTitle,
    requiredSkills: requiredSkills,
    learningPath: learningPath.resources
  };
};
