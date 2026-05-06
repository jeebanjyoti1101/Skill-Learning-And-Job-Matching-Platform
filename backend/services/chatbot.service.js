import { getAllJobs, getSkillsFrequency } from './data.loader.service.js';
import { getEnhancedSkillGap, getHybridRecommendations } from './recommendation.service.js';
import { createGuestProfile } from './user.service.js';

/**
 * =======================================================================
 * Chatbot Assistant Service
 * Conversational AI assistant for the Skill Learning & Job Matching Platform
 * =======================================================================
 */

const skillsData = getSkillsFrequency();
const PLATFORM_NAME = 'SkillMatch AI';

// Intent patterns for NLU
const INTENT_PATTERNS = {
  greeting: /^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|what'?s up|sup)/i,
  farewell: /^(bye|goodbye|see you|take care|thanks|thank you|cheers)/i,
  help: /(help|what can you do|how does this work|guide|assist|tutorial)/i,
  job_match: /(find|match|recommend|suggest|show).*(job|role|position|career|work|opening)/i,
  skill_gap: /(skill\s*gap|what.*missing|what.*need|gap\s*analysis|compare.*skills)/i,
  career_path: /(career\s*path|roadmap|career\s*plan|next\s*steps|grow|advance)/i,
  learning: /(learn|course|tutorial|study|train|resource|certification|upskill|reskill)/i,
  top_skills: /(top\s*skills|trending|in\s*demand|popular\s*skills|market\s*demand|hot\s*skills)/i,
  job_search: /(search|look\s*for|find|browse).*(specific|keyword|name)/i,
  profile: /(profile|about\s*me|my\s*data|my\s*skills|my\s*account|settings)/i,
  stats: /(stats|statistics|numbers|how\s*many|data|count|total)/i,
  explain_score: /(explain|how.*score|how.*match|what.*mean|how.*work|algorithm)/i,
  salary: /(salary|pay|compensation|earnings|income)/i,
  compare: /(compare|versus|vs|difference.*between)/i,
  motivation: /(motivat|inspir|encourage|tip|advice)/i
};

/**
 * Detect intent from user message
 */
function detectIntent(message) {
  const msg = message.trim();

  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(msg)) {
      return intent;
    }
  }

  // Check if the message contains skill-like words
  const skillsList = skillsData.skills?.slice(0, 100).map(s => s.name?.toLowerCase()) || [];
  const msgLower = msg.toLowerCase();
  const mentionsSkill = skillsList.some(s => s && msgLower.includes(s));

  if (mentionsSkill) return 'skill_inquiry';

  return 'general';
}

/**
 * Extract skills from user message
 */
function extractSkills(message) {
  const knownSkills = skillsData.skills?.map(s => s.name) || [];
  const msgLower = message.toLowerCase();

  const found = knownSkills.filter(skill => {
    // Make sure skill is defined before calling toLowerCase
    if (!skill) return false;
    return msgLower.includes(skill.toLowerCase());
  });

  // Also extract quoted or comma-separated items
  const quotedMatch = message.match(/"([^"]+)"/g);
  if (quotedMatch) {
    found.push(...quotedMatch.map(q => q.replace(/"/g, '').trim()));
  }

  return [...new Set(found)];
}

/**
 * Extract job title from message
 */
function extractJobTitle(message) {
  // Common patterns
  const patterns = [
    /(?:for|as|become|to be)\s+(?:a|an)?\s*(.+?)(?:\?|$|\.)/i,
    /(?:gap|analysis|compare).*?(?:for|with)\s+(.+?)(?:\?|$|\.)/i,
    /"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

/**
 * Main chatbot response handler
 */
export const getChatbotResponse = async (message, context = {}) => {
  const startTime = Date.now();
  
  try {
    console.log('[Chatbot Service] Processing message...');
    console.log('[Chatbot Service] Context skills:', context.userSkills?.length || 0);
    
    const intent = detectIntent(message);
    console.log('[Chatbot Service] Detected intent:', intent);
    
    const skills = extractSkills(message);
    console.log('[Chatbot Service] Extracted skills:', skills);
    
    const sessionSkills = context.userSkills || [];
    const allSkills = [...new Set([...sessionSkills, ...skills])];

    let response = {};

    switch (intent) {
      case 'greeting':
        response = handleGreeting(context);
        break;
      case 'farewell':
        response = handleFarewell();
        break;
      case 'help':
        response = handleHelp();
        break;
      case 'job_match':
        response = await handleJobMatch(allSkills, message);
        break;
      case 'skill_gap':
        response = await handleSkillGap(allSkills, message);
        break;
      case 'career_path':
        response = await handleCareerPath(allSkills);
        break;
      case 'learning':
        response = handleLearning(allSkills, message);
        break;
      case 'top_skills':
        response = handleTopSkills();
        break;
      case 'profile':
        response = handleProfile(context);
        break;
      case 'stats':
        response = await handleStats();
        break;
      case 'explain_score':
        response = handleExplainScore();
        break;
      case 'salary':
        response = handleSalary(message);
        break;
      case 'compare':
        response = await handleCompare(message);
        break;
      case 'motivation':
        response = handleMotivation();
        break;
      case 'skill_inquiry':
        response = handleSkillInquiry(skills);
        break;
      default:
        response = handleGeneral(message);
        break;
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Chatbot Service] ✅ Response generated in ${processingTime}ms`);

    return {
      success: true,
      intent,
      ...response,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[Chatbot Service] ❌ Error:', error.message);
    console.error('[Chatbot Service] Stack:', error.stack);
    console.error('[Chatbot Service] Failed after:', processingTime + 'ms');
    
    return {
      success: true,
      intent: 'error',
      message: "I apologize, I encountered an issue processing your request. Could you try rephrasing your question?",
      suggestions: ['Find jobs for my skills', 'Show top skills', 'Help me get started'],
      error: {
        message: error.message,
        type: error.name,
        timestamp: new Date().toISOString()
      }
    };
  }
};

// ── Intent Handlers ──────────────────────────────────────────────────

function handleGreeting(context) {
  const name = context.userName || '';
  const greetings = [
    `Hi${name ? ` ${name}` : ''}! 👋 Welcome to SkillMatching AI. Share your current skills or target role, and I will find the best job matches for you.`,
    `Hello${name ? ` ${name}` : ''}! 🚀 Welcome to SkillMatching AI. I can help with job matching, skill-gap analysis, and personalized learning recommendations.`,
    `Welcome${name ? ` back, ${name}` : ''}! 🎯 You are now in SkillMatching AI. Tell me your interests in IT, and I will guide your next career steps.`
  ];

  return {
    message: greetings[Math.floor(Math.random() * greetings.length)],
    suggestions: [
      'Find jobs matching my skills',
      'What are the top skills in demand?',
      'Analyze my skill gap',
      'Help me plan my career'
    ],
    type: 'greeting'
  };
}

function handleFarewell() {
  const farewells = [
    "Goodbye! 👋 Best of luck with your career journey. Come back anytime you need guidance!",
    "See you later! 🌟 Keep learning and growing. I'll be here whenever you need me!",
    "Take care! 🚀 Remember, every skill you learn brings you closer to your dream job!"
  ];

  return {
    message: farewells[Math.floor(Math.random() * farewells.length)],
    type: 'farewell'
  };
}

function handleHelp() {
  return {
    message: `I'm ${PLATFORM_NAME}, your AI career assistant! Here's what I can do for you:`,
    features: [
      { icon: '🎯', title: 'Job Matching', description: 'Find jobs that match your skills using our hybrid AI algorithm' },
      { icon: '📊', title: 'Skill Gap Analysis', description: 'Compare your skills against any job role' },
      { icon: '🗺️', title: 'Career Roadmap', description: 'Get a personalized career path with learning milestones' },
      { icon: '📚', title: 'Learning Resources', description: 'Get curated courses, tutorials, and certifications' },
      { icon: '📈', title: 'Market Insights', description: 'See trending skills and market demand' },
      { icon: '💬', title: 'Career Guidance', description: 'Ask me anything about tech careers!' }
    ],
    suggestions: [
      'Find jobs for JavaScript, React, Node.js',
      'Skill gap for Data Scientist',
      'What are top trending skills?',
      'Show my career roadmap'
    ],
    type: 'help'
  };
}

async function handleJobMatch(skills, message) {
  if (skills.length === 0) {
    return {
      message: "I'd love to help you find matching jobs! 🎯 Please tell me your skills. For example: \"Find jobs for Python, Machine Learning, and SQL\"",
      suggestions: [
        'Find jobs for Python, SQL, Machine Learning',
        'Jobs matching JavaScript, React, Node.js',
        'Match me with Java, Spring Boot roles'
      ],
      type: 'needs_input',
      inputType: 'skills'
    };
  }

  const profile = createGuestProfile(skills);
  const recommendations = await getHybridRecommendations(profile, { limit: 5, minScore: 10 });

  if (!recommendations.success || recommendations.jobs.length === 0) {
    return {
      message: `I couldn't find strong matches for your skills (${skills.join(', ')}). Try adding more skills or broadening your search.`,
      suggestions: ['Show all available jobs', 'What skills are in demand?', 'Try different skills'],
      type: 'no_results'
    };
  }

  const topJobs = recommendations.jobs.slice(0, 5);
  return {
    message: `Great news! 🎉 I found **${recommendations.statistics.matchingJobs}** matching jobs for your skills. Here are the top ${topJobs.length}:`,
    jobs: topJobs.map(j => ({
      title: j.title,
      score: j.hybridScore,
      matchingSkills: j.directMatches.length,
      missingSkills: j.missingSkillsCount,
      readiness: j.readinessLevel
    })),
    statistics: recommendations.statistics,
    suggestions: [
      `Skill gap for "${topJobs[0].title}"`,
      'Show more matches',
      'Find learning resources for missing skills',
      'Start a career roadmap'
    ],
    type: 'job_matches'
  };
}

async function handleSkillGap(skills, message) {
  const jobTitle = extractJobTitle(message);

  if (!jobTitle && skills.length === 0) {
    return {
      message: "I can analyze the gap between your skills and any target job! 📊 Please tell me:\n1. Your skills\n2. The job role you're targeting\n\nExample: \"Skill gap for Data Scientist with Python and SQL\"",
      suggestions: [
        'Skill gap for Data Scientist',
        'What skills do I need for DevOps Engineer?',
        'Compare my skills for Full Stack Developer'
      ],
      type: 'needs_input'
    };
  }

  if (!jobTitle) {
    return {
      message: `I see you have skills in: ${skills.join(', ')}. Which job role would you like me to compare against?`,
      suggestions: [
        'Data Scientist', 'Full Stack Developer', 'DevOps Engineer',
        'Cloud Architect', 'ML Engineer', 'Cybersecurity Analyst'
      ],
      type: 'needs_job_title'
    };
  }

  const analysis = await getEnhancedSkillGap(skills.length > 0 ? skills : ['general'], jobTitle);

  if (!analysis.success) {
    return {
      message: analysis.message,
      suggestions: ['Show all job titles', 'Try a different job', 'Find jobs for my skills'],
      type: 'error'
    };
  }

  return {
    message: `📊 **Skill Gap Analysis for "${analysis.job.title}"**\n\n` +
      `Your match score: **${analysis.analysis.overallScore}%** (${analysis.analysis.readinessLevel})\n` +
      `Skills matched: ${analysis.analysis.directMatches} direct, ${analysis.analysis.relatedMatches} related\n` +
      `Skills to learn: ${analysis.analysis.missingSkills}`,
    analysis: analysis,
    suggestions: [
      `Learn ${analysis.missingSkills[0]?.skill || 'top skill'}`,
      'Find matching jobs instead',
      'Show full learning plan',
      'Career roadmap'
    ],
    type: 'skill_gap'
  };
}

async function handleCareerPath(skills) {
  if (skills.length === 0) {
    return {
      message: "Let's plan your career! 🗺️ Tell me your current skills, and I'll create a personalized roadmap with immediate opportunities and growth targets.",
      suggestions: [
        'Career path for Python, Django, SQL',
        'Roadmap for JavaScript, React',
        'Plan career with Java, Spring Boot'
      ],
      type: 'needs_input'
    };
  }

  const profile = createGuestProfile(skills);
  const recs = await getHybridRecommendations(profile, { limit: 30, minScore: 5 });

  if (!recs.success) {
    return { message: "Unable to build career path. Try adding more skills.", type: 'error' };
  }

  const immediate = recs.jobs.filter(j => j.hybridScore >= 60);
  const shortTerm = recs.jobs.filter(j => j.hybridScore >= 35 && j.hybridScore < 60);
  const longTerm = recs.jobs.filter(j => j.hybridScore < 35);

  return {
    message: `🗺️ **Your Career Roadmap** (based on ${skills.join(', ')})\n\n` +
      `✅ **Ready Now**: ${immediate.length} roles (${immediate.slice(0, 3).map(j => j.title).join(', ') || 'None yet'})\n` +
      `📈 **1-3 months**: ${shortTerm.length} roles achievable with focused learning\n` +
      `🚀 **3-6 months**: ${longTerm.length} aspirational roles`,
    careerPath: {
      immediate: immediate.slice(0, 5),
      shortTerm: shortTerm.slice(0, 5),
      longTerm: longTerm.slice(0, 5)
    },
    suggestions: [
      immediate.length > 0 ? `Skill gap for "${immediate[0].title}"` : 'What skills should I learn?',
      'Find learning resources',
      'Top skills in demand'
    ],
    type: 'career_path'
  };
}

function handleLearning(skills, message) {
  if (skills.length === 0) {
    return {
      message: "📚 I can help you find the best learning resources! What skills would you like to learn? I'll find courses from YouTube, Coursera, freeCodeCamp, and more.",
      suggestions: [
        'Learn Python', 'Learn React', 'Learn Docker',
        'Machine Learning courses', 'Cloud computing tutorials'
      ],
      type: 'needs_input'
    };
  }

  return {
    message: `📚 Great choice! Here's how to get started with **${skills.join(', ')}**:\n\n` +
      `Head to the **Learning** section of the platform for curated courses and tutorials. ` +
      `We pull resources from YouTube, Coursera, and freeCodeCamp in real-time!`,
    skills: skills,
    suggestions: [
      `Skill gap for roles requiring ${skills[0]}`,
      'Find jobs matching these skills',
      'Show learning roadmap'
    ],
    type: 'learning',
    action: { type: 'navigate', target: 'learning', params: { skills } }
  };
}

function handleTopSkills() {
  const top = skillsData.skills?.slice(0, 15) || [];

  return {
    message: "📈 **Top Skills in Demand** (from our job analysis):\n\n" +
      top.map((s, i) => `${i + 1}. **${s.name}** — found in ${s.frequency} job roles`).join('\n'),
    topSkills: top,
    suggestions: [
      `Find jobs for ${top[0]?.name || 'top skill'}`,
      `Learn ${top[0]?.name || 'top skill'}`,
      'Show more skills',
      'Career path with top skills'
    ],
    type: 'top_skills'
  };
}

function handleProfile(context) {
  if (context.userEmail) {
    return {
      message: "Here's your profile summary! You can update your skills, experience, and career goals anytime.",
      suggestions: ['Add skills', 'Update career goals', 'View my progress', 'Profile completeness'],
      type: 'profile',
      action: { type: 'navigate', target: 'profile' }
    };
  }

  return {
    message: "📋 Create a profile to save your skills, track progress, and get personalized recommendations! It's quick and free.",
    suggestions: ['Create profile', 'Continue as guest', 'Why create a profile?'],
    type: 'profile_prompt'
  };
}

async function handleStats() {
  const jobsData = await getAllJobs();

  return {
    message: `📊 **Platform Statistics**\n\n` +
      `🎯 **${jobsData.length}** IT job roles in database\n` +
      `🛠️ **${skillsData.total || 0}** unique skills tracked\n` +
      `📈 **${skillsData.skills?.length || 0}** skills with demand data\n` +
      `🤖 **Hybrid AI** recommendation engine\n` +
      `📚 Real-time learning from **YouTube + Coursera + freeCodeCamp**`,
    statistics: {
      totalJobs: jobsData.length,
      totalSkills: skillsData.total || 0,
      topCategory: 'Information Technology',
      algorithm: 'Hybrid (Content-Based + Collaborative)'
    },
    suggestions: ['Find matching jobs', 'Top skills in demand', 'How does matching work?'],
    type: 'stats'
  };
}

function handleExplainScore() {
  return {
    message: `🧠 **How Our Matching Algorithm Works**\n\n` +
      `We use a **Hybrid Recommendation System** that combines:\n\n` +
      `1. **Skill Matching (50%)** — Direct and related skill overlap using enhanced matching with skill synonyms\n` +
      `2. **TF-IDF Similarity (25%)** — Weighs rare, specialized skills higher than common ones\n` +
      `3. **Collaborative Filtering (15%)** — Learns from what similar users applied to\n` +
      `4. **Experience Level (10%)** — Matches your career stage to appropriate roles\n\n` +
      `The system also identifies related skills (e.g., React counts partially for JavaScript roles) and prioritizes diverse recommendations.`,
    suggestions: ['Try it now with my skills', 'What are top skills?', 'Tell me more about skill gaps'],
    type: 'explanation'
  };
}

function handleSalary(message) {
  return {
    message: "💰 Salary information varies by location, experience, and company. While we don't have specific salary data in our database, here are some tips:\n\n" +
      "1. Use **Glassdoor** or **Levels.fyi** for salary benchmarks\n" +
      "2. Skills in high demand (Cloud, ML, DevOps) typically command higher salaries\n" +
      "3. Certifications can increase your earning potential by 10-20%\n" +
      "4. Remote roles may offer location-adjusted compensation",
    suggestions: ['Top skills in demand', 'Find matching jobs', 'Career growth roadmap'],
    type: 'salary_info'
  };
}

async function handleCompare(message) {
  return {
    message: "🔍 To compare roles, use our **Skill Gap Analysis** tool! Enter your skills and I'll show you how you stack up against different job roles.\n\n" +
      "Try asking: \"Skill gap for Data Scientist\" or \"What do I need for DevOps Engineer?\"",
    suggestions: [
      'Skill gap for Data Scientist',
      'Skill gap for DevOps Engineer',
      'Skill gap for Full Stack Developer'
    ],
    type: 'compare'
  };
}

function handleMotivation() {
  const tips = [
    "🌟 \"Every expert was once a beginner.\" Keep learning one skill at a time — consistency beats intensity!",
    "🚀 \"The best time to start was yesterday. The second best time is now.\" Pick one skill and commit to 30 minutes daily!",
    "💪 \"Don't compare your Chapter 1 to someone else's Chapter 20.\" Focus on your own growth journey!",
    "🎯 Tip: Break big goals into small, achievable milestones. Celebrate each skill you learn!",
    "📚 Tip: Build projects as you learn. A portfolio speaks louder than a certificate!"
  ];

  return {
    message: tips[Math.floor(Math.random() * tips.length)],
    suggestions: ['Find matching jobs', 'Start learning', 'Create a career plan'],
    type: 'motivation'
  };
}

function handleSkillInquiry(skills) {
  if (skills.length === 0) return handleGeneral('');

  const skill = skills[0];
  const freq = skillsData.frequency?.[skill.toLowerCase()] || 0;

  return {
    message: `🔍 **${skill}** — ${freq > 0 ? `Found in **${freq}** job roles in our database!` : 'An emerging skill in the market.'}\n\n` +
      `${freq >= 40 ? 'This is a **high-demand** skill — great choice!' : freq >= 20 ? 'This skill has **solid demand** in the market.' : 'Consider pairing this with other complementary skills.'}`,
    suggestions: [
      `Find jobs requiring ${skill}`,
      `Learn ${skill}`,
      `What skills go well with ${skill}?`,
      'Top skills in demand'
    ],
    type: 'skill_info'
  };
}

function handleGeneral(message) {
  return {
    message: "I'm not quite sure what you're looking for, but I'm here to help! 🤔 Here are some things I can do:",
    suggestions: [
      'Find jobs matching my skills',
      'Analyze my skill gap',
      'Show top skills in demand',
      'Plan my career path',
      'Find learning resources',
      'How does matching work?'
    ],
    type: 'general'
  };
}

/**
 * Get chatbot conversation history (for context)
 */
export const getChatHistory = (sessionId) => {
  // In production, this would fetch from a database
  return [];
};
