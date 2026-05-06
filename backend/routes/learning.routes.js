import express from "express";
import {
    getAvailableSkills,
    getLearningResources,
    getLearningResourcesForSkills
} from "../services/learning.service.js";

const router = express.Router();

/**
 * GET /api/learning/skills
 * Get all available skills in the learning database
 */
router.get("/skills", async (req, res) => {
  try {
    const skills = await getAvailableSkills();
    res.json({
      success: true,
      count: skills.length,
      skills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/learning/:skill
 * Get learning resources for a specific skill
 * Query params: level (Beginner|Intermediate|Advanced)
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
    res.json({
      success: true,
      skill,
      level,
      ...data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/learning/batch
 * Get learning resources for multiple skills
 * Body: { skills: ["Python", "SQL"], level: "Beginner" }
 */
router.post("/batch", async (req, res) => {
  try {
    const { skills, level = "Beginner" } = req.body;
    
    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Skills array is required"
      });
    }
    
    const data = await getLearningResourcesForSkills(skills, level);
    res.json({
      success: true,
      level,
      skillCount: skills.length,
      resources: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
