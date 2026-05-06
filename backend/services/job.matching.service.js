import { getAllJobs, getSkillsFrequency } from './data.loader.service.js';
import { getLearningResourcesForSkills } from './realtime.learning.service.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load skills frequency data
const skillsData = getSkillsFrequency();
const skillsFrequency = skillsData.frequency;

/**
 * Normalize job titles to handle synonyms and abbreviations
 */
function normalizeJobTitle(title) {
  if (!title) return '';
  const lowerTitle = title.toLowerCase().trim();
  
  const synonyms = {
    'prompt engineer': ['prompt engineering', 'ai prompt engineer', 'ai prompter', 'llm engineer'],
    'machine learning engineer': ['ml developer', 'ml engineer', 'machine learning developer', 'machine learning', 'ml'],
    'frontend developer': ['front end', 'front-end', 'ui developer', 'frontend engineer', 'front end developer'],
    'backend developer': ['back end', 'back-end', 'backend engineer', 'server developer', 'back end developer'],
    'full stack developer': ['fullstack', 'full stack', 'full stack engineer', 'fullstack engineer', 'full stack web developer'],
    'devops engineer': ['dev ops', 'devops', 'site reliability engineer', 'sre'],
    'data scientist': ['data science', 'data analyst'],
    'artificial intelligence engineer': ['ai developer', 'ai engineer', 'ai', 'artificial intelligence'],
    'software engineer': ['software developer', 'swe', 'sde', 'programmer', 'coder']
  };

  for (const [canonical, synList] of Object.entries(synonyms)) {
    if (synList.some(syn => lowerTitle.includes(syn)) || lowerTitle.includes(canonical)) {
      return canonical;
    }
  }
  return lowerTitle;
}


/**
 * Generate a dynamic job profile using Gemini if not found
 */
async function getDynamicJobProfileWithGemini(targetJobTitle) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') return null;
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are an expert career mapping AI. I need a JSON profile for the job role: "${targetJobTitle}".
Return ONLY a valid JSON object with standard formatting. Schema:
{
  "skillsRequired": ["array", "of", "top", "10", "most", "important", "skills", "for", "this", "role"],
  "description": "A 2 sentence description of the role.",
  "experienceLevel": "Mid Level",
  "category": "The IT broad category"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch(e) {
    console.warn("Gemini dynamic job profile failed:", e.message);
    return null;
  }
}

/**
 * Calculate skill match percentage between user skills and job requirements
 */
function calculateSkillMatch(userSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) return 0;
  if (!userSkills || userSkills.length === 0) return 0;
  
  const userSkillsLower = userSkills.map(s => s.toLowerCase().trim());
  const jobSkillsLower = jobSkills.map(s => s.toLowerCase().trim());
  
  const matchingSkills = jobSkillsLower.filter(skill => 
    userSkillsLower.includes(skill)
  );
  
  return (matchingSkills.length / jobSkillsLower.length) * 100;
}

/**
 * Identify missing skills (skill gap)
 */
function identifySkillGap(userSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) return [];
  if (!userSkills) userSkills = [];
  
  const userSkillsLower = userSkills.map(s => s.toLowerCase().trim());
  const jobSkillsLower = jobSkills.map(s => s.trim());
  
  const missingSkills = jobSkillsLower.filter(skill => 
    !userSkillsLower.includes(skill.toLowerCase())
  );
  
  return missingSkills;
}

/**
 * Prioritize missing skills by market demand
 */
function prioritizeSkillsByDemand(skills) {
  return skills.sort((a, b) => {
    const freqA = skillsFrequency[a.toLowerCase()] || 0;
    const freqB = skillsFrequency[b.toLowerCase()] || 0;
    return freqB - freqA; // Higher frequency first
  }).map(skill => ({
    skill,
    demand: skillsFrequency[skill.toLowerCase()] || 0,
    demandLevel: getDemandLevel(skillsFrequency[skill.toLowerCase()] || 0)
  }));
}

/**
 * Get demand level category
 */
function getDemandLevel(frequency) {
  if (frequency >= 40) return 'High Demand';
  if (frequency >= 20) return 'Medium Demand';
  if (frequency >= 10) return 'Growing Demand';
  return 'Niche Skill';
}

/**
 * ========================================================================
 * MAIN SERVICE: Job Recommendation with Real-Time Learning
 * ========================================================================
 */
export const getJobRecommendations = async (userSkills, options = {}) => {
  try {
    const {
      limit = 10,
      minMatchPercentage = 20,
      includeLearningPath = true,
      sortBy = 'match' // 'match' or 'gap'
    } = options;
    
    if (!userSkills || userSkills.length === 0) {
      return {
        success: false,
        message: 'User skills are required'
      };
    }
    
    console.log(`🔍 Finding job matches for skills: ${userSkills.join(', ')}`);
    
    // Get jobs from hybrid source (MongoDB or JSON)
    const jobsData = await getAllJobs();
    
    // Pre-calculate user skills in lowercase for efficiency
    const userSkillsLower = userSkills.map(s => String(s || "").toLowerCase().trim());

    // Calculate match for all jobs
    const jobMatches = jobsData.map(job => {
      const jobSkills = job.skillsRequired || job.skills_required || [];
      const jobSkillsLower = jobSkills.map(s => String(s || "").toLowerCase().trim());

      const matchingSkills = jobSkills.filter(skill => 
        userSkillsLower.includes(String(skill || "").toLowerCase().trim())
      );
      
      const missingSkillsRaw = jobSkills.filter(skill => 
        !userSkillsLower.includes(String(skill || "").toLowerCase().trim())
      );

      const matchPercentage = jobSkills.length === 0 ? 0 : (matchingSkills.length / jobSkills.length) * 100;

      return {
        jobId: job.title,
        title: job.title,
        description: job.description || '',
        requiredSkills: jobSkills,
        certifications: job.certifications || [],
        source: job.source,
        matchPercentage: Math.round(matchPercentage),
        matchingSkills: matchingSkills,
        matchingSkillsCount: matchingSkills.length,
        missingSkills: missingSkillsRaw,
        missingSkillsCount: missingSkillsRaw.length,
        employabilityScore: Math.round(matchPercentage),
        isGoodMatch: matchPercentage >= 60,
        isPartialMatch: matchPercentage >= 40 && matchPercentage < 60,
        requiresUpskilling: matchPercentage >= 20 && matchPercentage < 40
      };
    });
    
    // Filter by minimum match percentage
    let filteredJobs = jobMatches.filter(job => 
      job.matchPercentage >= minMatchPercentage
    );
    
    // Sort jobs
    filteredJobs.sort((a, b) => {
      if (sortBy === 'gap') {
        return a.missingSkillsCount - b.missingSkillsCount;
      }
      return b.matchPercentage - a.matchPercentage; // Default: highest match first
    });
    
    // Limit results
    filteredJobs = filteredJobs.slice(0, limit);
    
    // Calculate overall statistics
    const stats = {
      totalJobsAnalyzed: jobsData.length,
      matchingJobs: filteredJobs.length,
      perfectMatches: filteredJobs.filter(j => j.matchPercentage === 100).length,
      goodMatches: filteredJobs.filter(j => j.isGoodMatch).length,
      partialMatches: filteredJobs.filter(j => j.isPartialMatch).length,
      requiresUpskilling: filteredJobs.filter(j => j.requiresUpskilling).length
    };
    
    return {
      success: true,
      userSkills: userSkills,
      statistics: stats,
      jobs: filteredJobs
    };
    
  } catch (error) {
    console.error('Job Recommendation Error:', error.message);
    throw new Error('Failed to generate job recommendations');
  }
};

/**
 * Get complete skill gap analysis with learning resources
 */
export const getSkillGapAnalysis = async (userSkills, targetJobTitle) => {
  try {
    console.log(`📊 Analyzing skill gap for: ${targetJobTitle}`);
    
    // Get jobs from hybrid source
    const jobsData = await getAllJobs();
    
    // Find the target job
    const normalizedTarget = normalizeJobTitle(targetJobTitle);
    
    let targetJob = jobsData.find(job => 
      job.title.toLowerCase() === targetJobTitle.toLowerCase() ||
      normalizeJobTitle(job.title) === normalizedTarget
    );
    
    if (!targetJob) {
      // Fuzzy search
      const fuzzyMatch = jobsData.find(job => 
        job.title.toLowerCase().includes(targetJobTitle.toLowerCase()) ||
        targetJobTitle.toLowerCase().includes(job.title.toLowerCase()) ||
        job.title.toLowerCase().includes(normalizedTarget) ||
        normalizedTarget.includes(job.title.toLowerCase())
      );
      
      if (!fuzzyMatch) {
        console.log(`🤖 Attempting to fetch dynamic job profile via Gemini for: ${targetJobTitle}`);
        const geminiProfile = await getDynamicJobProfileWithGemini(targetJobTitle);
        
        let syntheticSkills = ['Problem Solving', 'Communication'];
        let description = `A dynamic role focused on modern technologies and solving complex problems as a ${targetJobTitle}.`;
        let experienceLevel = 'Mid Level';
        let category = 'Emerging Tech';

        // Use Gemini data if successfully fetched
        if (geminiProfile && geminiProfile.skillsRequired) {
          syntheticSkills = geminiProfile.skillsRequired;
          description = geminiProfile.description || description;
          experienceLevel = geminiProfile.experienceLevel || experienceLevel;
          category = geminiProfile.category || category;
          console.log(`✅ Gemini successfully generated profile for ${targetJobTitle}`);
        } else {
          // Fallback static rules if Gemini fails
          console.log(`⚠️ Gemini failed or disabled. Using static rule fallback for ${targetJobTitle}`);
          const isAI = targetJobTitle.toLowerCase().includes('ai') || targetJobTitle.toLowerCase().includes('prompt') || targetJobTitle.toLowerCase().includes('machine learning');
          const isData = targetJobTitle.toLowerCase().includes('data');
          const isWeb = targetJobTitle.toLowerCase().includes('web') || targetJobTitle.toLowerCase().includes('frontend') || targetJobTitle.toLowerCase().includes('backend');
          
          syntheticSkills = ['Problem Solving', 'Communication', 'Agile', 'Git'];
          if (isAI) syntheticSkills.push('Python', 'Machine Learning', 'Large Language Models (LLMs)', 'GPT-4', 'Prompt Engineering', 'NLP', 'Data Analysis');
          if (isData) syntheticSkills.push('SQL', 'Python', 'Data Visualization', 'ETL', 'AWS', 'Tableau', 'Statistics');
          if (isWeb) syntheticSkills.push('JavaScript', 'HTML/CSS', 'React', 'Node.js', 'REST APIs', 'TypeScript', 'UI/UX Design');
          if (!isAI && !isData && !isWeb) syntheticSkills.push('JavaScript', 'Python', 'SQL', 'Cloud Computing', 'System Design');
        }

        targetJob = {
          title: targetJobTitle,
          description: description,
          skillsRequired: syntheticSkills,
          skills_required: syntheticSkills,
          experienceLevel: experienceLevel,
          category: category,
          certifications: []
        };
      } else {
        targetJob = fuzzyMatch;
      }
    }
    
    const jobSkills = targetJob.skillsRequired || targetJob.skills_required || [];
    
    // Calculate match and gap
    const matchPercentage = calculateSkillMatch(userSkills, jobSkills);
    const matchingSkills = jobSkills.filter(skill => 
      userSkills.some(us => us.toLowerCase() === skill.toLowerCase())
    );
    const missingSkills = identifySkillGap(userSkills, jobSkills);
    
    // Prioritize missing skills by demand
    const prioritizedSkills = prioritizeSkillsByDemand(missingSkills);
    
    // Get learning resources for missing skills (Reduced from 10 to 3 for performance)
    const topMissingSkills = prioritizedSkills.slice(0, 3).map(s => s.skill);
    let learningPath = null;
    
    if (topMissingSkills.length > 0) {
      console.log(`⚡ Fetching learning path for top ${topMissingSkills.length} missing skills...`);
      learningPath = await getLearningResourcesForSkills(topMissingSkills, 'Beginner');
    }
    
    return {
      success: true,
      job: {
        title: targetJob.title,
        description: targetJob.description || '',
        totalSkillsRequired: jobSkills.length,
        certifications: targetJob.certifications || []
      },
      analysis: {
        currentMatchPercentage: Math.round(matchPercentage),
        skillsYouHave: matchingSkills.length,
        skillsNeeded: missingSkills.length,
        employabilityScore: Math.round(matchPercentage),
        readinessLevel: getReadinessLevel(matchPercentage),
        estimatedLearningTime: estimateLearningTime(missingSkills.length)
      },
      matchingSkills: matchingSkills,
      missingSkills: prioritizedSkills,
      learningPath: learningPath,
      recommendations: generateRecommendations(matchPercentage, missingSkills.length)
    };
    
  } catch (error) {
    console.error('Skill Gap Analysis Error:', error.message);
    throw new Error('Failed to analyze skill gap');
  }
};

/**
 * Get readiness level based on match percentage
 */
function getReadinessLevel(percentage) {
  if (percentage >= 90) return 'Job Ready - Apply Now!';
  if (percentage >= 70) return 'Almost Ready - 1-2 weeks of learning';
  if (percentage >= 50) return 'Partially Ready - 1-2 months of learning';
  if (percentage >= 30) return 'Early Stage - 2-3 months of learning';
  return 'Beginner - 3-6 months of structured learning';
}

/**
 * Estimate learning time based on number of skills
 */
function estimateLearningTime(skillsCount) {
  if (skillsCount === 0) return 'Ready to apply!';
  if (skillsCount <= 2) return '2-4 weeks';
  if (skillsCount <= 5) return '1-3 months';
  if (skillsCount <= 10) return '3-6 months';
  return '6-12 months';
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(matchPercentage, missingCount) {
  const recommendations = [];
  
  if (matchPercentage >= 80) {
    recommendations.push('🎉 Great match! Focus on the few remaining skills and start applying.');
    recommendations.push('💼 Update your resume highlighting your matching skills.');
    recommendations.push('🔗 Connect with professionals in this role on LinkedIn.');
  } else if (matchPercentage >= 60) {
    recommendations.push('👍 Good foundation! Dedicate 1-2 months to learning missing skills.');
    recommendations.push('📚 Start with high-demand skills to maximize job opportunities.');
    recommendations.push('🏆 Consider getting certifications for critical skills.');
  } else if (matchPercentage >= 40) {
    recommendations.push('📖 You need focused learning. Follow the prioritized skill roadmap.');
    recommendations.push('⏰ Set aside 2-3 hours daily for consistent learning.');
    recommendations.push('🤝 Join online communities to learn from others.');
  } else {
    recommendations.push('🚀 Start with fundamentals. Don\'t rush - build strong foundations.');
    recommendations.push('📅 Create a 6-month learning plan focusing on core skills first.');
    recommendations.push('👨‍🏫 Consider structured courses or bootcamps for faster learning.');
  }
  
  if (missingCount > 10) {
    recommendations.push('⚠️ This role requires many skills. Consider starting with similar roles that match better.');
  }
  
  return recommendations;
}

/**
 * Get all available job titles
 */
export const getAllJobTitles = async () => {
  const jobsData = await getAllJobs();
  return {
    success: true,
    count: jobsData.length,
    jobs: jobsData.map(job => {
      const skills = job.skillsRequired || job.skills_required || [];
      return {
        title: job.title,
        skillsCount: skills.length,
        hasCertifications: (job.certifications && job.certifications.length > 0)
      };
    }).sort((a, b) => a.title.localeCompare(b.title))
  };
};

/**
 * Search jobs by keyword
 */
export const searchJobs = async (keyword, userSkills = []) => {
  const keywordLower = keyword.toLowerCase().trim();
  const normalizedKeyword = normalizeJobTitle(keyword);
  const jobsData = await getAllJobs();
  
  const matchingJobs = jobsData.filter(job => {
    const skills = job.skillsRequired || job.skills_required || [];
    const title = job.title.toLowerCase();
    const desc = job.description ? job.description.toLowerCase() : '';
    
    return title.includes(keywordLower) ||
      title.includes(normalizedKeyword) ||
      desc.includes(keywordLower) ||
      desc.includes(normalizedKeyword) ||
      skills.some(skill => skill.toLowerCase().includes(keywordLower) || skill.toLowerCase().includes(normalizedKeyword));
  });
  
  // If user skills provided, add match percentage
  const jobsWithMatch = matchingJobs.map(job => {
    const skills = job.skillsRequired || job.skills_required || [];
    const matchPercentage = userSkills.length > 0 
      ? calculateSkillMatch(userSkills, skills)
      : null;
    
    return {
      title: job.title,
      description: job.description || '',
      skillsRequired: skills,
      certifications: job.certifications || [],
      matchPercentage: matchPercentage ? Math.round(matchPercentage) : null
    };
  });
  
  // Sort by match percentage if available
  if (userSkills.length > 0) {
    jobsWithMatch.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
  }
  
  return {
    success: true,
    keyword: keyword,
    count: jobsWithMatch.length,
    jobs: jobsWithMatch
  };
};

/**
 * Get top skills in demand from market data
 */
export const getTopSkills = (limit = 20) => {
  const skillsData = getSkillsFrequency();
  
  return {
    success: true,
    totalUniqueSkills: skillsData.total,
    topSkills: skillsData.skills.slice(0, limit)
  };
};

/**
 * Generate a dynamic career path using Gemini for highly unique skillsets
 */
async function getDynamicCareerPathWithGemini(userSkills) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') return null;
  
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are an expert career mapping AI. The user has the highly unique or emerging skills: ${userSkills.join(', ')}.
They have zero matches in a standard IT dataset. Construct a personalized, forward-looking career roadmap specifically for these skills.
Return ONLY valid JSON data matching this exact schema:
{
  "immediate": [
    { "title": "Role Name", "matchPercentage": 75, "missingSkills": ["skill1", "skill2"] }
  ],
  "shortTerm": [
    { "title": "Role Name", "matchPercentage": 60, "missingSkills": ["skill1", "skill2", "skill3"] }
  ],
  "longTerm": [
    { "title": "Role Name", "matchPercentage": 40, "missingSkills": ["skill1", "skill2", "skill3", "skill4"] }
  ]
}
Each array must have exactly 1 or 2 roles suitable for someone with these skills. Outline precisely what missing skills they uniquely need to bridge the gap.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);
    
    return {
      success: true,
      careerPaths: {
        immediate: {
          title: 'Apply Now (70%+ Match)',
          jobs: data.immediate || [],
          advice: 'Your unique skills make you an immediate fit for these roles. Start applying!'
        },
        shortTerm: {
          title: 'Short-Term Goals (50-69% Match)',
          jobs: data.shortTerm || [],
          advice: '1-3 months of focused learning on your missing skills will prepare you.'
        },
        longTerm: {
          title: 'Long-Term Goals (30-49% Match)',
          jobs: data.longTerm || [],
          advice: '3-6 months bridging the gap to transition fully into these roles.'
        }
      },
      nextSteps: generateCareerPathSteps(data.immediate || [], data.shortTerm || [], data.longTerm || [])
    };
  } catch(e) {
    console.warn("Gemini dynamic career path failed:", e.message);
    return null;
  }
}

/**
 * Get personalized career path recommendations
 */
export const getCareerPathRecommendations = async (userSkills) => {
  try {
    // Get job recommendations with lower threshold and more results
    const jobRecs = await getJobRecommendations(userSkills, {
      limit: 50,
      minMatchPercentage: 5
    });
    
    if (!jobRecs.success || jobRecs.jobs.length === 0) {
      console.log(`🤖 Base recommendations empty. Attempting dynamic Gemini career path for: ${userSkills.join(', ')}`);
      const dynamicPath = await getDynamicCareerPathWithGemini(userSkills);
      if (dynamicPath) {
        console.log(`✅ Gemini successfully generated a customized career roadmap for: ${userSkills.join(', ')}`);
        return dynamicPath;
      }

      return {
        success: false,
        message: 'No suitable career paths found. Try adding more complementary IT skills.'
      };
    }
    
    // Categorize by readiness
    const immediate = jobRecs.jobs.filter(j => j.matchPercentage >= 70);
    const shortTerm = jobRecs.jobs.filter(j => j.matchPercentage >= 50 && j.matchPercentage < 70);
    const longTerm = jobRecs.jobs.filter(j => j.matchPercentage < 50);
    
    return {
      success: true,
      careerPaths: {
        immediate: {
          title: 'Apply Now (70%+ Match)',
          jobs: immediate,
          advice: 'You\'re ready for these roles! Start applying and interviewing.'
        },
        shortTerm: {
          title: 'Short-Term Goals (50-69% Match)',
          jobs: shortTerm,
          advice: '1-3 months of focused learning can get you job-ready for these roles.'
        },
        longTerm: {
          title: 'Long-Term Goals (30-49% Match)',
          jobs: longTerm,
          advice: '3-6 months of structured learning to transition into these roles.'
        }
      },
      nextSteps: generateCareerPathSteps(immediate, shortTerm, longTerm)
    };
    
  } catch (error) {
    console.error('Career Path Error:', error.message);
    throw new Error('Failed to generate career path recommendations');
  }
};

function generateCareerPathSteps(immediate, shortTerm, longTerm) {
  const steps = [];
  
  if (immediate.length > 0) {
    steps.push({
      step: 1,
      action: `Apply to ${immediate.length} job(s) you're already qualified for`,
      timeline: 'This week',
      priority: 'High'
    });
  }
  
  if (shortTerm.length > 0) {
    const topMissingSkills = [...new Set(
      shortTerm.flatMap(j => j.missingSkills.slice(0, 3))
    )].slice(0, 5);
    
    steps.push({
      step: steps.length + 1,
      action: `Learn these high-impact skills: ${topMissingSkills.join(', ')}`,
      timeline: '1-3 months',
      priority: 'High'
    });
  }
  
  if (longTerm.length > 0) {
    steps.push({
      step: steps.length + 1,
      action: `Build foundation for long-term roles through structured learning`,
      timeline: '3-6 months',
      priority: 'Medium'
    });
  }
  
  steps.push({
    step: steps.length + 1,
    action: 'Build portfolio projects showcasing your new skills',
    timeline: 'Ongoing',
    priority: 'High'
  });
  
  return steps;
}
