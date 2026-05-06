import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateAdminLogin,
  verifyAdminToken,
  getDashboardStats,
  getAllUsers,
  deleteUser,
  getCredentialSubmissions,
  verifyExternalCredential,
  updateSettings,
  getActivityLog,
  getUserDetail,
  toggleUserStar,
  getSystemHealth,
  getSecurityAlerts,
  resolveSecurityAlert,
  addRecommendedContent,
  getRecommendedContent,
  deleteRecommendedContent
} from '../services/admin.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Admin auth middleware
 */
const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired admin token' });
  }
  next();
};

/**
 * POST /api/admin/login
 * Admin login
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    const result = validateAdminLogin(username, password);
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/verify
 * Verify admin token validity
 */
router.get('/verify', requireAdmin, (req, res) => {
  res.json({ success: true, message: 'Token is valid' });
});

/**
 * GET /api/admin/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/users
 * Get all users (paginated)
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const result = await getAllUsers(parseInt(page), parseInt(limit), search);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Get detailed user info
 */
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const result = await getUserDetail(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const result = await deleteUser(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/users/:id/star
 * Toggle star status
 */
router.post('/users/:id/star', requireAdmin, async (req, res) => {
  try {
    const result = await toggleUserStar(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/credentials
 * Get credential submissions from JSON
 */
router.get('/credentials', requireAdmin, (req, res) => {
  try {
    const result = getCredentialSubmissions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/credentials/verify
 * Verify or reject an external credential
 */
router.post('/credentials/verify', requireAdmin, async (req, res) => {
  try {
    const { userId, credentialIndex, status } = req.body;
    if (!userId || credentialIndex === undefined || !status) {
      return res.status(400).json({ success: false, message: 'userId, credentialIndex, and status required' });
    }
    const result = await verifyExternalCredential(userId, credentialIndex, status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/settings
 * Get platform settings
 */
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const configPath = path.join(__dirname, '../data/admin_config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json({ success: true, settings: config.settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/admin/settings
 * Update platform settings
 */
router.put('/settings', requireAdmin, (req, res) => {
  try {
    const result = updateSettings(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/activity
 * Get activity log
 */
router.get('/activity', requireAdmin, (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = getActivityLog(parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/health
 * Get system health
 */
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const result = await getSystemHealth();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/security
 * Get security alerts
 */
router.get('/security', requireAdmin, (req, res) => {
  try {
    const result = getSecurityAlerts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/security/:id/resolve
 * Resolve a security alert
 */
router.post('/security/:id/resolve', requireAdmin, (req, res) => {
  try {
    const result = resolveSecurityAlert(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/jobs/sync
 * Trigger job syncing (mock integration for UI)
 */
router.post('/jobs/sync', requireAdmin, (req, res) => {
  try {
    // In a real system, you would call your python script or job api service here
    // e.g. exec('python ml/hybrid_recommender.py train')
    res.json({ success: true, message: 'Job sync initiated. Datasets are updating in the background.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/assessment/trigger
 * Trigger weekly assessment manually
 */
router.post('/assessment/trigger', requireAdmin, (req, res) => {
  try {
    res.json({ success: true, message: 'Weekly grand assessment triggered successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/content
 */
router.get('/content', requireAdmin, (req, res) => {
  try {
    const result = getRecommendedContent();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/admin/content
 */
router.post('/content', requireAdmin, (req, res) => {
  try {
    const { title, type, link, tags } = req.body;
    if (!title || !type || !link) return res.status(400).json({ success: false, message: 'Title, type, and link required' });
    const result = addRecommendedContent(title, type, link, tags);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/admin/content/:id
 */
router.delete('/content/:id', requireAdmin, (req, res) => {
  try {
    const result = deleteRecommendedContent(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
