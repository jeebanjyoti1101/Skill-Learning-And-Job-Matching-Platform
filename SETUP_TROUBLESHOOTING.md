# Setup & Troubleshooting Guide

Comprehensive setup and troubleshooting guide for Skill-Job-Matching-Minor.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18+ ([Download](https://nodejs.org/))
- [ ] npm 8+ (comes with Node.js)
- [ ] MongoDB 4.4+ (Local or [Atlas](https://www.mongodb.com/cloud/atlas))
- [ ] Python 3.9+ ([Download](https://www.python.org/downloads/))
- [ ] Git ([Download](https://git-scm.com/))
- [ ] A code editor (VS Code recommended)

---

## ✅ Verification Steps

### Check Node.js
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

### Check Python
```bash
python --version    # Should be 3.9 or higher
# or
python3 --version   # For macOS/Linux
```

### Check Git
```bash
git --version  # Should be 2.0 or higher
```

### Check MongoDB
```bash
mongod --version  # For local MongoDB
```

---

## 🚀 Complete Installation Guide

### Step 1: Clone Repository

```bash
# Via HTTPS
git clone https://github.com/yourusername/Skill-Job-Matching-Minor.git

# Or via SSH (if configured)
git clone git@github.com:yourusername/Skill-Job-Matching-Minor.git

# Navigate to project
cd Skill-Job-Matching-Minor
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# If npm install fails, try:
npm install --legacy-peer-deps

# Install global dependencies (if needed)
npm install -g nodemon
```

**Dependencies installed:**
- express - Web framework
- mongoose - MongoDB ORM
- dotenv - Environment variables
- axios - HTTP client
- cors - Cross-origin resource sharing
- body-parser - Request body parsing

### Step 3: Environment Configuration

Create `.env` file in `backend/` directory:

```bash
# Windows
echo. > .env

# macOS/Linux
touch .env
```

**Minimum configuration** (copy to `.env`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/skillmatch
CHATBOT_PROVIDER=auto
```

**Full configuration template:**
```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=5000
NODE_ENV=development
DEBUG=true

# ============================================
# DATABASE
# ============================================
# Local MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/skillmatch

# OR MongoDB Atlas (replace with your credentials)
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/skillmatch

# ============================================
# AI & CHATBOT PROVIDERS
# ============================================
# Get keys from:
# - Gemini: https://makersuite.google.com/app/apikey
# - OpenAI: https://platform.openai.com/api-keys
GEMINI_API_KEY=
OPENAI_API_KEY=
CHATBOT_PROVIDER=auto  # Options: gemini, openai, auto

# ============================================
# EXTERNAL APIS (OPTIONAL)
# ============================================
# YouTube API: https://console.cloud.google.com/
YOUTUBE_API_KEY=

# Job APIs
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
RAPIDAPI_KEY=
REED_API_KEY=
THEIRSTACK_API_KEY=

# ============================================
# PYTHON CONFIGURATION
# ============================================
PYTHON_PATH=python
PYTHON_EXECUTABLE=python
# Use these on Windows:
# PYTHON_PATH=C:\Python39\python.exe
# PYTHON_EXECUTABLE=C:\Python39\python.exe
```

### Step 4: Setup MongoDB

**Option A: Local MongoDB (Windows)**
```bash
# Download from: https://www.mongodb.com/try/download/community
# Install with default settings
# MongoDB will run on localhost:27017

# Start MongoDB service
mongod

# In another terminal, verify connection
mongo
```

**Option B: MongoDB Atlas (Cloud)**

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create new cluster
4. Get connection string
5. Update `.env`:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/skillmatch
   ```

**Option C: Docker MongoDB**
```bash
# Install Docker first
docker pull mongo
docker run -d -p 27017:27017 --name mongodb mongo
```

### Step 5: Install Python ML Dependencies (Optional)

```bash
# Navigate to ML directory
cd backend/ml
pip install -r requirements.txt

# Or for Python 3.9+
pip3 install -r requirements.txt

# Verify installation
python -c "import sklearn; print(sklearn.__version__)"
```

### Step 6: Start Backend Server

```bash
cd backend

# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start

# Expected output:
# ✓ Server running on http://localhost:5000
# ✓ Connected to MongoDB
# ✓ Data loader initialized
```

### Step 7: Verify Installation

```bash
# Open new terminal/command prompt
# Test API endpoint
curl http://localhost:5000/api

# Expected response:
# {"status": "OK", "message": "Skill-Job-Matching API"}
```

### Step 8: Access Frontend

Open browser and visit:
- **Dashboard**: http://localhost:5000/
- **Job Matching**: http://localhost:5000/job-matching-final.html
- **Learning**: http://localhost:5000/learning-resources.html
- **Assessment**: http://localhost:5000/assessment.html
- **Chat**: http://localhost:5000/chat-interface.html

---

## 🐛 Troubleshooting

### 1. MongoDB Connection Error

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
MongoDB connection failed
```

**Solutions:**

```bash
# Option 1: Start MongoDB
mongod

# Option 2: Check if MongoDB is running
# Windows
netstat -ano | findstr :27017

# macOS/Linux
lsof -i :27017

# Option 3: Use MongoDB Atlas
# Update .env with correct connection string
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db

# Option 4: Check MongoDB service
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### 2. Port Already in Use

**Error:**
```
Error: listen EADDRINUSE :::5000
```

**Solutions:**

```bash
# Option 1: Change port in .env
PORT=3000

# Option 2: Kill process using port
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>

# Option 3: Find what's using port
# Windows
netstat -tulpn | grep :5000

# macOS
sudo lsof -i :5000
```

### 3. Node Modules Issues

**Error:**
```
Cannot find module 'express'
npm ERR! missing: express@^4.18.0
```

**Solutions:**

```bash
# Option 1: Reinstall all packages
rm -rf node_modules package-lock.json
npm install

# Option 2: Install with legacy peer deps
npm install --legacy-peer-deps

# Option 3: Clear npm cache
npm cache clean --force
npm install

# Option 4: Use specific Node version
nvm install 18
nvm use 18
npm install
```

### 4. Python Not Found

**Error:**
```
'python' is not recognized as an internal or external command
Python dependency installation failed
```

**Solutions:**

```bash
# Option 1: Check Python installation
python --version
python3 --version

# Option 2: Find Python path
# Windows
where python

# macOS/Linux
which python3

# Option 3: Update .env with correct path
PYTHON_PATH=/usr/bin/python3
PYTHON_EXECUTABLE=/usr/bin/python3

# Option 4: Add Python to PATH (Windows)
# See: https://www.educative.io/edpresso/how-to-add-python-to-the-path-variable-in-windows

# Option 5: Reinstall Python
# Download from: https://www.python.org/downloads/
```

### 5. npm start Fails

**Error:**
```
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path package.json
```

**Solutions:**

```bash
# Make sure you're in correct directory
pwd  # or cd on Windows
ls backend/package.json

# Start from correct location
cd backend
npm start

# Check package.json exists
cat package.json  # or type on Windows
```

### 6. API Endpoints Return 404

**Error:**
```
GET http://localhost:5000/api/jobs/match
404 Not Found
```

**Solutions:**

```bash
# 1. Check server is running
# Should see: "✓ Server running on http://localhost:5000"

# 2. Test basic endpoint
curl http://localhost:5000/api

# 3. Check routes are loaded
# Look at backend/routes/ files
# Verify imports in server.js

# 4. Check MongoDB data is loaded
# Connect to MongoDB and verify collections
mongo
use skillmatch
db.jobs.count()
```

### 7. Chatbot API Key Issues

**Error:**
```
Chatbot error: Invalid API key
GEMINI_API_KEY is required
```

**Solutions:**

```bash
# 1. Get free API keys:
# Gemini: https://makersuite.google.com/app/apikey
# OpenAI: https://platform.openai.com/api-keys

# 2. Add to .env
GEMINI_API_KEY=your_actual_key_here
OPENAI_API_KEY=your_actual_key_here

# 3. Don't commit .env to Git!
echo ".env" >> .gitignore

# 4. Test API key
npm run test:chatbot
```

### 8. Frontend Not Loading

**Error:**
```
Cannot GET /
Page not found
```

**Solutions:**

```bash
# 1. Check frontend files exist
ls frontend/public/
ls frontend/public/index.html

# 2. Restart server from project root
npm start  # Must be from project root, not backend folder

# 3. Check server configuration
cat backend/config/db.js
grep -r "public" backend/server.js

# 4. Try specific URL
http://localhost:5000/index.html
http://localhost:5000/job-matching-final.html
```

### 9. ML Model Issues

**Error:**
```
Error: ML model not found
Failed to load hybrid_model.joblib
```

**Solutions:**

```bash
# 1. Train the model
cd backend
npm run ml:train

# 2. Check model file exists
ls backend/ml/models/hybrid_model.joblib

# 3. Check Python dependencies
pip list | grep -i scikit-learn
pip list | grep -i pandas

# 4. Reinstall ML dependencies
pip install -r backend/ml/requirements.txt --force-reinstall
```

### 10. CORS Errors

**Error:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solutions:**

```bash
# 1. Check CORS is enabled in server.js
grep -i cors backend/server.js

# 2. For development, use same origin
# Frontend: http://localhost:5000
# API: http://localhost:5000/api

# 3. Check frontend URLs
grep -r "localhost:5000" frontend/public/

# 4. Update CORS settings if needed
# In backend/server.js:
app.use(cors({
  origin: '*',  // for development
  credentials: true
}));
```

---

## ✨ Performance Optimization

### Database Optimization

```bash
# Connect to MongoDB
mongo

# Create indexes for faster queries
use skillmatch
db.jobs.createIndex({ skills: 1 })
db.users.createIndex({ email: 1 })
db.learning_resources.createIndex({ category: 1 })

# Check indexes
db.jobs.getIndexes()
```

### Node.js Optimization

```bash
# Use node clustering in production
# Edit backend/server.js to add:
const cluster = require('cluster');
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  // Fork workers
}

# Enable caching
# Add Redis to improve performance
npm install redis
```

### MongoDB Atlas Performance

- Use M0 (free) tier for development
- Upgrade to M2+ for production
- Enable auto-scaling
- Create appropriate indexes

---

## 🔐 Security Best Practices

### Before Deploying

1. **Never commit .env file**
   ```bash
   echo ".env" >> .gitignore
   git rm --cached .env  # if already committed
   ```

2. **Rotate API keys**
   - Generate new API keys regularly
   - Remove old ones from MongoDB

3. **Use strong database password**
   - Minimum 8 characters
   - Include special characters

4. **Enable HTTPS**
   - Use SSL certificates
   - Update API base URL to https://

5. **Add authentication**
   - Implement JWT tokens
   - Add user authentication

6. **Rate limiting**
   ```bash
   npm install express-rate-limit
   ```

---

## 🚀 Deployment Preparation

### Checklist

- [ ] All tests passing
- [ ] No console errors
- [ ] Environment variables set
- [ ] Database backed up
- [ ] API keys rotated
- [ ] HTTPS enabled
- [ ] Logging configured
- [ ] Error handling in place
- [ ] Performance optimized
- [ ] Documentation updated

### Deployment Platforms

- **Heroku** - Easy cloud deployment
- **AWS** - Scalable infrastructure
- **DigitalOcean** - Affordable VPS
- **Railway** - Modern deployment platform
- **Render** - Free tier available
- **Docker** - Containerized deployment

---

## 📞 Getting Help

- 📖 Check [README.md](README.md)
- 🔗 See [technical_blueprint.md](technical_blueprint.md)
- 💬 Ask in [Discussions](../../discussions)
- 🐛 Report in [Issues](../../issues)
- 📧 Contact maintainers

---

<div align="center">

**Still stuck? Create an issue with your error message!**

We're here to help! 🤝

</div>
