import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import chatbotRoutes from "./routes/chatbot.routes.js";
import jobApiRoutes from "./routes/job.api.routes.js";
import jobMatchingRoutes from "./routes/job.matching.routes.js";
import learningRoutes from "./routes/learning.routes.js";
import realtimeLearningRoutes from "./routes/realtime.learning.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import userRoutes from "./routes/user.routes.js";
import assessmentRoutes from "./routes/assessment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { loadDataToMongoDB } from "./services/data.loader.service.js";
import { warmupCache } from "./services/realtime.learning.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const originalLog = console.log.bind(console);
console.log = (...args) => {
  const message = args.map(String).join(" ");
  const allowStartup =
    message.startsWith("MongoDB Connected") ||
    message.startsWith("Server running on port") ||
    message.startsWith("Base URL:") ||
    message.startsWith("API Base:") ||
    message.startsWith("🔥") ||
    message.startsWith("✅") ||
    message.startsWith("🚀") ||
    message.startsWith("🔍");
  const allowRequest = message.startsWith("[API]");

  if (allowStartup || allowRequest) {
    originalLog(...args);
  }
};

import { logSecurityAlert } from "./services/admin.service.js";

const app = express();
app.use(cors());
app.use(express.json());

// Basic Security Monitoring Middleware
app.use("/api", (req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  
  // Very basic XSS/SQLi heuristic check
  const checkStr = JSON.stringify(req.body) + JSON.stringify(req.query);
  if (checkStr.match(/<script>|UNION SELECT|DROP TABLE|javascript:/i)) {
    logSecurityAlert(
      'Suspicious Request', 
      'critical', 
      `Detected malicious payload in ${req.method} ${req.originalUrl}`, 
      req.ip || req.connection.remoteAddress
    );
    return res.status(403).json({ success: false, message: 'Request blocked by platform security.' });
  }
  
  // Mock login tracking for admin insights
  if (req.originalUrl.includes('/login') && req.method === 'POST') {
    // We could track login attempts here
  }
  
  next();
});

// Initialize database and load data
async function initialize() {
  try {
    await connectDB();
    
    // Load JSON data into MongoDB on first run
    const loadResult = await loadDataToMongoDB();
    if (loadResult.success) {
      console.log(`\n✅ Data Source: Hybrid (MongoDB + JSON Files)`);
      console.log(`   📊 Jobs available: ${loadResult.jobsLoaded}`);
      console.log(`   📚 Learning resources: ${loadResult.resourcesLoaded}`);
    }

    // Warm up the learning resource cache in background
    warmupCache();
  } catch (error) {
    console.error('❌ Initialization Error:', error.message);
    console.error('Full error:', error);
  }
}

// Start initialization
initialize();

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "🚀 AI-Driven Skill Learning & Job Matching Platform",
    tagline: "Free Learning for Everyone | Real-Time Job Matching",
    status: "Running ✅",
    features: [
      "355 IT Job Roles Database",
      "693 Unique Skills Tracked",
      "Hybrid AI Recommendation Engine (Content-Based + Collaborative)",
      "Real-Time YouTube Course Fetching",
      "Free Coursera & freeCodeCamp Integration",
      "AI-Powered Job Matching with TF-IDF Scoring",
      "Enhanced Skill Gap Analysis with Learning Plans",
      "Employability Score Calculator",
      "Personalized Career Roadmap",
      "AI Chatbot Assistant (SkillMatch AI)",
      "User Profile & Progress Tracking",
      "Feedback Loop & Continuous Learning",
      "Bias-Aware Diverse Recommendations",
      "100% Free Resources"
    ],
    endpoints: {
      jobMatching: "/api/jobs",
      recommendations: "/api/recommendations",
      onlineJobs: "/api/online-jobs",
      realtimeLearning: "/api/realtime-learning",
      staticLearning: "/api/learning",
      users: "/api/users",
      chatbot: "/api/chatbot"
    }
  });
});

// Register API routes
app.use("/api/jobs", jobMatchingRoutes);
app.use("/api/online-jobs", jobApiRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/realtime-learning", realtimeLearningRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/admin", adminRoutes);

// Serve static files from frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Admin panel route - serve admin.html
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/admin.html'));
});

// Default route - redirect to unified platform
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: http://localhost:${PORT}/`);
  console.log(`API Base: http://localhost:${PORT}/api`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
