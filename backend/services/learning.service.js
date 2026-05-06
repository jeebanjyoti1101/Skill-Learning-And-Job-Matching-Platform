import axios from "axios";
import LearningResource from "../models/LearningResource.js";

/**
 * Hybrid Learning Resource Service
 * Priority: Static curated resources first, dynamic YouTube API as fallback
 * This ensures reliability while maintaining up-to-date content
 */
export const getLearningResources = async (skill, level = "Beginner") => {
  try {
    // 1️⃣ Get static resources first (curated, reliable)
    const staticResources = await LearningResource.find({
      skill: { $regex: new RegExp(skill, 'i') }, // Case-insensitive search
      level,
      sourceType: "static"
    }).limit(10);

    // 2️⃣ If enough static resources exist (>=2), return them
    if (staticResources.length >= 2) {
      return {
        source: "static",
        count: staticResources.length,
        message: "Curated learning resources from verified platforms",
        resources: staticResources.map(r => ({
          title: r.title,
          platform: r.platform,
          provider: r.provider,
          link: r.link,
          level: r.level,
          sourceType: r.sourceType
        }))
      };
    }

    // 3️⃣ Otherwise fetch dynamic YouTube resources
    if (!process.env.YOUTUBE_API_KEY) {
      // Fallback: return whatever static resources we have
      return {
        source: "static",
        count: staticResources.length,
        message: "Limited static resources available (YouTube API not configured)",
        resources: staticResources.map(r => ({
          title: r.title,
          platform: r.platform,
          provider: r.provider,
          link: r.link,
          level: r.level,
          sourceType: r.sourceType
        }))
      };
    }

    try {
      const ytResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q: `${skill} ${level} tutorial`,
            maxResults: 5,
            type: "video",
            videoDuration: "medium", // Filter for quality content
            videoDefinition: "high",
            relevanceLanguage: "en",
            key: process.env.YOUTUBE_API_KEY
          },
          timeout: 5000 // 5 second timeout
        }
      );

      const youtubeResources = ytResponse.data.items.map(video => ({
        title: video.snippet.title,
        platform: "YouTube",
        provider: video.snippet.channelTitle,
        link: `https://www.youtube.com/watch?v=${video.id.videoId}`,
        level: level,
        sourceType: "dynamic",
        thumbnail: video.snippet.thumbnails.medium.url,
        publishedAt: video.snippet.publishedAt
      }));

      // 4️⃣ Return hybrid result (static + dynamic)
      return {
        source: "hybrid",
        count: staticResources.length + youtubeResources.length,
        message: "Combined curated and real-time YouTube resources",
        resources: [
          ...staticResources.map(r => ({
            title: r.title,
            platform: r.platform,
            provider: r.provider,
            link: r.link,
            level: r.level,
            sourceType: r.sourceType
          })),
          ...youtubeResources
        ]
      };
    } catch (youtubeError) {
      console.error("YouTube API Error:", youtubeError.message);
      
      // Return static resources as fallback
      return {
        source: "static",
        count: staticResources.length,
        message: "Static resources (YouTube API temporarily unavailable)",
        resources: staticResources.map(r => ({
          title: r.title,
          platform: r.platform,
          provider: r.provider,
          link: r.link,
          level: r.level,
          sourceType: r.sourceType
        }))
      };
    }
  } catch (error) {
    console.error("Learning Service Error:", error.message);
    throw new Error("Failed to fetch learning resources");
  }
};

/**
 * Get learning resources for multiple skills (for skill gap analysis)
 */
export const getLearningResourcesForSkills = async (skills, level = "Beginner") => {
  try {
    const resourcePromises = skills.map(skill => 
      getLearningResources(skill, level)
    );
    
    const results = await Promise.all(resourcePromises);
    
    // Combine results by skill
    const skillResources = {};
    skills.forEach((skill, index) => {
      skillResources[skill] = results[index];
    });
    
    return skillResources;
  } catch (error) {
    console.error("Bulk Learning Resources Error:", error.message);
    throw new Error("Failed to fetch learning resources for multiple skills");
  }
};

/**
 * Get all available skills in the learning database
 */
export const getAvailableSkills = async () => {
  try {
    const skills = await LearningResource.distinct('skill');
    return skills.sort();
  } catch (error) {
    console.error("Get Available Skills Error:", error.message);
    throw new Error("Failed to fetch available skills");
  }
};
