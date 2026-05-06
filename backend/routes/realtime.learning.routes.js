import express from "express";
import { getRealtimeRankedResources } from "../services/live.recommendation.service.js";
import {
    getJobLearningPath,
    getLearningResources,
    getLearningResourcesForSkills,
    getTrendingSkillsWithResources,
    searchLearningResources
} from "../services/realtime.learning.service.js";

const router = express.Router();

/**
 * ========================================================================
 * REAL-TIME FREE LEARNING RESOURCE ENDPOINTS
 * ========================================================================
 */

/**
 * GET /api/realtime-learning
 * API documentation and available endpoints
 */
router.get("/", (req, res) => {
  res.json({
    message: "Real-Time Free Learning API",
    description: "Fetch live courses from YouTube, Coursera, and freeCodeCamp",
    endpoints: {
      "GET /:skill": {
        description: "Get courses for a specific skill",
        example: "/api/realtime-learning/Python?level=Beginner",
        params: { skill: "required", level: "optional (Beginner|Intermediate|Advanced)" }
      },
      "POST /ranked": {
        description: "Get real-time ranked recommendations powered by live YouTube + HF scoring",
        example: { skills: ["Python"], videosPerSkill: 3, commentsPerVideo: 4, topK: 3 }
      },
      "POST /batch": {
        description: "Get courses for multiple skills",
        example: { skills: ["Python", "SQL"], level: "Beginner" }
      },
      "POST /search": {
        description: "Search across all platforms",
        example: { query: "machine learning", platforms: ["youtube", "coursera"] }
      },
      "GET /job-path/:job": {
        description: "Get learning path for a specific job",
        example: "/api/realtime-learning/job-path/Data%20Scientist"
      },
      "GET /trending/skills": {
        description: "Get trending skills with courses",
        example: "/api/realtime-learning/trending/skills?limit=10"
      }
    },
    platforms: ["YouTube (API)", "Coursera (Free)", "freeCodeCamp (Free)"]
  });
});

/**
 * POST /api/realtime-learning/ranked
 * Run live ranked recommendation pipeline and return top scored resources.
 * Body: { skills: ["Python"], videosPerSkill?: 3, commentsPerVideo?: 4, topK?: 3 }
 */
router.post("/ranked", async (req, res) => {
  try {
    const {
      skills,
      videosPerSkill = 3,
      commentsPerVideo = 4,
      topK = 3,
      semanticWeight = 0.5,
      engagementWeight = 0.3,
      sentimentWeight = 0.2,
    } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "skills must be a non-empty array",
      });
    }

    const cleanSkills = skills.map((s) => String(s || "").trim()).filter(Boolean);
    if (!cleanSkills.length) {
      return res.status(400).json({
        success: false,
        message: "skills must contain valid strings",
      });
    }

    const clamp = (value, fallback) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(1, Math.max(0, n));
    };

    const data = await getRealtimeRankedResources({
      skills: cleanSkills,
      videosPerSkill: Number(videosPerSkill),
      commentsPerVideo: Number(commentsPerVideo),
      topK: Number(topK),
      semanticWeight: clamp(semanticWeight, 0.5),
      engagementWeight: clamp(engagementWeight, 0.3),
      sentimentWeight: clamp(sentimentWeight, 0.2),
    });

    return res.json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/realtime-learning/batch
 * Get real-time learning resources for multiple skills (skill gap analysis)
 * Body: { skills: ["Python", "SQL"], level: "Beginner" }
 * 
 * Example:
 * POST /api/realtime-learning/batch
 * { "skills": ["Docker", "Kubernetes", "AWS"], "level": "Beginner" }
 */
router.post("/batch", async (req, res) => {
  try {
    const { skills, level = "Beginner" } = req.body;
    
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Skills array is required (e.g., ['Python', 'SQL'])"
      });
    }
    
    if (skills.length > 10) {
      return res.status(400).json({
        success: false,
        message: "Maximum 10 skills allowed per request"
      });
    }
    
    const data = await getLearningResourcesForSkills(skills, level);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/realtime-learning/trending/skills
 * Get trending skills with their top free learning resources
 * 
 * Example: GET /api/realtime-learning/trending/skills
 */
router.get("/trending/skills", async (req, res) => {
  try {
    const data = await getTrendingSkillsWithResources();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/realtime-learning/search
 * Search for free learning resources across all platforms
 * Body: { query: "python programming", platform: "all", level: "Beginner", maxResults: 10 }
 * 
 * Example:
 * POST /api/realtime-learning/search
 * { "query": "react hooks tutorial", "platform": "youtube", "level": "Intermediate" }
 */
router.post("/search", async (req, res) => {
  try {
    const { query, ...filters } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query parameter is required"
      });
    }
    
    const data = await searchLearningResources(query, filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/realtime-learning/job-path/:jobTitle
 * Get complete learning path for a specific job role
 * 
 * Example: GET /api/realtime-learning/job-path/Data%20Analyst
 */
router.get("/job-path/:jobTitle", async (req, res) => {
  try {
    const { jobTitle } = req.params;
    
    if (!jobTitle) {
      return res.status(400).json({
        success: false,
        message: "Job title parameter is required"
      });
    }
    
    const data = await getJobLearningPath(jobTitle);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/realtime-learning/health
 * Health check endpoint
 */
router.get("/health/check", async (req, res) => {
  res.json({
    success: true,
    message: "Real-time Learning Resource API is running",
    features: [
      "YouTube free courses",
      "Coursera free audits",
      "freeCodeCamp certifications",
      "Multi-skill batch processing",
      "Job-based learning paths",
      "Trending skills tracking"
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/realtime-learning/:skill
 * Get real-time free learning resources for a specific skill
 * Query params: level (Beginner|Intermediate|Advanced)
 * 
 * Example: GET /api/realtime-learning/Python?level=Beginner
 */
router.get("/:skill", async (req, res) => {
  try {
    const { skill } = req.params;
    const { level = "Beginner" } = req.query;
    
    if (!skill) {
      return res.status(400).json({
        success: false,
        message: "Skill parameter is required"
      });
    }
    
    const data = await getLearningResources(skill, level);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
