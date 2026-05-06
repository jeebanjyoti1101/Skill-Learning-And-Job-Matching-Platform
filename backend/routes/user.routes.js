import express from 'express';
import {
    addCertification,
    addExperience,
    addUserSkills,
    createUser,
    getProfileCompleteness,
    getUserByEmail,
    removeUserSkill,
    updateCareerGoals,
    updateUserProfile
} from '../services/user.service.js';

const router = express.Router();

/**
 * POST /api/users/register
 * Create a new user profile
 */
router.post('/register', async (req, res) => {
  try {
    const result = await createUser(req.body);
    res.status(result.success ? 201 : 409).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/users/profile?email=user@email.com
 * Get user profile
 */
router.get('/profile', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const result = await getUserByEmail(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', async (req, res) => {
  try {
    const { email, ...updates } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const result = await updateUserProfile(email, updates);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/users/skills
 * Add skills to user profile
 * Body: { email: "user@email.com", skills: ["Python", "React"] }
 */
router.post('/skills', async (req, res) => {
  try {
    const { email, skills } = req.body;
    if (!email || !skills) return res.status(400).json({ success: false, message: 'Email and skills are required' });
    const result = await addUserSkills(email, skills);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/users/skills
 * Remove a skill from user profile
 * Body: { email: "user@email.com", skill: "Python" }
 */
router.delete('/skills', async (req, res) => {
  try {
    const { email, skill } = req.body;
    if (!email || !skill) return res.status(400).json({ success: false, message: 'Email and skill are required' });
    const result = await removeUserSkill(email, skill);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/users/career-goals
 * Update career goals
 */
router.put('/career-goals', async (req, res) => {
  try {
    const { email, ...goals } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const result = await updateCareerGoals(email, goals);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/users/certifications
 */
router.post('/certifications', async (req, res) => {
  try {
    const { email, certification } = req.body;
    if (!email || !certification) return res.status(400).json({ success: false, message: 'Email and certification required' });
    const result = await addCertification(email, certification);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/users/experience
 */
router.post('/experience', async (req, res) => {
  try {
    const { email, experience } = req.body;
    if (!email || !experience) return res.status(400).json({ success: false, message: 'Email and experience required' });
    const result = await addExperience(email, experience);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/users/completeness?email=user@email.com
 * Get profile completeness score
 */
router.get('/completeness', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const result = await getProfileCompleteness(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
