import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_PATH = path.join(__dirname, '../data/credentials.json');

/**
 * User Profile Service
 * Manages user profiles with skills, certifications, preferences
 */

// Ensure data directory exists
const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const saveToInternalJSON = (email, password, name) => {
  try {
    ensureDir(CREDENTIALS_PATH);
    let current = [];
    if (fs.existsSync(CREDENTIALS_PATH)) {
      current = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    }
    const existing = current.find(u => u.email === email);
    if (!existing) {
      current.push({ email, password: password || 'N/A', name, timestamp: new Date() });
      fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(current, null, 2));
    }
  } catch (e) {
    console.error('File storage error:', e);
  }
};

export const createUser = async (userData) => {
  try {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      return { success: false, message: 'User with this email already exists', user: existing };
    }
    const user = new User(userData);
    await user.save();
    
    // Save to our supplemental credentials JSON file
    saveToInternalJSON(userData.email, userData.password, userData.name);
    
    return { success: true, user };
  } catch (error) {
    console.error('Create User Error:', error.message);
    throw new Error('Failed to create user profile');
  }
};

export const getUserByEmail = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: 'User not found' };
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to fetch user');
  }
};

export const getUserById = async (id) => {
  try {
    const user = await User.findById(id);
    if (!user) return { success: false, message: 'User not found' };
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to fetch user');
  }
};

export const updateUserProfile = async (email, updates) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) return { success: false, message: 'User not found' };
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to update user profile');
  }
};

export const addUserSkills = async (email, skills) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: 'User not found' };

    for (const skill of skills) {
      const skillObj = typeof skill === 'string' ? { name: skill, level: 'Beginner' } : skill;
      const exists = user.skills.find(s => s.name.toLowerCase() === skillObj.name.toLowerCase());
      if (!exists) {
        user.skills.push(skillObj);
      }
    }
    await user.save();
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to add skills');
  }
};

export const removeUserSkill = async (email, skillName) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: 'User not found' };

    user.skills = user.skills.filter(s => s.name.toLowerCase() !== skillName.toLowerCase());
    await user.save();
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to remove skill');
  }
};

export const updateCareerGoals = async (email, goals) => {
  try {
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { careerGoals: goals } },
      { new: true }
    );
    if (!user) return { success: false, message: 'User not found' };
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to update career goals');
  }
};

export const addCertification = async (email, certification) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: 'User not found' };
    user.certifications.push(certification);
    await user.save();
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to add certification');
  }
};

export const addExperience = async (email, experience) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: 'User not found' };
    user.experience.push(experience);
    await user.save();
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to add experience');
  }
};

/**
 * Get user profile completeness breakdown
 */
export const getProfileCompleteness = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return { success: false, message: 'User not found' };

    const breakdown = {
      name: !!user.name,
      email: !!user.email,
      skills: user.skills.length > 0,
      certifications: user.certifications.length > 0,
      interests: user.interests.length > 0,
      careerGoals: !!(user.careerGoals?.shortTerm || user.careerGoals?.targetRoles?.length > 0),
      experience: user.experience.length > 0,
      preferences: user.preferences?.industries?.length > 0,
      location: user.locationPreferences?.workType !== 'Any',
      education: user.education.length > 0
    };

    const tips = [];
    if (!breakdown.skills) tips.push('Add your skills to get personalized job matches');
    if (!breakdown.careerGoals) tips.push('Set career goals for a tailored roadmap');
    if (!breakdown.experience) tips.push('Add work experience to improve match accuracy');
    if (!breakdown.certifications) tips.push('List certifications to boost your profile');

    return {
      success: true,
      completeness: user.profileCompleteness,
      breakdown,
      tips
    };
  } catch (error) {
    throw new Error('Failed to get profile completeness');
  }
};

/**
 * Quick guest profile (no DB persistence)
 */
export const createGuestProfile = (skills, options = {}) => {
  return {
    _id: 'guest',
    name: 'Guest User',
    email: 'guest@platform.local',
    skills: skills.map(s => typeof s === 'string' ? { name: s, level: 'Beginner' } : s),
    preferences: {
      experienceLevel: options.experienceLevel || 'Entry Level',
      industries: options.industries || [],
      employmentType: options.employmentType || ['Full-time']
    },
    locationPreferences: {
      workType: options.workType || 'Any'
    },
    careerGoals: {
      targetRoles: options.targetRoles || []
    }
  };
};
