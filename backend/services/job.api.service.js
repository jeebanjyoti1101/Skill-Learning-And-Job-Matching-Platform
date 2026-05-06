import axios from 'axios';

/**
 * ========================================================================
 * ONLINE JOB API INTEGRATION SERVICE
 * Fetch real-time jobs from multiple sources
 * ========================================================================
 */

// API Configurations
const API_CONFIGS = {
  // Adzuna API - Free tier: 250 calls/month
  ADZUNA: {
    appId: process.env.ADZUNA_APP_ID,
    appKey: process.env.ADZUNA_APP_KEY,
    baseUrl: 'https://api.adzuna.com/v1/api/jobs'
  },
  
  // JSearch API via RapidAPI - Free tier: 100 requests/month
  JSEARCH: {
    apiKey: process.env.RAPIDAPI_KEY,
    baseUrl: 'https://jsearch.p.rapidapi.com/search',
    host: 'jsearch.p.rapidapi.com'
  },
  
  // The Muse API - Free, no auth required
  MUSE: {
    baseUrl: 'https://www.themuse.com/api/public/jobs'
  },
  
  // Reed API - Free tier
  REED: {
    apiKey: process.env.REED_API_KEY,
    baseUrl: 'https://www.reed.co.uk/api/1.0/search'
  },

  // Theirstack API - real-time job search
  THEIRSTACK: {
    apiKey: process.env.THEIRSTACK_API_KEY,
    baseUrl: 'https://api.theirstack.com/v1/jobs/search'
  }
};

/**
 * Fetch jobs from Adzuna API
 */
async function fetchFromAdzuna(query, location = 'us', page = 1) {
  try {
    if (!API_CONFIGS.ADZUNA.appId || !API_CONFIGS.ADZUNA.appKey) {
      console.log('⚠️  Adzuna API credentials not configured');
      return [];
    }

    const url = `${API_CONFIGS.ADZUNA.baseUrl}/${location}/search/${page}`;
    const response = await axios.get(url, {
      params: {
        app_id: API_CONFIGS.ADZUNA.appId,
        app_key: API_CONFIGS.ADZUNA.appKey,
        what: query,
        results_per_page: 20,
        'content-type': 'application/json'
      },
      timeout: 10000
    });

    return response.data.results.map(job => ({
      title: job.title,
      company: job.company.display_name,
      location: job.location.display_name,
      description: job.description,
      url: job.redirect_url,
      salary: job.salary_min && job.salary_max 
        ? `$${job.salary_min} - $${job.salary_max}`
        : 'Not specified',
      postedDate: job.created,
      source: 'Adzuna',
      skillsRequired: extractSkillsFromDescription(job.description)
    }));
  } catch (error) {
    console.error('Adzuna API Error:', error.message);
    return [];
  }
}

/**
 * Fetch jobs from JSearch API (RapidAPI)
 */
async function fetchFromJSearch(query, location = 'United States', page = 1) {
  try {
    if (!API_CONFIGS.JSEARCH.apiKey) {
      console.log('⚠️  JSearch API key not configured');
      return [];
    }

    const response = await axios.get(API_CONFIGS.JSEARCH.baseUrl, {
      params: {
        query: `${query} in ${location}`,
        page: page.toString(),
        num_pages: '1'
      },
      headers: {
        'X-RapidAPI-Key': API_CONFIGS.JSEARCH.apiKey,
        'X-RapidAPI-Host': API_CONFIGS.JSEARCH.host
      },
      timeout: 10000
    });

    if (!response.data.data) return [];

    return response.data.data.map(job => ({
      title: job.job_title,
      company: job.employer_name,
      location: `${job.job_city || ''}, ${job.job_state || ''}, ${job.job_country || ''}`.trim(),
      description: job.job_description,
      url: job.job_apply_link || job.job_google_link,
      salary: job.job_salary || 'Not specified',
      postedDate: job.job_posted_at_datetime_utc,
      employmentType: job.job_employment_type,
      source: 'JSearch',
      skillsRequired: extractSkillsFromDescription(job.job_description)
    }));
  } catch (error) {
    console.error('JSearch API Error:', error.message);
    return [];
  }
}

/**
 * Fetch jobs from The Muse API (No auth required)
 */
async function fetchFromMuse(query, location = '', page = 0) {
  try {
    console.log(`🎨 Fetching from The Muse: query="${query}", location="${location}"`);
    
    // The Muse uses 'category' parameter - try "Software Engineering" as default
    const params = {
      category: 'Software Engineering',
      page: page,
      descending: true
    };
    
    if (location) {
      params.location = location;
    }
    
    const response = await axios.get(API_CONFIGS.MUSE.baseUrl, {
      params: params,
      timeout: 10000
    });

    console.log(`✅ The Muse API response: ${response.data.results?.length || 0} jobs found`);

    if (!response.data.results || response.data.results.length === 0) {
      console.log('⚠️  No results from The Muse');
      return [];
    }

    // Filter out irrelevant jobs (drivers, service workers, etc.)
    const irrelevantKeywords = [
      'driver', 'lyft', 'uber', 'dash', 'delivery', 'courier',
      'service manager', 'maintenance', 'property', 'facilities',
      'warehouse', 'logistics driver', 'truck driver', 'chauffeur',
      'rideshare', 'food delivery', 'doordash'
    ];

    let jobs = response.data.results.filter(job => {
      const jobTitle = job.name.toLowerCase();
      const jobContent = (job.contents || '').toLowerCase();
      
      // Exclude if title contains irrelevant keywords
      for (const keyword of irrelevantKeywords) {
        if (jobTitle.includes(keyword)) {
          return false;
        }
      }
      
      // Exclude if it's clearly a driver/delivery job
      if (jobContent.includes('drive with') || 
          jobContent.includes('earn money driving') ||
          jobContent.includes('flexible earning opportunity') ||
          (jobContent.includes('driver') && jobContent.includes('own car'))) {
        return false;
      }
      
      return true;
    });

    console.log(`🚫 Filtered out irrelevant jobs, ${jobs.length} remaining`);

    // Further filter by query term if specific
    if (query && query.toLowerCase() !== 'software engineering' && query.toLowerCase() !== 'software') {
      const queryLower = query.toLowerCase();
      const keywords = queryLower.split(' ').filter(w => w.length > 2);
      
      jobs = jobs.filter(job => {
        const jobTitle = job.name.toLowerCase();
        const jobContent = (job.contents || '').toLowerCase();
        
        // Job must match at least one keyword from the query
        return keywords.some(keyword => 
          jobTitle.includes(keyword) || 
          jobContent.includes(keyword)
        );
      });
      
      console.log(`🔍 Filtered to ${jobs.length} jobs matching "${query}"`);
    }

    // Only return jobs that have actual tech-related content
    jobs = jobs.filter(job => {
      const content = (job.contents || job.name).toLowerCase();
      const techKeywords = [
        'software', 'engineer', 'developer', 'programming', 'code', 'python',
        'java', 'javascript', 'react', 'angular', 'node', 'backend', 'frontend',
        'full stack', 'api', 'database', 'cloud', 'aws', 'azure', 'devops',
        'data', 'machine learning', 'ai', 'technical', 'architect', 'senior',
        'lead', 'staff', 'principal', 'web', 'mobile', 'ios', 'android',
        'system', 'infrastructure', 'security', 'qa', 'test', 'design'
      ];
      
      return techKeywords.some(keyword => content.includes(keyword));
    });

    console.log(`✅ Final filtered results: ${jobs.length} relevant tech jobs`);

    return jobs.map(job => ({
      title: job.name,
      company: job.company.name,
      location: job.locations?.map(l => l.name).join(', ') || 'Not specified',
      description: job.contents || 'No description available',
      url: job.refs.landing_page,
      salary: 'Not specified',
      postedDate: job.publication_date,
      source: 'The Muse',
      skillsRequired: extractSkillsFromDescription(job.contents || job.name)
    }));
  } catch (error) {
    console.error('The Muse API Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

/**
 * Fetch jobs from Reed API
 */
async function fetchFromReed(query, location = '', page = 1) {
  try {
    if (!API_CONFIGS.REED.apiKey) {
      console.log('⚠️  Reed API key not configured');
      return [];
    }

    const response = await axios.get(API_CONFIGS.REED.baseUrl, {
      params: {
        keywords: query,
        location: location,
        resultsToTake: 20
      },
      auth: {
        username: API_CONFIGS.REED.apiKey,
        password: ''
      },
      timeout: 10000
    });

    if (!response.data.results) return [];

    return response.data.results.map(job => ({
      title: job.jobTitle,
      company: job.employerName,
      location: job.locationName,
      description: job.jobDescription,
      url: job.jobUrl,
      salary: job.minimumSalary && job.maximumSalary 
        ? `£${job.minimumSalary} - £${job.maximumSalary}`
        : 'Not specified',
      postedDate: job.date,
      source: 'Reed',
      skillsRequired: extractSkillsFromDescription(job.jobDescription)
    }));
  } catch (error) {
    console.error('Reed API Error:', error.message);
    return [];
  }
}

/**
 * Fetch jobs from Theirstack API
 */
async function fetchFromTheirstack(query, location = '', page = 1) {
  try {
    if (!API_CONFIGS.THEIRSTACK.apiKey) {
      console.log('Theirstack API key not configured');
      return [];
    }

    const response = await axios.post(
      API_CONFIGS.THEIRSTACK.baseUrl,
      {
        query,
        location,
        page,
        limit: 20
      },
      {
        headers: {
          Authorization: `Bearer ${API_CONFIGS.THEIRSTACK.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const jobs =
      response.data?.jobs ||
      response.data?.data ||
      response.data?.results ||
      [];

    if (!Array.isArray(jobs)) return [];

    return jobs.map(job => ({
      title: job.title || job.job_title || 'Untitled Role',
      company:
        job.company ||
        job.company_name ||
        job.organization ||
        'Unknown Company',
      location:
        job.location ||
        job.job_location ||
        [job.city, job.state, job.country].filter(Boolean).join(', ') ||
        'Not specified',
      description: job.description || job.job_description || 'No description available',
      url: job.url || job.apply_url || job.job_url || job.source_url || '',
      salary:
        job.salary ||
        job.salary_range ||
        (job.salary_min && job.salary_max
          ? `${job.salary_min} - ${job.salary_max}`
          : 'Not specified'),
      postedDate: job.posted_at || job.created_at || job.date_posted || null,
      employmentType: job.employment_type || job.job_employment_type || 'Not specified',
      source: 'Theirstack',
      skillsRequired: extractSkillsFromDescription(
        job.description || job.job_description || job.title || ''
      )
    }));
  } catch (error) {
    console.error('Theirstack API Error:', error.response?.data || error.message);
    return [];
  }
}

/**
 * Extract skills from job description using keyword matching
 */
function extractSkillsFromDescription(description) {
  if (!description) return [];
  
  const commonSkills = [
    // Programming Languages
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'TypeScript',
    'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Dart', 'Objective-C',
    
    // Web Technologies
    'HTML', 'CSS', 'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Next.js', 'Nuxt.js',
    'Django', 'Flask', 'Spring Boot', 'ASP.NET', 'Laravel', 'WordPress', 'jQuery',
    'Bootstrap', 'Tailwind CSS', 'SASS', 'LESS', 'Webpack', 'Vite',
    
    // Databases
    'MongoDB', 'MySQL', 'PostgreSQL', 'Redis', 'Cassandra', 'Oracle', 'SQL Server',
    'SQLite', 'DynamoDB', 'Firebase', 'Elasticsearch', 'Neo4j', 'MariaDB',
    
    // Cloud & DevOps
    'AWS', 'Azure', 'Google Cloud', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD',
    'Terraform', 'Ansible', 'Git', 'GitHub', 'GitLab', 'Linux', 'Nginx', 'Apache',
    
    // Data Science & AI
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn',
    'Pandas', 'NumPy', 'Data Analysis', 'Data Visualization', 'Power BI', 'Tableau',
    'Apache Spark', 'Hadoop', 'Airflow', 'Kafka',
    
    // Mobile Development
    'React Native', 'Flutter', 'iOS', 'Android', 'Xamarin', 'Ionic',
    
    // Testing
    'Jest', 'Mocha', 'Selenium', 'Cypress', 'JUnit', 'PyTest',
    
    // Soft Skills
    'Communication', 'Leadership', 'Problem Solving', 'Teamwork', 'Agile', 'Scrum',
    'Project Management', 'Time Management'
  ];
  
  const descLower = description.toLowerCase();
  const foundSkills = commonSkills.filter(skill => 
    descLower.includes(skill.toLowerCase())
  );
  
  return [...new Set(foundSkills)]; // Remove duplicates
}

/**
 * Main function: Fetch jobs from all available sources
 */
export async function fetchOnlineJobs(query, location = '', options = {}) {
  const {
    sources = ['theirstack', 'adzuna', 'jsearch', 'muse', 'reed'],
    maxResults = 50
  } = options;
  
  console.log(`🌐 Fetching online jobs for: "${query}" in "${location || 'Any Location'}"`);
  
  const fetchPromises = [];
  
  if (sources.includes('adzuna')) {
    fetchPromises.push(fetchFromAdzuna(query, location || 'us'));
  }
  
  if (sources.includes('jsearch')) {
    fetchPromises.push(fetchFromJSearch(query, location || 'United States'));
  }
  
  if (sources.includes('muse')) {
    fetchPromises.push(fetchFromMuse(query, location));
  }
  
  if (sources.includes('reed')) {
    fetchPromises.push(fetchFromReed(query, location));
  }

  if (sources.includes('theirstack')) {
    fetchPromises.push(fetchFromTheirstack(query, location));
  }
  
  try {
    const results = await Promise.allSettled(fetchPromises);
    
    // Combine all successful results
    const allJobs = results
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);
    
    console.log(`✅ Fetched ${allJobs.length} jobs from online sources`);
    
    // Remove duplicates based on title and company
    const uniqueJobs = allJobs.filter((job, index, self) =>
      index === self.findIndex(j => 
        j.title.toLowerCase() === job.title.toLowerCase() && 
        j.company.toLowerCase() === job.company.toLowerCase()
      )
    );
    
    return uniqueJobs.slice(0, maxResults);
  } catch (error) {
    console.error('Error fetching online jobs:', error.message);
    return [];
  }
}

/**
 * Get job details by URL (for specific job lookup)
 */
export async function getJobDetails(jobUrl) {
  try {
    // This would require web scraping or specific API calls
    // For now, return placeholder
    return {
      success: false,
      message: 'Job details fetching not implemented yet'
    };
  } catch (error) {
    console.error('Error fetching job details:', error);
    throw error;
  }
}

/**
 * Search jobs with combined online and local data
 */
export async function searchJobs(query, location = '', options = {}) {
  try {
    const onlineJobs = await fetchOnlineJobs(query, location, options);
    
    return {
      success: true,
      query,
      location,
      totalResults: onlineJobs.length,
      jobs: onlineJobs,
      sources: [...new Set(onlineJobs.map(j => j.source))]
    };
  } catch (error) {
    console.error('Job search error:', error.message);
    throw error;
  }
}
