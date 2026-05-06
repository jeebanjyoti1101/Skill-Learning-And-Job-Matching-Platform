import { getAllJobs } from './data.loader.service.js';
import { searchJobs as searchOnlineJobs } from './job.api.service.js';

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
 * Hybrid Job Search Service
 * Combines local MongoDB/JSON data with real-time API jobs
 */

/**
 * Search jobs from both local database and real-time APIs
 */
export async function searchAllJobs(query, userSkills = [], options = {}) {
  const {
    includeLocal = true,
    includeRealTime = true,
    location = '',
    sources = ['muse'], // Start with free source
    maxResults = 20
  } = options;

  const results = {
    success: true,
    query,
    sources: [],
    jobs: [],
    statistics: {
      localJobs: 0,
      realTimeJobs: 0,
      totalJobs: 0
    }
  };

  // Fetch from local database
  if (includeLocal) {
    try {
      const localJobs = await getAllJobs();
      const keywordLower = query.toLowerCase().trim();
      const normalizedKeyword = normalizeJobTitle(query);
      
      const matchingJobs = localJobs.filter(job => {
        const skills = job.skillsRequired || job.skills_required || [];
        const title = (job.title || '').toLowerCase();
        const description = (job.description || '').toLowerCase();
        
        return title.includes(keywordLower) ||
               title.includes(normalizedKeyword) ||
               description.includes(keywordLower) ||
               description.includes(normalizedKeyword) ||
               skills.some(skill => skill.toLowerCase().includes(keywordLower) || skill.toLowerCase().includes(normalizedKeyword));
      });

      // Add match percentage if user skills provided
      const localJobsFormatted = matchingJobs.slice(0, maxResults).map(job => {
        const skills = job.skillsRequired || job.skills_required || [];
        let matchPercentage = null;
        
        if (userSkills.length > 0) {
          const matchingSkills = skills.filter(skill =>
            userSkills.some(us => us.toLowerCase() === skill.toLowerCase())
          );
          matchPercentage = Math.round((matchingSkills.length / skills.length) * 100);
        }

        return {
          title: job.title,
          company: job.company || 'Various Companies',
          location: job.location || 'Remote',
          description: job.description || '',
          skillsRequired: skills,
          matchPercentage,
          source: 'Database',
          type: 'local'
        };
      });

      results.jobs.push(...localJobsFormatted);
      results.statistics.localJobs = localJobsFormatted.length;
      results.sources.push('Local Database');
    } catch (error) {
      console.error('Error fetching local jobs:', error.message);
    }
  }

  // Fetch from real-time APIs
  if (includeRealTime) {
    try {
      const apiResult = await searchOnlineJobs(query, location, {
        sources,
        maxResults: Math.floor(maxResults / 2) // Split quota between local and API
      });

      if (apiResult.success && apiResult.jobs) {
        const realTimeJobsFormatted = apiResult.jobs.map(job => ({
          ...job,
          type: 'realtime',
          matchPercentage: userSkills.length > 0 && job.skillsRequired
            ? Math.round((job.skillsRequired.filter(skill =>
                userSkills.some(us => us.toLowerCase() === skill.toLowerCase())
              ).length / job.skillsRequired.length) * 100)
            : null
        }));

        results.jobs.push(...realTimeJobsFormatted);
        results.statistics.realTimeJobs = realTimeJobsFormatted.length;
        results.sources.push(...apiResult.sources);
      }
    } catch (error) {
      console.error('Error fetching real-time jobs:', error.message);
    }
  }

  // Sort by match percentage if available
  if (userSkills.length > 0) {
    results.jobs.sort((a, b) => (b.matchPercentage || 0) - (a.matchPercentage || 0));
  }

  results.statistics.totalJobs = results.jobs.length;

  return results;
}

/**
 * Get job recommendations with real-time enrichment
 */
export async function getEnrichedJobRecommendations(userSkills, options = {}) {
  const {
    limit = 10,
    includeRealTime = true,
    location = ''
  } = options;

  // Get local recommendations
  const localJobs = await getAllJobs();
  
  const jobMatches = localJobs.map(job => {
    const skills = job.skillsRequired || job.skills_required || [];
    const userSkillsLower = userSkills.map(s => s.toLowerCase().trim());
    
    const matchingSkills = skills.filter(skill =>
      userSkillsLower.includes(skill.toLowerCase())
    );
    
    const matchPercentage = skills.length > 0
      ? (matchingSkills.length / skills.length) * 100
      : 0;

    return {
      title: job.title,
      company: job.company || 'Various Companies',
      location: job.location || 'Remote',
      description: job.description || '',
      skillsRequired: skills,
      matchPercentage: Math.round(matchPercentage),
      matchingSkills,
      type: 'local',
      source: 'Database'
    };
  });

  // Filter and sort
  let topMatches = jobMatches
    .filter(j => j.matchPercentage >= 20)
    .sort((a, b) => b.matchPercentage - a.matchPercentage)
    .slice(0, limit);

  // Enrich with real-time jobs for top skills
  if (includeRealTime && userSkills.length > 0) {
    try {
      // Use top 3 skills to search
      const topSkills = userSkills.slice(0, 3).join(' ');
      const realTimeResult = await searchOnlineJobs(topSkills, location, {
        sources: ['muse'],
        maxResults: 5
      });

      if (realTimeResult.success && realTimeResult.jobs) {
        const realTimeMatches = realTimeResult.jobs.map(job => ({
          ...job,
          matchPercentage: job.skillsRequired
            ? Math.round((job.skillsRequired.filter(skill =>
                userSkills.some(us => us.toLowerCase() === skill.toLowerCase())
              ).length / job.skillsRequired.length) * 100)
            : 50,
          type: 'realtime'
        }));

        topMatches = [...topMatches, ...realTimeMatches]
          .sort((a, b) => b.matchPercentage - a.matchPercentage)
          .slice(0, limit);
      }
    } catch (error) {
      console.error('Error enriching with real-time jobs:', error.message);
    }
  }

  return {
    success: true,
    jobs: topMatches,
    statistics: {
      totalAnalyzed: jobMatches.length,
      localJobs: topMatches.filter(j => j.type === 'local').length,
      realTimeJobs: topMatches.filter(j => j.type === 'realtime').length,
      averageMatch: Math.round(
        topMatches.reduce((sum, j) => sum + j.matchPercentage, 0) / topMatches.length
      )
    }
  };
}

export default {
  searchAllJobs,
  getEnrichedJobRecommendations
};
