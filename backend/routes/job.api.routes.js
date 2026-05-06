import express from 'express';
import { fetchOnlineJobs, searchJobs } from '../services/job.api.service.js';

const router = express.Router();

/**
 * @route   GET /api/online-jobs/search
 * @desc    Search for jobs from online APIs
 * @query   q (query), location, sources, maxResults
 */
router.get('/search', async (req, res) => {
  try {
    const { q, query, location, sources, maxResults } = req.query;
    
    const searchQuery = q || query;
    
    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required. Use ?q=Software Developer'
      });
    }
    
    const options = {
      sources: sources ? sources.split(',') : ['theirstack', 'adzuna', 'jsearch', 'muse', 'reed'],
      maxResults: parseInt(maxResults) || 50
    };
    
    const result = await searchJobs(
      searchQuery,
      location || '',
      options
    );
    
    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch online jobs',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/online-jobs/fetch
 * @desc    Fetch jobs from specific sources
 * @query   query, location, sources
 */
router.get('/fetch', async (req, res) => {
  try {
    const { query, location, sources } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Job query is required'
      });
    }
    
    const options = {
      sources: sources ? sources.split(',') : ['theirstack', 'adzuna', 'jsearch', 'muse', 'reed'],
      maxResults: 50
    };
    
    const jobs = await fetchOnlineJobs(query, location || '', options);
    
    res.json({
      success: true,
      query,
      location: location || 'Any',
      totalJobs: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/online-jobs/sources
 * @desc    Get available job sources
 */
router.get('/sources', (req, res) => {
  res.json({
    success: true,
    sources: [
      {
        name: 'Theirstack',
        id: 'theirstack',
        description: 'AI-native global job search API',
        requiresAuth: true,
        coverage: 'Global',
        limit: 'Based on your Theirstack plan'
      },
      {
        name: 'Adzuna',
        id: 'adzuna',
        description: 'Job search engine aggregating listings from thousands of websites',
        requiresAuth: true,
        coverage: 'Global',
        limit: '250 calls/month (free tier)'
      },
      {
        name: 'JSearch',
        id: 'jsearch',
        description: 'Google Jobs API via RapidAPI',
        requiresAuth: true,
        coverage: 'Global',
        limit: '100 requests/month (free tier)'
      },
      {
        name: 'The Muse',
        id: 'muse',
        description: 'Career advice and job opportunities',
        requiresAuth: false,
        coverage: 'US-focused',
        limit: 'Unlimited'
      },
      {
        name: 'Reed',
        id: 'reed',
        description: 'UK job board',
        requiresAuth: true,
        coverage: 'UK-focused',
        limit: 'Free tier available'
      }
    ],
    configurationRequired: [
      'THEIRSTACK_API_KEY',
      'ADZUNA_APP_ID and ADZUNA_APP_KEY',
      'RAPIDAPI_KEY',
      'REED_API_KEY'
    ],
    setupInstructions: 'Add API keys to .env file to enable online job fetching'
  });
});

export default router;
