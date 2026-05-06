# 🎯 Skill-Job-Matching Platform

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Latest-green?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python-3.9%2B-blue?style=flat-square&logo=python)](https://www.python.org/)
[![Express.js](https://img.shields.io/badge/Express.js-Latest-black?style=flat-square&logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)]()

</div>

An intelligent AI-powered platform that bridges the gap between job seekers and opportunities by:
- 🔍 **Matching** user skills with suitable IT jobs
- 📊 **Analyzing** skill gaps for target positions
- 📚 **Recommending** personalized learning resources
- 💬 **Guiding** career decisions through AI chatbot assistance
- 🤖 **Learning** from user interactions to improve recommendations



---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [ML Pipeline](#-ml-pipeline)
- [Contributing](#-contributing)
- [License](#-license)

---

## Overview

### Problem Statement
Job seekers often struggle with:
- ❌ Unknown skill requirements for target positions
- ❌ Difficulty identifying learning paths
- ❌ Limited guidance on career progression
- ❌ No personalized recommendations

### Solution
This platform uses **hybrid machine learning recommendations** combined with **skill gap analysis** to provide actionable career insights. Users get:
- ✅ Data-driven job recommendations
- ✅ Precise skill gap identification
- ✅ Curated learning resources (YouTube + datasets)
- ✅ AI-powered career chatbot guidance
- ✅ Progress tracking and interaction history

---

## ⭐ Key Features

### 1. **Intelligent Skill-Job Matching**
- Matches user skills against job requirements
- Considers experience level and preferences
- Returns ranked job recommendations
- Real-time matching capability

### 2. **Skill Gap Analysis**
- Identifies missing skills for target roles
- Prioritizes skills by importance
- Provides learning difficulty estimates
- Suggests learning timeline

### 3. **Personalized Learning Paths**
- YouTube video recommendations
- Curated learning resources
- Real-time learning content fetching
- Progress tracking

### 4. **Career Guidance Chatbot**
- AI-powered conversation
- Multiple provider support (Gemini, OpenAI)
- Context-aware responses
- Career planning assistance

### 5. **User Assessment System**
- Skill level evaluation
- Experience tracking
- Interaction history
- Performance analytics

### 6. **Hybrid Recommendation Engine**
- Content-based filtering
- Collaborative filtering
- Machine learning models
- Real-time adaptation

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js, Express.js | REST API, routing, middleware |
| **Database** | MongoDB, Mongoose | Data persistence, schema validation |
| **ML** | Python, Scikit-learn, Pandas | Recommendation engine, data analysis |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript | User interface, interactivity |
| **APIs** | External Job APIs, YouTube API | Data enrichment, content discovery |
| **Deployment** | Docker-ready | Easy containerization |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (HTML/CSS/JS)                   │
│            Interactive Web Interface for Users              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────────┐
│                  Express.js Backend                         │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │  Routes  │ Services │ Chatbot  │   Auth   │  Admin   │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└────────────────────────┬────────────────────────────────────┘
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌─────────────┐
    │ MongoDB │    │ ML Model │    │ External    │
    │ Database│    │ (Python) │    │ Job APIs    │
    └─────────┘    └──────────┘    └─────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have installed:
- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MongoDB** ([Local](https://docs.mongodb.com/manual/installation/) or [Atlas](https://www.mongodb.com/cloud/atlas))
- **Python** 3.9+ ([Download](https://www.python.org/downloads/))
- **npm** (comes with Node.js)

### Step 1: Clone & Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/Skill-Job-Matching-Minor.git
cd Skill-Job-Matching-Minor

# Install backend dependencies
cd backend
npm install

# Install Python ML dependencies (optional)
cd ml
pip install -r requirements.txt
cd ../../data/learning_pipeline
pip install -r requirements.txt
```

### Step 2: Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGO_URI=mongodb://127.0.0.1:27017/skillmatch
# OR for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/skillmatch

# AI/Chatbot Providers (choose one or use 'auto')
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
CHATBOT_PROVIDER=auto  # Options: gemini, openai, auto

# External APIs (Optional)
YOUTUBE_API_KEY=your_youtube_api_key
ADZUNA_APP_ID=your_adzuna_id
ADZUNA_APP_KEY=your_adzuna_key
RAPIDAPI_KEY=your_rapidapi_key
REED_API_KEY=your_reed_key
THEIRSTACK_API_KEY=your_theirstack_key

# ML Configuration
PYTHON_PATH=python
PYTHON_EXECUTABLE=python
```

### Step 3: Start Backend

```bash
cd backend

# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Expected output:
```
✓ Connected to MongoDB
✓ Server running on http://localhost:5000
✓ Data loader initialized
```

### Step 4: Access Frontend

Open your browser and navigate to:
- **Main Dashboard**: http://localhost:5000/
- **Job Matching**: http://localhost:5000/job-matching-final.html
- **Learning Resources**: http://localhost:5000/learning-resources.html
- **Assessment**: http://localhost:5000/assessment.html
- **Chat Interface**: http://localhost:5000/chat-interface.html

---

## 📡 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Core Endpoints

#### Job Matching & Recommendations
```
POST   /api/jobs/match              - Match user skills to jobs
GET    /api/recommendations         - Get personalized recommendations
GET    /api/jobs/:id                - Get job details
GET    /api/online-jobs            - Fetch from external job APIs
```

#### Learning Resources
```
GET    /api/learning/resources     - Get static learning resources
GET    /api/realtime-learning/fetch - Fetch real-time learning content
GET    /api/learning/gaps          - Get skill gap learning suggestions
```

#### Chatbot & Guidance
```
POST   /api/chatbot/chat           - Send message to AI chatbot
GET    /api/chatbot/history        - Get chat history
POST   /api/chatbot/clear          - Clear chat session
```

#### User Management
```
POST   /api/users/register         - Register new user
POST   /api/users/profile          - Update user profile
GET    /api/users/:id              - Get user details
POST   /api/users/interactions     - Log user interaction
```

#### Assessment & Analysis
```
POST   /api/assessment/evaluate    - Evaluate user skills
GET    /api/assessment/report      - Get assessment report
POST   /api/assessment/analyze     - Analyze skill gaps
```

### Example Request

```bash
# Curl example - Match skills to jobs
curl -X POST http://localhost:5000/api/jobs/match \
  -H "Content-Type: application/json" \
  -d '{
    "skills": ["JavaScript", "React", "Node.js"],
    "experience_level": "intermediate",
    "preferred_roles": ["Frontend Developer", "Full Stack Developer"]
  }'
```

---

## 📁 Project Structure

```
Skill-Job-Matching-Minor/
│
├── README.md                          # This file
├── technical_blueprint.md              # Architecture documentation
│
├── backend/                            # Express.js server
│   ├── server.js                      # Entry point
│   ├── package.json                   # Dependencies
│   ├── .env                           # Configuration (create this)
│   │
│   ├── config/
│   │   └── db.js                      # MongoDB connection
│   │
│   ├── models/                        # Mongoose schemas
│   │   ├── User.js
│   │   ├── Job.js
│   │   ├── LearningResource.js
│   │   └── UserInteraction.js
│   │
│   ├── routes/                        # API route handlers
│   │   ├── job.matching.routes.js
│   │   ├── recommendation.routes.js
│   │   ├── learning.routes.js
│   │   ├── chatbot.routes.js
│   │   ├── user.routes.js
│   │   ├── assessment.routes.js
│   │   └── admin.routes.js
│   │
│   ├── services/                      # Business logic
│   │   ├── job.matching.service.js
│   │   ├── hybrid.job.service.js
│   │   ├── recommendation.service.js
│   │   ├── learning.service.js
│   │   ├── ai.chatbot.service.js
│   │   ├── user.service.js
│   │   └── admin.service.js
│   │
│   ├── ml/                            # Python ML models
│   │   ├── hybrid_recommender.py      # Main ML model
│   │   ├── requirements.txt
│   │   └── models/
│   │       └── hybrid_model.joblib
│   │
│   └── data/                          # Dataset initialization
│       ├── jobs_dataset.json
│       ├── learning_resources.json
│       ├── generate_jobs.py
│       └── learning_pipeline/
│           ├── dataset_builder.py
│           ├── feature_engineering.py
│           ├── modeling.py
│           └── pipeline.py
│
├── frontend/                          # Browser interface
│   └── public/
│       ├── index.html                 # Landing page
│       ├── job-matching-final.html    # Job matching interface
│       ├── learning-resources.html    # Learning resources page
│       ├── assessment.html            # Assessment interface
│       ├── chat-interface.html        # Chatbot interface
│       └── admin.html                 # Admin dashboard
│
├── Data/                              # Large datasets
│   ├── job_dataset_1M.csv            # 1M jobs dataset
│   └── job_dataset.csv               # Full job dataset
│
└── docs/                              # Documentation (optional)
    ├── API.md
    ├── SETUP.md
    └── TROUBLESHOOTING.md
```

---

## ⚙️ Configuration

### Environment Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | Number | 5000 | Server port |
| `MONGO_URI` | String | localhost | MongoDB connection string |
| `CHATBOT_PROVIDER` | String | auto | AI provider (gemini/openai/auto) |
| `PYTHON_PATH` | String | python | Python executable path |
| `YOUTUBE_API_KEY` | String | - | YouTube Data API key |
| `NODE_ENV` | String | development | Environment mode |

### Database Initialization

The backend automatically initializes MongoDB with:
- Job collection
- User collection
- Learning resources
- Recommended mappings

No manual migration needed!

---

## 🤖 ML Pipeline

### Training the Model

```bash
cd backend
npm run ml:train
```

This:
1. Loads job and skill datasets
2. Extracts features from job descriptions
3. Trains the hybrid recommender model
4. Saves model to `ml/models/hybrid_model.joblib`

### Getting Recommendations

```bash
npm run ml:recommend
```

Interactive CLI for testing recommendations locally.

### Model Architecture

```
Input: User Skills + Experience
         │
         ├─→ [Skill Embeddings]
         │
         ├─→ [Experience Scoring]
         │
         └─→ [Hybrid Recommender]
                │
                ├─→ Content-Based Filtering
                ├─→ Collaborative Filtering
                └─→ ML Ranking
                     │
                     └─→ Output: Ranked Jobs
```

---

## 🔧 Development Commands

```bash
# Backend commands
npm start                 # Start production server
npm run dev              # Start with auto-reload
npm run ml:train         # Train ML model
npm run ml:recommend     # Test recommendations

# Code quality
npm run lint             # Check code style
npm run format           # Format code

# Testing
npm test                 # Run all tests
npm run test:chatbot     # Test chatbot integration
```

---

## 🐳 Docker Setup (Optional)

Create a `Dockerfile` in the root directory:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Backend setup
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Frontend
COPY frontend ./frontend

# Data
COPY Data ./Data
COPY backend/data ./backend/data

COPY backend ./backend

EXPOSE 5000

CMD ["npm", "--prefix", "backend", "start"]
```

Build and run:

```bash
docker build -t skill-job-matcher .
docker run -p 5000:5000 -e MONGO_URI=your_mongo_uri skill-job-matcher
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to help:

### Fork & Clone
```bash
git clone https://github.com/yourusername/Skill-Job-Matching-Minor.git
git checkout -b feature/your-feature
```

### Development Workflow
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Commit with clear messages
5. Push and create a Pull Request

### Reporting Issues
Please use [GitHub Issues](../../issues) with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

### Code Style
- Use ESLint (for JavaScript)
- Use PEP8 (for Python)
- Add comments for complex logic
- Write meaningful commit messages

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Start MongoDB locally: `mongod`
- Or update `MONGO_URI` to use MongoDB Atlas

### Python Not Found
```
Error: 'python' is not recognized
```

**Solution:**
```bash
# Update .env
PYTHON_PATH=/usr/bin/python3
PYTHON_EXECUTABLE=python3
```

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```

**Solution:**
```bash
# Change port in .env
PORT=3000

# Or kill existing process
lsof -ti:5000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :5000   # Windows
```

### Missing API Keys
Most features work without API keys, but some are enhanced with:
- **Chatbot**: Requires Gemini or OpenAI key
- **YouTube Resources**: Requires YouTube API key
- **External Jobs**: Requires respective API keys

Leave them blank to use default functionality.

---

## 📊 Performance Metrics

- **Job Matching**: < 100ms average response time
- **Recommendations**: < 500ms with ML model
- **Database Queries**: Indexed for optimal performance
- **Frontend**: Vanilla JS, no heavy dependencies

---

## 🔒 Security Considerations

- ✅ Environment variables for sensitive data
- ✅ Input validation on all endpoints
- ✅ MongoDB injection prevention (via Mongoose)
- ✅ CORS enabled for development
- 🔜 Add authentication/authorization layer
- 🔜 Implement rate limiting
- 🔜 Add HTTPS/SSL support

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Guide](https://docs.mongodb.com/)
- [Python ML Tutorial](https://scikit-learn.org/stable/index.html)
- [Technical Blueprint](./technical_blueprint.md)

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 👥 Authors & Contributors

- **Jeeban Jyoti Pradhan** - Initial development
- **Nikhil Kumar** - Welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## ⭐ Support

If this project helped you, please consider giving it a star! ⭐

**Questions?** Open an [issue](../../issues) or start a [discussion](../../discussions)

---

<div align="center">

**[↑ Back to Top](#-skill-job-matching-platform)**

Made with ❤️ for job seekers and career enthusiasts

</div>

