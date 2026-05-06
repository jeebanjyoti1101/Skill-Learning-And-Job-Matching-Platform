import express from 'express';
import { getQuestionsForSkill, submitSkillTest, updateWeeklyRankings, getLeaderboard, getWeeklyAssessment, submitExternalAchievement } from '../services/assessment.service.js';

const router = express.Router();

/**
 * @route   GET /api/assessment/questions/:skill
 * @desc    Get questions for a specific skill dynamically via AI
 * @access  Public (should be protected in prod)
 */
router.get('/questions/:skill', async (req, res) => {
  try {
    const { userId, isWeak } = req.query;
    const questions = await getQuestionsForSkill(req.params.skill, 'medium', isWeak, userId);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/**
 * @route   POST /api/assessment/submit
 * @desc    Submit answers for a test
 * @access  Public (mock user ID required in body)
 */
router.post('/submit', async (req, res) => {
  try {
    const { userId, skill, answers } = req.body;
    if (!userId || !skill || !answers) {
      return res.status(400).json({ success: false, message: 'Missing user ID, skill, or answers' });
    }

    const result = await submitSkillTest(userId, skill, answers);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/**
 * @route   POST /api/assessment/weekly-update
 * @desc    Trigger the weekly ranking process
 * @access  Private
 */
router.post('/weekly-update', async (req, res) => {
  try {
    const result = await updateWeeklyRankings();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/assessment/leaderboard
 * @desc    Get top users leaderboard
 * @access  Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await getLeaderboard();
    res.json({ success: true, leaderboard: leaders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/**
 * @route   GET /api/assessment/weekly-test/:userId
 * @desc    Get 100 mixed questions for the weekly master test
 */
router.get('/weekly-test/:userId', async (req, res) => {
  try {
    const questions = await getWeeklyAssessment(req.params.userId);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

/**
 * @route   POST /api/assessment/external-achievement
 * @desc    Submit external platform link for manual verification
 */
router.post('/external-achievement', async (req, res) => {
  try {
    const { userId, platform, url } = req.body;
    const result = await submitExternalAchievement(userId, platform, url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;
