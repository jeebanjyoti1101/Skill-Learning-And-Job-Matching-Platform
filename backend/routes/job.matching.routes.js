import express from 'express';
import { getAllJobs, loadDataToMongoDB } from '../services/data.loader.service.js';
import { getEnrichedJobRecommendations, searchAllJobs } from '../services/hybrid.job.service.js';
import {
  getAllJobTitles,
  getCareerPathRecommendations,
  getJobRecommendations,
  getSkillGapAnalysis,
  getTopSkills,
  searchJobs
} from '../services/job.matching.service.js';

const router = express.Router();

/**
 * ========================================================================
 * Job Matching & Recommendation Routes
 * ========================================================================
 */

/**
 * GET /api/jobs
 * API documentation and available endpoints
 */
router.get('/', (req, res) => {
  res.json({
    message: "Job Matching & Recommendation API",
    description: "AI-powered job matching with 355 real IT jobs and 693 skills",
    endpoints: {
      "POST /match": {
        description: "Get personalized job recommendations",
        example: { skills: ["JavaScript", "React"], limit: 5, minMatchPercentage: 30 }
      },
      "POST /skill-gap": {
        description: "Analyze skill gap for a specific job",
        example: { userSkills: ["Python", "SQL"], targetJob: "Data Scientist" }
      },
      "POST /career-path": {
        description: "Get personalized career roadmap",
        example: { skills: ["HTML", "CSS", "JavaScript"] }
      },
      "GET /search": {
        description: "Search jobs by keyword",
        example: "/api/jobs/search?keyword=cloud&skills=AWS,Docker"
      },
      "GET /all": {
        description: "List all 355 job titles"
      },
      "GET /top-skills": {
        description: "Get top skills in market demand",
        example: "/api/jobs/top-skills?limit=20"
      },
      "GET /stats": {
        description: "Get platform statistics"
      }
    },
    stats: {
      totalJobs: 355,
      totalSkills: 693,
      dataSource: "HuggingFace merged datasets"
    }
  });
});

/**
 * POST /api/jobs/match
 * Get personalized job recommendations based on user skills
 * 
 * Body: {
 *   skills: ["JavaScript", "React", "Node.js"],
 *   limit: 10,
 *   minMatchPercentage: 20,
 *   sortBy: "match" // or "gap"
 * }
 */
router.post('/match', async (req, res) => {
  try {
    const { skills, limit, minMatchPercentage, sortBy } = req.body;
    
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Skills array is required'
      });
    }
    
    const recommendations = await getJobRecommendations(skills, {
      limit,
      minMatchPercentage,
      sortBy
    });
    
    res.json(recommendations);
    
  } catch (error) {
    console.error('Job Match Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/jobs/skill-gap
 * Detailed skill gap analysis for a specific job
 * 
 * Body: {
 *   userSkills: ["Python", "SQL"],
 *   targetJob: "Data Scientist"
 * }
 */
router.post('/skill-gap', async (req, res) => {
  try {
    const { userSkills, targetJob } = req.body;
    
    if (!userSkills || !Array.isArray(userSkills)) {
      return res.status(400).json({
        success: false,
        message: 'userSkills array is required'
      });
    }
    
    if (!targetJob) {
      return res.status(400).json({
        success: false,
        message: 'targetJob is required'
      });
    }
    
    const analysis = await getSkillGapAnalysis(userSkills, targetJob);
    
    res.json(analysis);
    
  } catch (error) {
    console.error('Skill Gap Analysis Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/jobs/career-path
 * Get personalized career path with short-term and long-term goals
 * 
 * Body: {
 *   skills: ["JavaScript", "HTML", "CSS"]
 * }
 */
router.post('/career-path', async (req, res) => {
  try {
    const { skills } = req.body;
    
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Skills array is required'
      });
    }
    
    const careerPath = await getCareerPathRecommendations(skills);
    
    res.json(careerPath);
    
  } catch (error) {
    console.error('Career Path Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/all
 * Get all available job titles
 */
router.get('/all', async (req, res) => {
  try {
    const allJobs = await getAllJobTitles();
    res.json(allJobs);
  } catch (error) {
    console.error('Get All Jobs Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/search
 * Search jobs by keyword
 * 
 * Query params:
 *   ?keyword=data
 *   &skills=Python,SQL (optional - for match percentage)
 */
router.get('/search', async (req, res) => {
  try {
    const { keyword, skills } = req.query;
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: 'keyword query parameter is required'
      });
    }
    
    const userSkills = skills ? skills.split(',').map(s => s.trim()) : [];
    const results = await searchJobs(keyword, userSkills);
    
    res.json(results);
    
  } catch (error) {
    console.error('Job Search Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/top-skills
 * Get top skills in demand from market data
 * 
 * Query params:
 *   ?limit=20
 */
router.get('/top-skills', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const topSkills = getTopSkills(limit);
    res.json(topSkills);
  } catch (error) {
    console.error('Top Skills Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/jobs/stats
 * Get database statistics from hybrid data source
 */
router.get('/stats', async (req, res) => {
  try {
    const allJobsData = await getAllJobs();
    const topSkills = getTopSkills(10);
    
    res.json({
      success: true,
      totalJobs: allJobsData.length,
      totalUniqueSkills: topSkills.totalUniqueSkills,
      topSkills: topSkills.topSkills,
      jobCategories: {
        withCertifications: allJobsData.filter(j => j.certifications && j.certifications.length > 0).length,
        entriesWithManySkills: allJobsData.filter(j => {
          const skills = j.skillsRequired || j.skills_required || [];
          return skills.length >= 10;
        }).length,
        entriesWithFewSkills: allJobsData.filter(j => {
          const skills = j.skillsRequired || j.skills_required || [];
          return skills.length < 5;
        }).length
      },
      dataSource: 'Hybrid (MongoDB + JSON)'
    });
  } catch (error) {
    console.error('Stats Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/jobs/reload-data
 * Manually reload data from JSON files into MongoDB
 */
router.post('/reload-data', async (req, res) => {
  try {
    const result = await loadDataToMongoDB();
    res.json(result);
  } catch (error) {
    console.error('Data Reload Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/jobs/realtime-search
 * Search jobs from BOTH local database AND real-time APIs
 * 
 * Body: {
 *   query: "Software Developer",
 *   skills: ["JavaScript", "React"] (optional),
 *   location: "New York" (optional),
 *   includeLocal: true,
 *   includeRealTime: true,
 *   sources: ["muse", "adzuna"] (optional)
 * }
 */
router.post('/realtime-search', async (req, res) => {
  try {
    const { query, skills, location, includeLocal, includeRealTime, sources, maxResults } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const result = await searchAllJobs(query, skills || [], {
      includeLocal: includeLocal !== false,
      includeRealTime: includeRealTime !== false,
      location: location || '',
      sources: sources || ['muse'],
      maxResults: maxResults || 20
    });

    res.json(result);
  } catch (error) {
    console.error('Real-time Search Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/jobs/enriched-match
 * Get job recommendations enriched with real-time API data
 * 
 * Body: {
 *   skills: ["Python", "Machine Learning"],
 *   limit: 10,
 *   includeRealTime: true,
 *   location: "Remote"
 * }
 */
router.post('/enriched-match', async (req, res) => {
  try {
    const { skills, limit, includeRealTime, location } = req.body;
    
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Skills array is required'
      });
    }

    const result = await getEnrichedJobRecommendations(skills, {
      limit: limit || 10,
      includeRealTime: includeRealTime !== false,
      location: location || ''
    });

    res.json(result);
  } catch (error) {
    console.error('Enriched Match Error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
