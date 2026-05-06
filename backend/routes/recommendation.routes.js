import express from 'express';
import {
    getEnhancedSkillGap,
    getHybridEvaluation,
    getHybridRecommendations,
    getUserAnalytics,
    recordInteraction,
    trainHybridModels
} from '../services/recommendation.service.js';
import { createGuestProfile } from '../services/user.service.js';

const router = express.Router();

/**
 * POST /api/recommendations/match
 * Get hybrid AI job recommendations
 * 
 * Body: {
 *   skills: ["Python", "Machine Learning", "SQL"],
 *   experienceLevel: "Mid Level",
 *   limit: 15,
 *   diversityFactor: 0.2
 * }
 */
router.post('/match', async (req, res) => {
  try {
    const {
      skills,
      experienceLevel,
      desiredSalary,
      limit,
      topN,
      minScore,
      minSalary,
      maxSalary,
      strictExperienceLevel,
      diversityFactor,
      includeEvaluation,
      includeCollaborative,
      targetRoles
    } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ success: false, message: 'Skills array is required' });
    }

    const profile = createGuestProfile(skills, {
      experienceLevel: experienceLevel || 'Entry Level',
      desiredSalary: desiredSalary || null,
      targetRoles: targetRoles || []
    });

    const recommendations = await getHybridRecommendations(profile, {
      limit: limit || 15,
      topN: topN || undefined,
      minScore: minScore || 15,
      minSalary: minSalary ?? null,
      maxSalary: maxSalary ?? null,
      strictExperienceLevel: strictExperienceLevel === true,
      diversityFactor: diversityFactor || 0.2,
      includeEvaluation: includeEvaluation !== false,
      includeCollaborative: includeCollaborative === true
    });

    res.json(recommendations);

  } catch (error) {
    console.error('Recommendation Match Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/recommendations/skill-gap
 * Enhanced skill gap analysis
 */
router.post('/skill-gap', async (req, res) => {
  try {
    const { userSkills, targetJob } = req.body;

    if (!userSkills || !Array.isArray(userSkills)) {
      return res.status(400).json({ success: false, message: 'userSkills array is required' });
    }
    if (!targetJob) {
      return res.status(400).json({ success: false, message: 'targetJob is required' });
    }

    const analysis = await getEnhancedSkillGap(userSkills, targetJob);
    res.json(analysis);

  } catch (error) {
    console.error('Enhanced Skill Gap Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/recommendations/interaction
 * Record a user interaction (feedback loop)
 */
router.post('/interaction', async (req, res) => {
  try {
    const result = await recordInteraction(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/recommendations/analytics?userId=...
 * Get user analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
    const analytics = await getUserAnalytics(userId);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/recommendations/train
 * Trigger model training for Random Forest + XGBoost/Gradient Boosting stack
 */
router.post('/train', async (req, res) => {
  try {
    const result = await trainHybridModels();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/recommendations/evaluate
 * Returns latest evaluation metrics: precision, recall, f1, auc
 */
router.get('/evaluate', async (req, res) => {
  try {
    const retrain = String(req.query.retrain || '').toLowerCase() === 'true';
    const result = await getHybridEvaluation({ retrain });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
