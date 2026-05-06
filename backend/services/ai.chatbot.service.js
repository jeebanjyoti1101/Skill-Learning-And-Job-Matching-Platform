import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { getAllJobs, getSkillsFrequency } from './data.loader.service.js';
import { getHybridRecommendations } from './recommendation.service.js';

/**
 * =======================================================================
 * AI-Powered Chatbot Service with ChatGPT-42 & Gemini Integration
 * Multi-AI approach with intelligent fallback (ChatGPT-42 → Gemini → Rule-based)
 * =======================================================================
 */

// Initialize Gemini AI (FREE tier: 1500 requests/day)
let genAI = null;
let model = null;
let modelName = null;
let modelFallbacks = [];
let initAttempted = false;

// ChatGPT-42 (RapidAPI) Configuration
let chatgpt42Configured = false;
let chatgpt42InitAttempted = false;

// OpenAI Configuration (legacy support)
let openaiConfigured = false;
let openaiInitAttempted = false;

// Hugging Face Router Configuration
let huggingFaceConfigured = false;
let huggingFaceInitAttempted = false;

/**
 * Lazy initialize Gemini (called on first use)
 */
function initializeGemini() {
  if (initAttempted) return model !== null;
  
  initAttempted = true;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_MODEL;
  
  console.log('[Gemini Init] Attempting to initialize Gemini AI...');
  console.log('[Gemini Init] API Key present:', GEMINI_API_KEY ? `Yes (${GEMINI_API_KEY.substring(0, 20)}...)` : 'No');
  
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_API_KEY_HERE') {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const defaultModels = [
        'models/gemini-2.5-flash',
        'models/gemini-flash-latest',
        'models/gemini-2.0-flash',
        'models/gemini-pro-latest',
        'models/gemini-2.5-pro',
        'models/gemini-3-flash-preview'
      ];
      modelFallbacks = Array.from(
        new Set([GEMINI_MODEL, ...defaultModels].filter(Boolean))
      );
      modelName = modelFallbacks.shift();
      model = genAI.getGenerativeModel({ model: modelName });
      console.log(`✅ Gemini AI initialized successfully! (model: ${modelName})`);

      if (typeof genAI.listModels === 'function') {
        genAI
          .listModels()
          .then((res) => {
            const names = res?.models?.map((m) => m.name).filter(Boolean) || [];
            if (names.length > 0) {
              console.log(`[Gemini Init] Available models: ${names.join(', ')}`);
            }
          })
          .catch((err) => {
            console.warn('[Gemini Init] Could not list models:', err.message);
          });
      }
      return true;
    } catch (error) {
      console.error('⚠️  Gemini AI initialization failed:', error.message);
      console.error('Full error:', error);
      return false;
    }
  } else {
    console.warn('⚠️  No valid Gemini API key found');
    console.warn('   Set GEMINI_API_KEY in your .env file');
    return false;
  }
}

function rotateGeminiModel() {
  if (!genAI || modelFallbacks.length === 0) {
    return false;
  }

  modelName = modelFallbacks.shift();
  model = genAI.getGenerativeModel({ model: modelName });
  console.log(`[Gemini Init] Switched model to: ${modelName}`);
  return true;
}

/**
 * Initialize ChatGPT-42 (RapidAPI) - lazy loading
 */
function initializeChatGPT42() {
  if (chatgpt42InitAttempted) return chatgpt42Configured;
  
  chatgpt42InitAttempted = true;
  const CHATGPT42_API_KEY = process.env.CHATGPT42_API_KEY;
  const USE_CHATGPT42 = process.env.USE_CHATGPT42;
  
  console.log('[ChatGPT-42 Init] Checking ChatGPT-42 configuration...');
  console.log('[ChatGPT-42 Init] API Key present:', CHATGPT42_API_KEY ? `Yes (${CHATGPT42_API_KEY.substring(0, 20)}...)` : 'No');
  
  // Check if ChatGPT-42 is explicitly disabled
  if (USE_CHATGPT42 === 'false' || USE_CHATGPT42 === '0') {
    console.warn('⚠️  ChatGPT-42 is disabled via USE_CHATGPT42 environment variable');
    console.log('💡 To enable: Set USE_CHATGPT42=true in .env file');
    return false;
  }
  
  if (CHATGPT42_API_KEY && CHATGPT42_API_KEY !== 'YOUR_API_KEY_HERE') {
    chatgpt42Configured = true;
    console.log('✅ ChatGPT-42 (RapidAPI) configured successfully!');
    console.log('💡 If ChatGPT-42 errors occur, you can disable it by setting USE_CHATGPT42=false in .env');
    return true;
  } else {
    console.warn('⚠️  ChatGPT-42 API key not configured');
    console.log('💡 Will use Gemini AI as primary provider');
    return false;
  }
}

/**
 * Call ChatGPT-42 via RapidAPI
 */
async function callChatGPT42(prompt, messages = []) {
  try {
    console.log('[ChatGPT-42] Making API request...');
    const response = await axios.post(
      'https://chatgpt-42.p.rapidapi.com/conversationgpt4-2',
      {
        messages: [
          ...messages,
          {
            role: 'user',
            content: prompt
          }
        ],
        system_prompt:
          'You are a helpful and knowledgeable career assistant for a job matching platform. Provide concise, actionable, and friendly advice.',
        web_access: false,
        temperature: 0.9,
        top_k: 5,
        top_p: 0.9,
        max_tokens: 256
      },
      {
        headers: {
          'x-rapidapi-key': process.env.CHATGPT42_API_KEY,
          'x-rapidapi-host': 'chatgpt-42.p.rapidapi.com',
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 second timeout
      }
    );
    
    // Handle different response formats
    const content = response.data?.result || response.data?.message || response.data?.choices?.[0]?.message?.content;
    
    if (!content) {
      console.warn('[ChatGPT-42] Unexpected response format:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Invalid response format from ChatGPT-42');
    }
    
    console.log('[ChatGPT-42] ✅ Response received');
    return content;
  } catch (error) {
    // Enhanced error logging
    if (error.code === 'ECONNABORTED') {
      console.error('[ChatGPT-42] ⚠️  Request timeout (15s exceeded)');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('[ChatGPT-42] ⚠️  Cannot connect to API server');
    } else if (error.response) {
      // API responded with error
      const status = error.response.status;
      const data = error.response.data;
      
      console.error('[ChatGPT-42] ⚠️  API returned error:');
      console.error(`  Status: ${status}`);
      console.error(`  Message: ${data?.message || 'Unknown error'}`);
      
      if (status === 429) {
        console.error('  Issue: Rate limit exceeded - too many requests');
      } else if (status === 401 || status === 403) {
        console.error('  Issue: Invalid or expired API key');
        console.error('  Solution: Check CHATGPT42_API_KEY in .env file');
      } else if (status === 402) {
        console.error('  Issue: Subscription required or quota exceeded');
        console.error('  Solution: Check your RapidAPI subscription');
      } else if (status >= 500) {
        console.error('  Issue: ChatGPT-42 API server error');
      }
      
      console.error(`  Raw response: ${JSON.stringify(data).substring(0, 300)}`);
    } else {
      // Network or other error
      console.error('[ChatGPT-42] ⚠️  Error:', error.message);
    }
    
    console.log('[ChatGPT-42] 🔄 Falling back to Gemini...');
    throw error;
  }
}

/**
 * Initialize OpenAI (lazy loading) - Legacy support
 */
function initializeOpenAI() {
  if (openaiInitAttempted) return openaiConfigured;
  
  openaiInitAttempted = true;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const preferredProvider = (process.env.CHATBOT_PROVIDER || 'auto').toLowerCase();
  
  console.log('[OpenAI Init] Checking OpenAI configuration...');
  console.log('[OpenAI Init] API Key present:', OPENAI_API_KEY ? 'Yes' : 'No');
  
  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here' && OPENAI_API_KEY !== 'YOUR_API_KEY_HERE') {
    openaiConfigured = true;
    console.log('✅ OpenAI ChatGPT configured successfully!');
    return true;
  } else {
    if (preferredProvider === 'openai') {
      console.warn('⚠️  OpenAI API key not configured');
    }
    return false;
  }
}

/**
 * Initialize Hugging Face Router (lazy loading)
 */
function initializeHuggingFace() {
  if (huggingFaceInitAttempted) return huggingFaceConfigured;

  huggingFaceInitAttempted = true;
  const HF_ROUTER_API_KEY = process.env.HF_ROUTER_API_KEY || process.env.HF_TOKEN;

  console.log('[HF Router Init] Checking Hugging Face router configuration...');
  console.log('[HF Router Init] API Key present:', HF_ROUTER_API_KEY ? 'Yes' : 'No');

  if (HF_ROUTER_API_KEY && HF_ROUTER_API_KEY !== 'your_hf_api_key_here') {
    huggingFaceConfigured = true;
    console.log('✅ Hugging Face Router configured successfully!');
    return true;
  }

  console.warn('⚠️  Hugging Face Router API key not configured');
  return false;
}

/**
 * Call OpenAI ChatGPT API - Legacy support
 */
async function callOpenAI(prompt) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful career assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('[OpenAI] Error:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Call Hugging Face Router chat completion API
 */
async function callHuggingFaceRouter(prompt, messages = []) {
  const HF_ROUTER_API_KEY = process.env.HF_ROUTER_API_KEY || process.env.HF_TOKEN;
  const HF_CHAT_MODEL = process.env.HF_CHAT_MODEL || 'Qwen/Qwen2.5-7B-Instruct:together';

  try {
    const response = await axios.post(
      'https://router.huggingface.co/v1/chat/completions',
      {
        model: HF_CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful and knowledgeable career assistant for a job matching platform. Provide concise, actionable, and friendly advice.'
          },
          ...messages,
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 400
      },
      {
        headers: {
          Authorization: `Bearer ${HF_ROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Invalid response format from Hugging Face router');
    }

    return content;
  } catch (error) {
    console.error('[HF Router] Error:', error.response?.data || error.message);
    throw error;
  }
}

const skillsData = getSkillsFrequency();
const PLATFORM_NAME = 'SkillMatch AI';

// Skill descriptions database for detailed explanations
const SKILL_DESCRIPTIONS = {
  'sql': 'SQL (Structured Query Language) is a standard programming language used for managing and manipulating relational databases. It allows you to query, insert, update, and delete data, making it essential for database management, data analysis, and backend development.',
  'python': 'Python is a versatile, high-level programming language known for its simplicity and readability. Widely used in web development, data science, machine learning, automation, and scientific computing, Python is one of the most in-demand skills in the tech industry.',
  'javascript': 'JavaScript is the programming language of the web, essential for creating interactive and dynamic websites. It runs in the browser and on servers (Node.js), making it crucial for both frontend and backend development.',
  'java': 'Java is a powerful, object-oriented programming language used for building enterprise applications, Android apps, and large-scale systems. Known for its "write once, run anywhere" capability, Java remains one of the most popular programming languages.',
  'data analysis': 'Data Analysis involves inspecting, cleaning, transforming, and modeling data to discover useful information and support decision-making. It combines statistics, programming, and business knowledge to extract insights from raw data.',
  'machine learning': 'Machine Learning is a branch of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. It powers recommendation systems, predictive analytics, image recognition, and autonomous systems.',
  'react': 'React is a popular JavaScript library for building user interfaces, especially single-page applications. Developed by Facebook, it allows developers to create reusable UI components and manage application state efficiently.',
  'node.js': 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine that allows developers to run JavaScript on the server side. It\'s ideal for building scalable network applications and real-time services.',
  'aws': 'Amazon Web Services (AWS) is the world\'s leading cloud computing platform, offering services like computing power, storage, databases, and machine learning. AWS skills are crucial for cloud architects and DevOps engineers.',
  'docker': 'Docker is a platform for developing, shipping, and running applications in containers. It simplifies deployment by packaging applications with all their dependencies, ensuring consistency across different environments.',
  'git': 'Git is a distributed version control system that tracks changes in source code during software development. It enables collaboration among developers and is essential for modern software development workflows.',
  'api': 'API (Application Programming Interface) is a set of protocols and tools for building software applications. APIs enable different software systems to communicate with each other, making them fundamental to modern web and mobile development.',
  'html': 'HTML (HyperText Markup Language) is the standard markup language for creating web pages. It structures web content and is the foundation of all websites, working alongside CSS and JavaScript.',
  'css': 'CSS (Cascading Style Sheets) is used to style and layout web pages, controlling colors, fonts, spacing, and responsive design. It\'s essential for creating visually appealing and user-friendly websites.',
  'mongodb': 'MongoDB is a popular NoSQL database that stores data in flexible, JSON-like documents. It\'s ideal for applications requiring high scalability and rapid development, commonly used in modern web applications.',
  'kubernetes': 'Kubernetes is an open-source container orchestration platform that automates deployment, scaling, and management of containerized applications. It\'s become the standard for cloud-native application deployment.',
  'typescript': 'TypeScript is a typed superset of JavaScript that adds static type definitions. It helps catch errors early in development and improves code quality, making it popular for large-scale applications.',
  'angular': 'Angular is a comprehensive web application framework developed by Google. It provides a complete solution for building dynamic single-page applications with features like two-way data binding and dependency injection.',
};

// Intent patterns (used as fallback or for quick responses)
const INTENT_PATTERNS = {
  greeting: /^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|what'?s up|sup)/i,
  farewell: /^(bye|goodbye|see you|take care|thanks|thank you|cheers)/i,
  help: /(help|what can you do|how does this work|guide|assist|tutorial|commands)/i,
  job_match: /(find|match|recommend|suggest|show).*(job|role|position|career|work|opening)/i,
  skill_gap: /(skill\s*gap|what.*missing|what.*need|gap\s*analysis|compare.*skills)/i,
  top_skills: /(top\s*skills|trending|in\s*demand|popular\s*skills|market\s*demand|hot\s*skills)/i,
  skill_inquiry: /(tell me about|what is|information about|explain|learn about|know about).*(skill|technology|language|framework|tool)/i,
  career_path: /(career\s*path|roadmap|career\s*plan|next\s*steps|grow|advance|become)/i,
  learning: /(learn|course|tutorial|study|train|resource|certification|upskill|reskill)/i,
  stats: /(stats|statistics|numbers|how\s*many|data|count|total)/i,
};

function getPreferredProvider() {
  return (process.env.CHATBOT_PROVIDER || 'auto').toLowerCase();
}

/**
 * Main chatbot response handler with Dual-AI integration
 * Strategy: Call both APIs simultaneously, compare, return best answer
 */
export const getAIChatbotResponse = async (message, context = {}) => {
  const startTime = Date.now();
  
  try {
    console.log('[AI Chatbot] Processing message:', message.substring(0, 50));
    
    // Initialize AIs on first use (lazy loading)
    if (!initAttempted) {
      initializeGemini();
    }
    if (!chatgpt42InitAttempted) {
      initializeChatGPT42();
    }
    if (!openaiInitAttempted) {
      initializeOpenAI();
    }
    if (!huggingFaceInitAttempted) {
      initializeHuggingFace();
    }

    // Quick responses for simple queries (no AI needed)
    const quickResponse = checkQuickResponse(message, context);
    if (quickResponse) {
      console.log('[AI Chatbot] Using quick response (no AI call)');
      return {
        success: true,
        intent: quickResponse.intent,
        ...quickResponse,
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
    }

    const preferredProvider = getPreferredProvider();

    if (preferredProvider === 'hf' || preferredProvider === 'huggingface') {
      if (huggingFaceConfigured) {
        return await getHuggingFaceResponse(message, context, startTime);
      }
      console.warn('[AI Chatbot] CHATBOT_PROVIDER is HF but HF is not configured, falling back to auto mode');
    }

    if (preferredProvider === 'gemini') {
      if (model) {
        return await getGeminiResponse(message, context, startTime);
      }
      console.warn('[AI Chatbot] CHATBOT_PROVIDER is Gemini but Gemini is not configured, falling back to auto mode');
    }

    if (preferredProvider === 'chatgpt42') {
      if (chatgpt42Configured) {
        return await getChatGPT42Response(message, context, startTime);
      }
      console.warn('[AI Chatbot] CHATBOT_PROVIDER is ChatGPT-42 but it is not configured, falling back to auto mode');
    }

    if (preferredProvider === 'openai') {
      if (openaiConfigured) {
        return await getOpenAIResponse(message, context, startTime);
      }
      console.warn('[AI Chatbot] CHATBOT_PROVIDER is OpenAI but OpenAI is not configured, falling back to auto mode');
    }

    // ** NEW DUAL-AI APPROACH **
    // Call both APIs simultaneously and compare responses
    const dualAIAvailable =
      preferredProvider === 'auto' &&
      (chatgpt42Configured || openaiConfigured || huggingFaceConfigured) &&
      model;
    
    if (dualAIAvailable) {
      console.log('[AI Chatbot] 🔄 Calling BOTH APIs simultaneously for best answer...');
      return await getDualAIResponse(message, context, startTime);
    }

    // Single AI fallback (if only one is available)
    if (chatgpt42Configured) {
      try {
        console.log('[AI Chatbot] Using ChatGPT-42 (single mode)...');
        return await getChatGPT42Response(message, context, startTime);
      } catch (error) {
        console.warn('[AI Chatbot] ChatGPT-42 failed:', error.message);
      }
    }

    if (huggingFaceConfigured) {
      try {
        console.log('[AI Chatbot] Using Hugging Face Router (single mode)...');
        return await getHuggingFaceResponse(message, context, startTime);
      } catch (error) {
        console.warn('[AI Chatbot] Hugging Face Router failed:', error.message);
      }
    }

    if (model) {
      console.log('[AI Chatbot] Using Gemini (single mode)...');
      return await getGeminiResponse(message, context, startTime);
    }

    if (openaiConfigured) {
      try {
        console.log('[AI Chatbot] Using OpenAI (single mode)...');
        return await getOpenAIResponse(message, context, startTime);
      } catch (error) {
        console.warn('[AI Chatbot] OpenAI failed:', error.message);
      }
    }

    // Final fallback to rule-based if no AI available
    console.warn('[AI Chatbot] No AI model available, using rule-based fallback');
    return await getFallbackResponse(message, context);

  } catch (error) {
    console.error('[AI Chatbot] Error:', error.message);
    return {
      success: true,
      intent: 'error',
      message: "I apologize, I encountered an issue. Let me try to help you differently.",
      suggestions: ['Find jobs for my skills', 'Show top skills', 'Help'],
      error: { message: error.message, type: error.name },
      timestamp: new Date().toISOString(),
      aiUsed: false
    };
  }
};

/**
 * ** NEW: Dual-AI Response System **
 * Calls both APIs simultaneously, compares responses, returns the best one
 */
async function getDualAIResponse(message, context, startTime) {
  console.log('[Dual-AI] Starting parallel API calls...');
  
  // Prepare promises for both APIs
  const apiCalls = [];
  
  // Add ChatGPT-42 or OpenAI call
  if (chatgpt42Configured) {
    console.log('[Dual-AI] Including ChatGPT-42 in comparison');
    apiCalls.push(
      getChatGPT42Response(message, context, startTime)
        .then(response => {
          console.log('[Dual-AI] ✅ ChatGPT-42 succeeded');
          return { provider: 'ChatGPT-42', response, success: true };
        })
        .catch(error => {
          console.log('[Dual-AI] ❌ ChatGPT-42 failed:', error.message);
          return { provider: 'ChatGPT-42', error: error.message, success: false };
        })
    );
  } else if (openaiConfigured) {
    console.log('[Dual-AI] Including OpenAI in comparison');
    apiCalls.push(
      getOpenAIResponse(message, context, startTime)
        .then(response => {
          console.log('[Dual-AI] ✅ OpenAI succeeded');
          return { provider: 'OpenAI', response, success: true };
        })
        .catch(error => {
          console.log('[Dual-AI] ❌ OpenAI failed:', error.message);
          return { provider: 'OpenAI', error: error.message, success: false };
        })
    );
  }

  if (huggingFaceConfigured) {
    console.log('[Dual-AI] Including Hugging Face Router in comparison');
    apiCalls.push(
      getHuggingFaceResponse(message, context, startTime)
        .then(response => {
          console.log('[Dual-AI] ✅ Hugging Face Router succeeded');
          return { provider: 'HuggingFace', response, success: true };
        })
        .catch(error => {
          console.log('[Dual-AI] ❌ Hugging Face Router failed:', error.message);
          return { provider: 'HuggingFace', error: error.message, success: false };
        })
    );
  }
  
  // Add Gemini call
  if (model) {
    console.log('[Dual-AI] Including Gemini in comparison');
    apiCalls.push(
      getGeminiResponse(message, context, startTime)
        .then(response => {
          console.log('[Dual-AI] ✅ Gemini succeeded');
          return { provider: 'Gemini', response, success: true };
        })
        .catch(error => {
          console.log('[Dual-AI] ❌ Gemini failed:', error.message);
          return { provider: 'Gemini', error: error.message, success: false };
        })
    );
  }
  
  // Execute both API calls in parallel
  console.log(`[Dual-AI] Executing ${apiCalls.length} API call(s) in parallel...`);
  const results = await Promise.all(apiCalls);
  
  // Log results summary
  console.log('[Dual-AI] Results summary:');
  results.forEach(r => {
    console.log(`  - ${r.provider}: ${r.success ? '✅ Success' : '❌ Failed'}`);
  });
  
  // Filter successful responses
  const successfulResponses = results.filter(r => r.success);
  
  if (successfulResponses.length === 0) {
    console.warn('[Dual-AI] ⚠️  All APIs failed, using intelligent fallback');
    const failedProviders = results.map(r => r.provider).join(' & ');
    console.warn(`[Dual-AI] Failed providers: ${failedProviders}`);
    return await getFallbackResponse(message, context);
  }
  
  if (successfulResponses.length === 1) {
    console.log(`[Dual-AI] ✅ Only ${successfulResponses[0].provider} succeeded - using its response`);
    return successfulResponses[0].response;
  }
  
  // ** COMPARE AND SELECT BEST RESPONSE **
  console.log('[Dual-AI] 🤔 Multiple APIs succeeded, comparing response quality...');
  const bestResponse = selectBestResponse(successfulResponses, message, context);
  
  const responseTime = Date.now() - startTime;
  console.log(`[Dual-AI] ✅ Selected ${bestResponse.provider} as best response (${responseTime}ms total)`);
  
  // Add metadata about comparison
  return {
    ...bestResponse.response,
    aiProvider: `${bestResponse.provider} (Best of ${successfulResponses.map(r => r.provider).join(' vs ')})`,
    comparisonScore: bestResponse.score,
    alternativeProvider: successfulResponses.find(r => r.provider !== bestResponse.provider)?.provider
  };
}

/**
 * ** NEW: Response Comparison & Selection **
 * Analyzes both responses and selects the better one
 */
function selectBestResponse(responses, message, context) {
  const scored = responses.map(r => {
    const score = scoreResponse(r.response, message, context);
    return { ...r, score };
  });
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  // Log comparison details
  console.log('[Dual-AI] Response scores:');
  scored.forEach(s => {
    console.log(`  - ${s.provider}: ${s.score.toFixed(2)} points`);
  });
  
  return scored[0]; // Return highest scored response
}

/**
 * ** NEW: Response Quality Scoring **
 * Scores a response based on multiple quality factors
 */
function scoreResponse(response, message, context) {
  let score = 0;
  const msg = response.message || '';
  const msgLower = msg.toLowerCase();
  
  // 1. Length & Completeness (0-20 points)
  if (msg.length < 50) {
    score += 5; // Too short
  } else if (msg.length > 50 && msg.length < 150) {
    score += 15; // Concise
  } else if (msg.length >= 150 && msg.length < 400) {
    score += 20; // Detailed
  } else if (msg.length >= 400) {
    score += 12; // Too verbose
  }
  
  // 2. Relevance to Question (0-25 points)
  const questionKeywords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const relevantKeywords = questionKeywords.filter(kw => msgLower.includes(kw));
  const relevanceRatio = relevantKeywords.length / Math.max(questionKeywords.length, 1);
  score += relevanceRatio * 25;
  
  // 3. Actionable Content (0-15 points)
  const actionWords = ['can', 'should', 'try', 'recommend', 'suggest', 'explore', 'check', 'find', 'use', 'learn', 'apply'];
  const actionCount = actionWords.filter(word => msgLower.includes(word)).length;
  score += Math.min(actionCount * 3, 15);
  
  // 4. Structure & Formatting (0-10 points)
  const hasBullets = msg.includes('•') || msg.includes('*') || msg.includes('-');
  const hasNumbering = /\d+\./.test(msg);
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(msg);
  score += (hasBullets ? 4 : 0) + (hasNumbering ? 3 : 0) + (hasEmoji ? 3 : 0);
  
  // 5. Platform Integration (0-15 points)
  const hasJobs = response.jobs && response.jobs.length > 0;
  const hasSuggestions = response.suggestions && response.suggestions.length > 0;
  const hasSkillInfo = response.skillInfo || response.topSkills;
  score += (hasJobs ? 7 : 0) + (hasSuggestions ? 5 : 0) + (hasSkillInfo ? 3 : 0);
  
  // 6. Avoid Generic/Unhelpful Responses (0-15 points)
  const genericPhrases = [
    'i don\'t know',
    'i cannot help',
    'i\'m not sure',
    'try asking',
    'currently unavailable',
    'basic mode',
    'please contact'
  ];
  const hasGenericPhrase = genericPhrases.some(phrase => msgLower.includes(phrase));
  score += hasGenericPhrase ? 0 : 15;
  
  // 7. User Context Awareness (0-10 points bonus)
  if (context.userSkills && context.userSkills.length > 0) {
    const mentionsUserSkills = context.userSkills.some(skill => 
      msgLower.includes(skill.toLowerCase())
    );
    score += mentionsUserSkills ? 10 : 0;
  }
  
  return score;
}

/**
 * Get response from ChatGPT-42 (RapidAPI)
 */
async function getChatGPT42Response(message, context, startTime) {
  try {
    // Build context-aware prompt
    const systemPrompt = buildSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser Query: ${message}\n\nProvide a helpful, concise response (3-5 sentences) with actionable advice.`;

    console.log('[AI Chatbot] Calling ChatGPT-42 API...');
    
    const aiMessage = await callChatGPT42(fullPrompt);

    const responseTime = Date.now() - startTime;
    console.log(`[AI Chatbot] ✅ ChatGPT-42 response received (${responseTime}ms)`);

    // Clean repetitive phrases from AI response
    const cleanedMessage = cleanAIResponse(aiMessage);

    // Extract intent and enhance response with platform actions
    const intent = detectIntent(message);
    const enhancedResponse = await enhanceAIResponse(cleanedMessage, intent, context);

    return {
      success: true,
      intent: intent || 'general',
      message: cleanedMessage,
      ...enhancedResponse,
      timestamp: new Date().toISOString(),
      aiUsed: true,
      aiProvider: 'ChatGPT-42 (RapidAPI)',
      responseTime
    };

  } catch (error) {
    console.error('[AI Chatbot] ChatGPT-42 API error:', error.message);
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Get response from OpenAI ChatGPT (Legacy)
 */
async function getOpenAIResponse(message, context, startTime) {
  try {
    // Build context-aware prompt
    const systemPrompt = buildSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;

    console.log('[AI Chatbot] Calling OpenAI ChatGPT API...');
    
    const aiMessage = await callOpenAI(fullPrompt);

    const responseTime = Date.now() - startTime;
    console.log(`[AI Chatbot] ✅ OpenAI response received (${responseTime}ms)`);

    // Clean repetitive phrases from AI response
    const cleanedMessage = cleanAIResponse(aiMessage);

    // Extract intent and enhance response with platform actions
    const intent = detectIntent(message);
    const enhancedResponse = await enhanceAIResponse(cleanedMessage, intent, context);

    return {
      success: true,
      intent: intent || 'general',
      message: cleanedMessage,
      ...enhancedResponse,
      timestamp: new Date().toISOString(),
      aiUsed: true,
      aiProvider: 'OpenAI ChatGPT',
      responseTime
    };

  } catch (error) {
    console.error('[AI Chatbot] OpenAI API error:', error.message);
    throw error; // Re-throw to trigger fallback
  }
}

/**
 * Get response from Hugging Face Router
 */
async function getHuggingFaceResponse(message, context, startTime) {
  try {
    const systemPrompt = buildSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser Query: ${message}\n\nProvide a helpful, concise response (3-5 sentences) with actionable advice.`;

    console.log('[AI Chatbot] Calling Hugging Face Router API...');

    const aiMessage = await callHuggingFaceRouter(fullPrompt);

    const responseTime = Date.now() - startTime;
    console.log(`[AI Chatbot] ✅ Hugging Face Router response received (${responseTime}ms)`);

    const cleanedMessage = cleanAIResponse(aiMessage);
    const intent = detectIntent(message);
    const enhancedResponse = await enhanceAIResponse(cleanedMessage, intent, context);

    return {
      success: true,
      intent: intent || 'general',
      message: cleanedMessage,
      ...enhancedResponse,
      timestamp: new Date().toISOString(),
      aiUsed: true,
      aiProvider: 'Hugging Face Router',
      responseTime
    };
  } catch (error) {
    console.error('[AI Chatbot] Hugging Face Router API error:', error.message);
    throw error;
  }
}

/**
 * Get response from Google Gemini AI
 */
async function getGeminiResponse(
  message,
  context,
  startTime,
  remainingModelAttempts = modelFallbacks.length + 1
) {
  try {
    // Build context-aware prompt
    const systemPrompt = buildSystemPrompt(context);
    const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;

    console.log('[AI Chatbot] Calling Gemini API...');
    
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const aiMessage = response.text();

    const responseTime = Date.now() - startTime;
    console.log(`[AI Chatbot] ✅ Gemini response received (${responseTime}ms)`);

    // Clean repetitive phrases from AI response
    const cleanedMessage = cleanAIResponse(aiMessage);

    // Extract intent and enhance response with platform actions
    const intent = detectIntent(message);
    const enhancedResponse = await enhanceAIResponse(cleanedMessage, intent, context);

    return {
      success: true,
      intent: intent || 'general',
      message: cleanedMessage,
      ...enhancedResponse,
      timestamp: new Date().toISOString(),
      aiUsed: true,
      aiProvider: 'Google Gemini',
      responseTime
    };

  } catch (error) {
    console.error('[AI Chatbot] Gemini API error:', error.message);

    const isModelNotFound = /not found for API version|not supported for generateContent/i.test(
      error.message
    );
    if (isModelNotFound && remainingModelAttempts > 1 && rotateGeminiModel()) {
      console.log('[AI Chatbot] Retrying with fallback Gemini model...');
      return getGeminiResponse(
        message,
        context,
        startTime,
        remainingModelAttempts - 1
      );
    }

    // Fallback to rule-based
    console.log('[AI Chatbot] Falling back to rule-based response');
    return await getFallbackResponse(message, context);
  }
}

/**
 * Build system prompt with platform context
 */
function buildSystemPrompt(context) {
  const userSkills = context.userSkills?.join(', ') || 'not specified';
  const userName = context.userName || 'User';
  const topSkillNames = skillsData.skills?.slice(0, 8).map((s, i) => `${i + 1}. ${s.name}`).join('\n') || 'Not available';
  
  return `You are ${PLATFORM_NAME}, an AI career assistant specializing in IT jobs and skills.

**Current User:**
- Name: ${userName}
- Skills: ${userSkills}

**Top In-Demand Skills:**
${topSkillNames}

**Communication Guidelines:**
1. **Be Direct**: Answer the user's question immediately without promotional language
2. **Be Concise**: Keep responses under 80 words unless detailed explanation is requested
3. **Be Specific**: Use actual data and numbers when relevant
4. **No Promotional Language**: Don't mention platform capabilities unless directly asked
5. **Don't Ask Questions Back**: Only ask a follow-up question if the user's query is unclear or incomplete
6. **Minimal Emojis**: Use 0-1 emoji only when it adds value
7. **Personalize Job Queries**: If user asks for jobs "for my skills", use the user's skills context first

**Response Format:**
- Answer the question directly in the first sentence
- Provide key information in bullet points if multiple items
- Keep it focused on what was asked

**Avoid:**
- Mentioning "693+ skills" or "355 job roles" unless specifically asked
- Mentioning exact skill frequency numbers (like "69 jobs") unless user explicitly asks for market statistics
- Asking users about their skills unless they're asking for personalized recommendations
- Promotional phrases like "Our AI matching engine" or "Let's get started"
- Multiple follow-up questions or calls to action
- Repetitive phrases about platform features

**Example - Good Response:**
"Data Analyst roles typically require: SQL for data querying, Python for analysis, Excel for reporting, and visualization tools like Tableau or Power BI. Statistical knowledge and business acumen are also important."

**Example - Bad Response:**
"Hey! Data Analyst roles need skills like SQL and Python. We have 43 SQL jobs and 51 Python jobs! Tell me your current skills so our AI matching engine can find your perfect matches. What skills do you have? Let's start your journey! 🚀"

Keep responses professional, direct, and to-the-point.`;
}

/**
 * Clean up repetitive phrases from AI response
 */
function cleanAIResponse(message) {
  if (!message) return '';
  
  let cleaned = message;
  
  // Remove promotional language about platform capabilities
  cleaned = cleaned.replace(/We can definitely help you explore this area among our \d+ IT job roles\.?/gi, '');
  cleaned = cleaned.replace(/among our \d+ IT job roles/gi, '');
  cleaned = cleaned.replace(/across many of our \d+ IT job roles/gi, '');
  cleaned = cleaned.replace(/\s+from our \d+ IT job roles/gi, '');
  cleaned = cleaned.replace(/from our database of \d+ jobs/gi, '');
  cleaned = cleaned.replace(/our platform has \d+ jobs/gi, '');
  cleaned = cleaned.replace(/\d+\+ tracked skills/gi, '');
  cleaned = cleaned.replace(/\d+ IT job roles?/gi, '');
  cleaned = cleaned.replace(/\d+\+ skills/gi, '');
  
  // Remove questions asking about user skills
  cleaned = cleaned.replace(/Tell me (your|about your) current skills[!?.]?\s*/gi, '');
  cleaned = cleaned.replace(/What skills (do you (currently )?(have|possess)|are you (currently )?strong in)[,?]?\s*\w*[?.]/gi, '');
  cleaned = cleaned.replace(/Let('s| us) get started[!.]?\s*🚀?\s*/gi, '');
  cleaned = cleaned.replace(/This (lets|helps|allows) (our|us).*(matching engine|find|leverage)/gi, '');
  cleaned = cleaned.replace(/We('ll| can then).*(perform|reveal|show|outline).*(skill gap analysis|top-in-demand skills)/gi, '');
  
  // Remove promotional phrases about system features
  cleaned = cleaned.replace(/🤖\s*Hybrid AI matching engine/gi, '');
  cleaned = cleaned.replace(/🎯\s*\d+ IT job roles/gi, '');
  cleaned = cleaned.replace(/(our|the) (AI )?matching engine/gi, '');
  cleaned = cleaned.replace(/personalized learning roadmaps?/gi, 'learning paths');
  cleaned = cleaned.replace(/required in \d+ jobs/gi, 'in demand');
  cleaned = cleaned.replace(/\b\d+\s+jobs\b/gi, 'many roles');
  
  // Remove numbered promotional points (e.g., "1. Tell me your skills...")
  cleaned = cleaned.replace(/\d+\.\s*Tell me (your|about your) current skills.*?(\d+\.|$)/gis, '');
  cleaned = cleaned.replace(/\d+\.\s*We('ll| can then).*?(\d+\.|$)/gis, '');
  cleaned = cleaned.replace(/\d+\.\s*(Explore|Focus|Focusing on).*?(tracked skills|IT job roles).*?(\d+\.|$)/gis, '');
  
  // Remove repetitive AI disclaimers
  cleaned = cleaned.replace(/As an AI (assistant|chatbot|model),?\s*/gi, '');
  cleaned = cleaned.replace(/I(\'m| am) (here to|designed to|programmed to) help/gi, "I can help");
  
  // Remove excessive punctuation
  cleaned = cleaned.replace(/!+/g, '!');
  cleaned = cleaned.replace(/\?+/g, '?');
  cleaned = cleaned.replace(/\.+/g, '.');
  
  // Clean up markdown artifacts
  cleaned = cleaned.replace(/\*\*\*\*/g, '');
  cleaned = cleaned.replace(/(\*\*|__)\s+(\*\*|__)/g, ' ');
  
  // Clean up extra spaces and punctuation
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.replace(/\s+([,.!?])/g, '$1');
  cleaned = cleaned.replace(/^\s+|\s+$/g, '');
  
  // Remove leading/trailing quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  // Clean up broken sentences from removal
  cleaned = cleaned.replace(/\s*:\s*$/g, '');
  cleaned = cleaned.replace(/^[,.\s]+/g, '');
  
  return cleaned;
}

/**
 * Enhance AI response with platform-specific data
 */
async function enhanceAIResponse(aiMessage, intent, context) {
  const enhanced = {};

  // If asking about jobs, add actual job data
  if (intent === 'job_match' && context.userSkills?.length > 0) {
    try {
      const jobsData = await getHybridRecommendations(
        context.userSkills,
        { limit: 5 }
      );
      
      if (jobsData.recommendations?.length > 0) {
        enhanced.jobs = jobsData.recommendations.slice(0, 5).map(job => ({
          title: job.title,
          score: Math.round(job.hybridScore),
          matchingSkills: job.matchingSkillsCount,
          missingSkills: job.missingSkillsCount,
          readiness: job.readinessLevel
        }));
      }
    } catch (error) {
      console.warn('[AI Chatbot] Could not fetch jobs:', error.message);
    }
  }

  // If asking about top skills, add real data
  if (intent === 'top_skills') {
    const topSkills = skillsData.skills?.slice(0, 15) || [];
    enhanced.topSkills = topSkills.map(s => ({
      name: s.name,
      frequency: s.frequency
    }));
  }

  // Generate smart suggestions based on intent
  enhanced.suggestions = generateSmartSuggestions(intent, context);

  return enhanced;
}

/**
 * Check if query needs quick response (no AI needed)
 */
function checkQuickResponse(message, context = {}) {
  const msg = message.toLowerCase().trim();

  // Simple greetings
  if (msg.match(/^(hi|hello|hey|hii|hey|howdy|hola|ciao)$/i)) {
    return {
      intent: 'greeting',
      message: `Hello! 👋 I'm ${PLATFORM_NAME}, your AI career assistant. I can help you find matching jobs, analyze skill gaps, and plan your career. What would you like to do?`,
      suggestions: ['Find jobs for my skills', 'What are the top skills?', 'Help me get started']
    };
  }

  // Help requests
  if (msg === 'help' || msg === 'what can you do') {
    return {
      intent: 'help',
      message: `I can help you with:\n• **Job Matching** — Find roles matching your skills\n• **Skill Gap Analysis** — See what you need to learn\n• **Career Planning** — Get personalized roadmaps\n• **Learning Resources** — Find courses and tutorials\n• **Market Insights** — See trending skills`,
      suggestions: ['Find jobs', 'Top skills', 'Skill gap analysis', 'Career path']
    };
  }

  // Personalized job query shortcuts
  if (msg.match(/find jobs? for my skills|jobs? for my skills|match jobs? for my skills/i)) {
    if (Array.isArray(context.userSkills) && context.userSkills.length > 0) {
      const listedSkills = context.userSkills.slice(0, 6).join(', ');
      return {
        intent: 'job_match',
        message: `I will match jobs based on your skills: ${listedSkills}. I can also show where your profile is strong and which skills to add next.`,
        suggestions: ['Show top matches', 'Skill gap analysis', 'Learning resources for missing skills']
      };
    }

    return {
      intent: 'job_match',
      message: 'I can match jobs to your profile. Share your main skills first (for example: Python, SQL, React), and I will suggest relevant roles plus missing skills to improve your match.',
      suggestions: ['Python, SQL, React', 'Java, Spring Boot, MySQL', 'Node.js, MongoDB, Express']
    };
  }

  return null; // Needs AI processing
}

/**
 * Fallback to intelligent rule-based response (when AI unavailable)
 */
async function getFallbackResponse(message, context) {
  const intent = detectIntent(message);
  const msgLower = message.toLowerCase();
  
  // Extract skills mentioned in the message
  const knownSkills = skillsData.skills?.slice(0, 200).map(s => s.name?.toLowerCase()) || [];
  const mentionedSkills = knownSkills.filter(skill => skill && msgLower.includes(skill));
  
  // Handle skill-specific inquiries
  if (intent === 'skill_inquiry' || mentionedSkills.length > 0) {
    const skillName = mentionedSkills[0] || extractSkillFromMessage(message);
    if (skillName) {
      return await getSkillInquiryResponse(skillName);
    }
  }
  
  // Handle different intents with intelligent responses
  switch (intent) {
    case 'help':
      return {
        success: true,
        intent: 'help',
        message: `I can help with:\n• Job matching based on your skills\n• Skill gap analysis\n• Career planning guidance\n• Learning resources\n• Market insights and trends\n\nWhat do you need?`,
        suggestions: ['Find jobs', 'Top skills', 'Career guidance'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    case 'top_skills':
      const topSkills = skillsData.skills?.slice(0, 15) || [];
      return {
        success: true,
        intent: 'top_skills',
        message: `**Top In-Demand Skills:**\n\n${topSkills.map((s, i) => `${i + 1}. ${s.name} — ${s.frequency} jobs`).join('\n')}`,
        topSkills: topSkills.map(s => ({ name: s.name, frequency: s.frequency })),
        suggestions: ['Find jobs', 'Learning resources'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    case 'job_match':
      if (context.userSkills && context.userSkills.length > 0) {
        return {
          success: true,
          intent: 'job_match',
          message: `Based on your skills (${context.userSkills.join(', ')}), use the job matching feature to find relevant positions.`,
          suggestions: ['Show top matches', 'Skill gap analysis', 'Top skills'],
          timestamp: new Date().toISOString(),
          aiUsed: false
        };
      } else {
        return {
          success: true,
          intent: 'job_match',
          message: `To match you with jobs, I need to know your skills. What technologies and tools are you proficient in?`,
          suggestions: ['Python and SQL', 'JavaScript and React', 'Java and Spring'],
          timestamp: new Date().toISOString(),
          aiUsed: false
        };
      }
      
    case 'career_path':
      return {
        success: true,
        intent: 'career_path',
        message: `Common IT career paths:\n• Web Development: Frontend → Full Stack → Architect\n• Data Science: Analyst → Scientist → ML Engineer\n• DevOps: System Admin → DevOps → Cloud Architect\n• Mobile: Developer → Senior Dev → Tech Lead\n\nWhich area interests you?`,
        suggestions: ['Web Development', 'Data Science', 'DevOps', 'Mobile'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    case 'learning':
      return {
        success: true,
        intent: 'learning',
        message: `I can recommend learning resources from YouTube, Coursera, Udemy, and freeCodeCamp. What skill would you like to learn?`,
        suggestions: ['Python', 'JavaScript', 'React', 'Top skills'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    case 'stats':
      return {
        success: true,
        intent: 'stats',
        message: `Platform stats:\n• 355 IT job roles\n• 693+ tracked skills\n• 30+ learning resources\n• Hybrid AI matching system`,
        suggestions: ['Top skills', 'Find jobs', 'Career guidance'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    case 'greeting':
      return {
        success: true,
        intent: 'greeting',
        message: `Hello! I'm ${PLATFORM_NAME}, your AI career assistant. I can help you find jobs, analyze skill gaps, plan your career, and discover learning resources. What would you like to do?`,
        suggestions: ['Find jobs', 'Top skills', 'Career guidance', 'Help'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    case 'farewell':
      return {
        success: true,
        intent: 'farewell',
        message: `Thanks for using ${PLATFORM_NAME}! 🌟\n\nRemember:\n• Your career journey is unique\n• Keep learning and growing\n• Check back for new opportunities\n\nGood luck with your job search! 🚀`,
        suggestions: ['Find jobs', 'Top skills', 'Career guidance'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
      
    default:
      // Generic response for unknown queries
      return {
        success: true,
        intent: 'general',
        message: `I understand you're asking about **"${message.substring(0, 50)}"**.\n\nI can help you with:\n• **Job Matching** — Find roles for your skills\n• **Skill Insights** — Learn about specific technologies\n• **Career Guidance** — Plan your career path\n• **Learning Resources** — Find courses and tutorials\n\nTry asking: "Tell me about Python" or "Find jobs for JavaScript"`,
        suggestions: ['Find jobs', 'Top skills in demand', 'Career guidance', 'Help'],
        timestamp: new Date().toISOString(),
        aiUsed: false
      };
  }
}

/**
 * Get detailed response about a specific skill with actual job listings
 */
async function getSkillInquiryResponse(skillName) {
  const skills = skillsData.skills || [];
  const skillData = skills.find(s => s.name?.toLowerCase() === skillName.toLowerCase());
  
  if (skillData) {
    const ranking = skills.findIndex(s => s.name?.toLowerCase() === skillName.toLowerCase()) + 1;
    const demandLevel = skillData.frequency > 100 ? 'Very High' : 
                        skillData.frequency > 50 ? 'High' : 
                        skillData.frequency > 20 ? 'Moderate' : 'Growing';
    
    // Get skill description
    const skillDescription = SKILL_DESCRIPTIONS[skillName.toLowerCase()] || 
      `${skillData.name} is a valuable technology skill used across various domains in IT.`;
    
    // Fetch actual jobs that require this skill
    let jobsMessage = '';
    try {
      const allJobs = await getAllJobs();
      const matchingJobs = allJobs.filter(job => 
        job.skillsRequired?.some(skill => 
          skill.toLowerCase() === skillName.toLowerCase()
        )
      );
      
      if (matchingJobs.length > 0) {
        // Get top 8 jobs for better variety
        const topJobs = matchingJobs.slice(0, 8);
        
        jobsMessage = `\n\n**Available Positions (${matchingJobs.length} jobs):**\n\n`;
        
        topJobs.forEach((job, i) => {
          jobsMessage += `${i + 1}. **${job.title}** - ${job.experienceLevel} (${job.category})\n`;
        });
        
        if (matchingJobs.length > 8) {
          jobsMessage += `\n*Plus ${matchingJobs.length - 8} more positions*`;
        }
      }
    } catch (error) {
      console.warn('[Skill Inquiry] Could not fetch jobs:', error.message);
    }
    
    return {
      success: true,
      intent: 'skill_inquiry',
      message: `**${skillData.name}**\n\n${skillDescription}\n\n**Market Demand:** ${demandLevel} (${skillData.frequency} job openings, ranked #${ranking})${jobsMessage}`,
      suggestions: [`Learning resources for ${skillData.name}`, 'Career path guidance', 'Top skills'],
      // Don't include jobs array to avoid showing 0% score cards
      skillInfo: {
        name: skillData.name,
        frequency: skillData.frequency,
        ranking: ranking,
        demandLevel: demandLevel
      },
      timestamp: new Date().toISOString(),
      aiUsed: false
    };
  } else {
    // Skill not in database - try to find jobs anyway
    const capitalizedSkill = skillName.charAt(0).toUpperCase() + skillName.slice(1);
    let jobsMessage = '';
    
    // Get skill description if available
    const skillDescription = SKILL_DESCRIPTIONS[skillName.toLowerCase()] || 
      `${capitalizedSkill} is a technology skill used in various IT applications.`;
    
    try {
      const allJobs = await getAllJobs();
      const matchingJobs = allJobs.filter(job => 
        job.skillsRequired?.some(skill => 
          skill.toLowerCase() === skillName.toLowerCase()
        )
      );
      
      if (matchingJobs.length > 0) {
        const topJobs = matchingJobs.slice(0, 8);
        
        jobsMessage = `\n\n**Available Positions (${matchingJobs.length} jobs):**\n\n`;
        
        topJobs.forEach((job, i) => {
          jobsMessage += `${i + 1}. **${job.title}** - ${job.experienceLevel} (${job.category})\n`;
        });
        
        if (matchingJobs.length > 8) {
          jobsMessage += `\n*Plus ${matchingJobs.length - 8} more positions*`;
        }
        
        return {
          success: true,
          intent: 'skill_inquiry',
          message: `**${capitalizedSkill}**\n\n${skillDescription}${jobsMessage}`,
          suggestions: [`Learning resources for ${capitalizedSkill}`, 'Top skills', 'Career guidance'],
          timestamp: new Date().toISOString(),
          aiUsed: false
        };
      }
    } catch (error) {
      console.warn('[Skill Inquiry] Could not fetch jobs:', error.message);
    }
    
    // No jobs found
    return {
      success: true,
      intent: 'skill_inquiry',
      message: `**${capitalizedSkill}**\n\n${skillDescription}\n\nNo specific job listings found for this skill in the current database. Try searching for related skills or broader categories.`,
      suggestions: ['Show top skills', 'Find matching jobs', 'Career guidance'],
      timestamp: new Date().toISOString(),
      aiUsed: false
    };
  }
}

/**
 * Extract skill name from message
 */
function extractSkillFromMessage(message) {
  // Try to extract skill from common patterns
  const patterns = [
    /(?:tell me about|what is|information about|explain|learn about|know about)\s+([a-z0-9+#.\s]+?)(?:\?|$|\.)/i,
    /(?:about|info on)\s+([a-z0-9+#.\s]+?)(?:\?|$|\.)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Detect intent from user message (simple regex)
 */
function detectIntent(message) {
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern.test(message)) {
      return intent;
    }
  }
  return 'general';
}

/**
 * Generate context-aware suggestions
 */
function generateSmartSuggestions(intent, context) {
  const hasSkills = context.userSkills?.length > 0;

  const suggestionMap = {
    greeting: ['Find jobs for my skills', 'What are the top skills?', 'Help'],
    job_match: ['Show more jobs', 'Skill gap analysis', 'Learning resources'],
    skill_gap: ['Show learning plan', 'Find matching jobs', 'Top skills'],
    top_skills: ['Find jobs for top skill', 'My skill gap', 'Career planning'],
    general: hasSkills 
      ? ['Find jobs for my skills', 'Analyze skill gap', 'Top skills']
      : ['What are the top skills?', 'How does matching work?', 'Help']
  };

  return suggestionMap[intent] || suggestionMap.general;
}

/**
 * Get chat history (placeholder for future implementation)
 */
export const getAIChatHistory = async (userId, limit = 20) => {
  // TODO: Implement chat history storage
  return {
    success: true,
    history: [],
    message: 'Chat history coming soon!'
  };
};

// Export original getChatbotResponse name for backward compatibility
export const getChatbotResponse = getAIChatbotResponse;
export const getChatHistory = getAIChatHistory;
