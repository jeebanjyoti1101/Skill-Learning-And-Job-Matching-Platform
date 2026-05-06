import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Job from '../models/Job.js';
import LearningResource from '../models/LearningResource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '../data');

function inferExperienceLevel(title = '', explicitLevel = '') {
  if (explicitLevel) return explicitLevel;
  const t = String(title).toLowerCase();
  if (t.includes('principal') || t.includes('head') || t.includes('director') || t.includes('chief') || t.includes('vp')) {
    return 'Expert';
  }
  if (t.includes('senior') || t.includes('lead') || t.includes('staff')) {
    return 'Senior Level';
  }
  if (t.includes('mid') || t.includes('associate')) {
    return 'Mid Level';
  }
  return 'Entry Level';
}

function inferSalary(experienceLevel = 'Entry Level') {
  const ranges = {
    'Entry Level': '$45,000 - $70,000',
    'Mid Level': '$70,000 - $110,000',
    'Senior Level': '$110,000 - $160,000',
    Expert: '$160,000 - $230,000'
  };
  return ranges[experienceLevel] || ranges['Entry Level'];
}

function normalizeJobRecord(job) {
  const title = job.title || job.job_title || 'Unknown Role';
  const experienceLevel = inferExperienceLevel(title, job.experience_level || job.experienceLevel || '');

  return {
    title,
    description: job.description || '',
    skillsRequired: job.skills_required || job.skillsRequired || [],
    experienceLevel,
    category: job.category || 'IT',
    certifications: job.certifications || [],
    salary: job.salary || inferSalary(experienceLevel),
    location: job.location || 'Remote',
    company: job.company || 'Various Companies',
    source: job.source || 'dataset'
  };
}

/**
 * Load JSON data into MongoDB
 * This syncs the local JSON files with the database
 */
export async function loadDataToMongoDB() {
  try {
    console.log('📦 Starting data sync to MongoDB...');

    // Load jobs from JSON
    const jobsFile = fs.readFileSync(path.join(dataPath, 'merged_jobs_dataset.json'), 'utf-8');
    const jobsData = JSON.parse(jobsFile);

    // Load learning resources from JSON
    const learningFile = fs.readFileSync(path.join(dataPath, 'learning_resources.json'), 'utf-8');
    const learningData = JSON.parse(learningFile);

    // Sync Jobs to MongoDB
    const jobCount = await Job.countDocuments();
    if (jobCount === 0) {
      console.log('📋 Loading jobs into MongoDB...');
      
      const jobDocs = jobsData.map(normalizeJobRecord);

      await Job.insertMany(jobDocs, { ordered: false });
      console.log(`✅ Loaded ${jobDocs.length} jobs to MongoDB`);
    } else {
      console.log(`✅ MongoDB already has ${jobCount} jobs (skipping load)`);
    }

    // Sync Learning Resources to MongoDB
    const resourceCount = await LearningResource.countDocuments();
    if (resourceCount === 0 && learningData.learning_resources) {
      console.log('📚 Loading learning resources into MongoDB...');
      
      const resourceDocs = learningData.learning_resources.map(resource => ({
        skill: resource.skill,
        courses: resource.courses || [],
        roadmap: resource.roadmap || [],
        estimatedTime: resource.estimated_time || resource.estimatedTime
      }));

      await LearningResource.insertMany(resourceDocs, { ordered: false });
      console.log(`✅ Loaded ${resourceDocs.length} learning resources to MongoDB`);
    } else {
      console.log(`✅ MongoDB already has ${resourceCount} learning resources (skipping load)`);
    }

    return {
      success: true,
      jobsLoaded: await Job.countDocuments(),
      resourcesLoaded: await LearningResource.countDocuments()
    };
  } catch (error) {
    console.error('❌ Error loading data to MongoDB:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

let cachedJobs = null;
let cachedSkills = null;
let cachedLearning = null;

/**
 * Get all jobs from both JSON and MongoDB
 * Combines data from both sources with in-memory caching
 */
export async function getAllJobs() {
  if (cachedJobs) return cachedJobs;

  try {
    // Get jobs from MongoDB
    const mongoJobs = await Job.find().lean();

    // Get jobs from JSON as fallback
    const jobsFile = fs.readFileSync(path.join(dataPath, 'merged_jobs_dataset.json'), 'utf-8');
    const jsonJobs = JSON.parse(jobsFile);

    // If MongoDB has data, use it; otherwise use JSON
    if (mongoJobs.length > 0) {
      console.log(`📊 Retrieved ${mongoJobs.length} jobs from MongoDB (cached)`);
      cachedJobs = mongoJobs.map(job => ({
        ...normalizeJobRecord(job),
        skills_required: job.skillsRequired || [],
        experience_level: job.experienceLevel || inferExperienceLevel(job.title)
      }));
    } else {
      console.log(`📄 Using ${jsonJobs.length} jobs from JSON files (cached)`);
      cachedJobs = jsonJobs.map(job => {
        const normalized = normalizeJobRecord(job);
        return {
          ...normalized,
          skills_required: normalized.skillsRequired,
          experience_level: normalized.experienceLevel
        };
      });
    }
    return cachedJobs;
  } catch (error) {
    console.error('❌ Error getting jobs:', error.message);
    // Fallback to JSON
    const jobsFile = fs.readFileSync(path.join(dataPath, 'merged_jobs_dataset.json'), 'utf-8');
    const fallbackJobs = JSON.parse(jobsFile);
    cachedJobs = fallbackJobs.map(job => {
      const normalized = normalizeJobRecord(job);
      return {
        ...normalized,
        skills_required: normalized.skillsRequired,
        experience_level: normalized.experienceLevel
      };
    });
    return cachedJobs;
  }
}

/**
 * Get skills frequency data
 */
export function getSkillsFrequency() {
  if (cachedSkills) return cachedSkills;

  try {
    const skillsFile = fs.readFileSync(path.join(dataPath, 'skills_frequency.json'), 'utf-8');
    const skillsData = JSON.parse(skillsFile);
    cachedSkills = {
      skills: skillsData.skills,
      total: skillsData.total_unique_skills,
      frequency: Object.fromEntries(
        skillsData.skills.map(s => [s.name.toLowerCase(), s.frequency])
      )
    };
    return cachedSkills;
  } catch (error) {
    console.error('❌ Error loading skills frequency:', error.message);
    return { skills: [], total: 0, frequency: {} };
  }
}

/**
 * Get learning resources from both sources
 */
export async function getAllLearningResources() {
  if (cachedLearning) return cachedLearning;

  try {
    // Try MongoDB first
    const mongoResources = await LearningResource.find().lean();
    
    if (mongoResources.length > 0) {
      console.log(`📚 Retrieved ${mongoResources.length} learning resources from MongoDB (cached)`);
      cachedLearning = mongoResources;
    } else {
      // Fallback to JSON
      const learningFile = fs.readFileSync(path.join(dataPath, 'learning_resources.json'), 'utf-8');
      const learningData = JSON.parse(learningFile);
      console.log(`📄 Using learning resources from JSON files (cached)`);
      cachedLearning = learningData.learning_resources || [];
    }
    return cachedLearning;
  } catch (error) {
    console.error('❌ Error getting learning resources:', error.message);
    // Fallback to JSON
    const learningFile = fs.readFileSync(path.join(dataPath, 'learning_resources.json'), 'utf-8');
    const learningData = JSON.parse(learningFile);
    cachedLearning = learningData.learning_resources || [];
    return cachedLearning;
  }
}

export default {
  loadDataToMongoDB,
  getAllJobs,
  getSkillsFrequency,
  getAllLearningResources
};
