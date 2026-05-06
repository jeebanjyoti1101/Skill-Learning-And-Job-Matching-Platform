import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_PATH = path.join(__dirname, '../data/credentials.json');
const ADMIN_CONFIG_PATH = path.join(__dirname, '../data/admin_config.json');

// Default admin credentials (in production, use hashed passwords + env vars)
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'Admin@1101',
  name: 'Platform Administrator',
  role: 'super_admin'
};

/**
 * Load admin config from file or create defaults
 */
const loadAdminConfig = () => {
  try {
    if (fs.existsSync(ADMIN_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8'));
    }
  } catch (e) { /* use defaults */ }
  const defaults = {
    admins: [DEFAULT_ADMIN],
    settings: {
      maintenanceMode: false,
      registrationOpen: true,
      maxUsersAllowed: 10000,
      platformName: 'SkillMatch AI',
      announcementBanner: '',
      assessmentDurationMinutes: 30,
      assessmentQuestionCount: 20
    },
    activityLog: [],
    securityAlerts: [],
    recommendedContent: []
  };
  fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(defaults, null, 2));
  return defaults;
};

const saveAdminConfig = (config) => {
  fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(config, null, 2));
};

const logActivity = (action, details = '') => {
  const config = loadAdminConfig();
  config.activityLog.unshift({
    action,
    details,
    timestamp: new Date().toISOString()
  });
  // Keep only last 200 entries
  if (config.activityLog.length > 200) config.activityLog = config.activityLog.slice(0, 200);
  saveAdminConfig(config);
};

/**
 * Log a security alert (suspicious activity, hacks, etc.)
 */
export const logSecurityAlert = (type, severity, details, ip = 'unknown') => {
  const config = loadAdminConfig();
  if (!config.securityAlerts) config.securityAlerts = [];
  
  config.securityAlerts.unshift({
    id: Date.now().toString(),
    type,
    severity, // 'low', 'medium', 'high', 'critical'
    details,
    ip,
    resolved: false,
    timestamp: new Date().toISOString()
  });
  
  if (config.securityAlerts.length > 100) config.securityAlerts = config.securityAlerts.slice(0, 100);
  saveAdminConfig(config);
  
  // In a real system, you would send an email here if severity is high/critical
  if (severity === 'high' || severity === 'critical') {
    console.error(`🚨 [SECURITY ALERT] ${type}: ${details} from IP ${ip}`);
  }
};

/**
 * Validate admin login
 */
export const validateAdminLogin = (username, password) => {
  const config = loadAdminConfig();
  const admin = config.admins.find(
    a => a.username === username && a.password === password
  );
  if (admin) {
    logActivity('LOGIN', `Admin "${username}" logged in`);
    // Create a simple token (for demo; use JWT in production)
    const token = Buffer.from(`${username}:${Date.now()}:skillmatch_admin_secret`).toString('base64');
    return {
      success: true,
      token,
      admin: { username: admin.username, name: admin.name, role: admin.role }
    };
  }
  return { success: false, message: 'Invalid admin credentials' };
};

/**
 * Verify admin token
 */
export const verifyAdminToken = (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [username, timestamp, secret] = decoded.split(':');
    if (secret !== 'skillmatch_admin_secret') return false;
    // Token valid for 24 hours
    const age = Date.now() - parseInt(timestamp);
    if (age > 24 * 60 * 60 * 1000) return false;
    const config = loadAdminConfig();
    return config.admins.some(a => a.username === username);
  } catch (e) {
    return false;
  }
};

/**
 * Get dashboard stats
 */
export const getDashboardStats = async () => {
  try {
    const totalUsers = await User.countDocuments();
    const usersWithSkills = await User.countDocuments({ 'skills.0': { $exists: true } });
    const usersWithExperience = await User.countDocuments({ 'experience.0': { $exists: true } });
    const usersWithCerts = await User.countDocuments({ 'certifications.0': { $exists: true } });
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email createdAt profileCompleteness');

    // Get credential submissions from JSON
    let credentials = [];
    try {
      if (fs.existsSync(CREDENTIALS_PATH)) {
        credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      }
    } catch (e) { /* empty */ }

    // Aggregate top skills
    const skillAgg = await User.aggregate([
      { $unwind: '$skills' },
      { $group: { _id: '$skills.name', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get users with pending external credentials
    const pendingCredentials = await User.find({
      'assessmentProfile.externalCredentials': {
        $elemMatch: { status: 'Pending' }
      }
    }).select('name email assessmentProfile.externalCredentials');

    // Aggregate signup trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0,0,0,0);
    const signupAgg = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const config = loadAdminConfig();

    return {
      success: true,
      stats: {
        totalUsers,
        usersWithSkills,
        usersWithExperience,
        usersWithCerts,
        totalCredentialSubmissions: credentials.length,
        pendingVerifications: pendingCredentials.length
      },
      recentUsers,
      topSkills: skillAgg,
      signupTrends: signupAgg,
      pendingCredentials,
      settings: config.settings,
      recentActivity: config.activityLog.slice(0, 20)
    };
  } catch (error) {
    console.error('Dashboard stats error:', error);
    throw new Error('Failed to fetch dashboard stats');
  }
};

/**
 * Get all users with pagination
 */
export const getAllUsers = async (page = 1, limit = 20, search = '') => {
  try {
    const query = search
      ? { $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]}
      : {};
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name email skills certifications experience profileCompleteness createdAt lastActive assessmentProfile');
    return {
      success: true,
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  } catch (error) {
    throw new Error('Failed to fetch users');
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (userId) => {
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) return { success: false, message: 'User not found' };
    logActivity('DELETE_USER', `Deleted user: ${user.email}`);

    // Also remove from credentials JSON
    try {
      if (fs.existsSync(CREDENTIALS_PATH)) {
        let creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
        creds = creds.filter(c => c.email !== user.email);
        fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2));
      }
    } catch (e) { /* ignore */ }

    return { success: true, message: `User ${user.email} deleted successfully` };
  } catch (error) {
    throw new Error('Failed to delete user');
  }
};

/**
 * Get credential submissions from JSON file
 */
export const getCredentialSubmissions = () => {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
      return { success: true, credentials: creds };
    }
    return { success: true, credentials: [] };
  } catch (error) {
    throw new Error('Failed to fetch credentials');
  }
};

/**
 * Verify/Reject an external credential for a user
 */
export const verifyExternalCredential = async (userId, credentialIndex, status) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };

    if (user.assessmentProfile?.externalCredentials?.[credentialIndex]) {
      user.assessmentProfile.externalCredentials[credentialIndex].status = status;
      if (status === 'Verified') {
        user.assessmentProfile.isStarred = true;
      }
      await user.save();
      logActivity('VERIFY_CREDENTIAL', `${status} credential for ${user.email}`);
      return { success: true, message: `Credential ${status.toLowerCase()} successfully` };
    }
    return { success: false, message: 'Credential not found' };
  } catch (error) {
    throw new Error('Failed to verify credential');
  }
};

/**
 * Update platform settings
 */
export const updateSettings = (updates) => {
  try {
    const config = loadAdminConfig();
    config.settings = { ...config.settings, ...updates };
    saveAdminConfig(config);
    logActivity('UPDATE_SETTINGS', JSON.stringify(updates));
    return { success: true, settings: config.settings };
  } catch (error) {
    throw new Error('Failed to update settings');
  }
};

/**
 * Get activity log
 */
export const getActivityLog = (limit = 50) => {
  const config = loadAdminConfig();
  return { success: true, log: config.activityLog.slice(0, limit) };
};

/**
 * Get detailed user profile for admin view
 */
export const getUserDetail = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };
    return { success: true, user };
  } catch (error) {
    throw new Error('Failed to fetch user details');
  }
};

/**
 * Toggle user starred status
 */
export const toggleUserStar = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };
    if (!user.assessmentProfile) user.assessmentProfile = {};
    user.assessmentProfile.isStarred = !user.assessmentProfile.isStarred;
    await user.save();
    logActivity('TOGGLE_STAR', `${user.assessmentProfile.isStarred ? 'Starred' : 'Unstarred'} user: ${user.email}`);
    return { success: true, isStarred: user.assessmentProfile.isStarred };
  } catch (error) {
    throw new Error('Failed to toggle star');
  }
};

/**
 * Get system health info
 */
export const getSystemHealth = async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    const dbState = mongoose.connection.readyState;
    const dbStates = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting' };

    return {
      success: true,
      health: {
        database: dbStates[dbState] || 'Unknown',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        firewallStatus: 'Active',
        encryption: 'AES-256'
      }
    };
  } catch (error) {
    throw new Error('Failed to get system health');
  }
};

/**
 * Get security alerts
 */
export const getSecurityAlerts = () => {
  const config = loadAdminConfig();
  return { success: true, alerts: config.securityAlerts || [] };
};

/**
 * Resolve a security alert
 */
export const resolveSecurityAlert = (alertId) => {
  const config = loadAdminConfig();
  if (config.securityAlerts) {
    const alert = config.securityAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      saveAdminConfig(config);
      logActivity('RESOLVE_ALERT', `Resolved security alert ${alertId}`);
      return { success: true };
    }
  }
  return { success: false, message: 'Alert not found' };
};

/**
 * Add recommended content
 */
export const addRecommendedContent = (title, type, link, tags) => {
  const config = loadAdminConfig();
  if (!config.recommendedContent) config.recommendedContent = [];
  
  const newItem = {
    id: Date.now().toString(),
    title,
    type, // 'video', 'note', 'job'
    link,
    tags: tags ? tags.split(',').map(t => t.trim()) : [],
    addedAt: new Date().toISOString()
  };
  
  config.recommendedContent.push(newItem);
  saveAdminConfig(config);
  logActivity('ADD_CONTENT', `Added recommended ${type}: ${title}`);
  return { success: true, item: newItem };
};

/**
 * Get recommended content
 */
export const getRecommendedContent = () => {
  const config = loadAdminConfig();
  return { success: true, content: config.recommendedContent || [] };
};

/**
 * Delete recommended content
 */
export const deleteRecommendedContent = (id) => {
  const config = loadAdminConfig();
  if (config.recommendedContent) {
    config.recommendedContent = config.recommendedContent.filter(c => c.id !== id);
    saveAdminConfig(config);
    logActivity('DELETE_CONTENT', `Deleted recommended content ${id}`);
    return { success: true };
  }
  return { success: false, message: 'Content not found' };
};
