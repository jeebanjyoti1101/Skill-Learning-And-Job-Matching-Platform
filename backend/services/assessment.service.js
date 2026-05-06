import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const activeTestsMap = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.join(__dirname, '../data/skill_questions.json');

// Predefined set of skill questions
let questionBank = [];
try {
  questionBank = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
} catch (err) {
  console.error('Could not load question bank for skill assessment', err);
}

/**
 * Get random questions based on skill and difficulty (Option A: Predefined Questions)
 * Standardized to always return 20 questions in the 5-5-8-2 pattern.
 */
const getStaticQuestions = (skill, difficulty = 'easy', count = 20, userId = null) => {
  const pattern = [
    { type: 'mcq', count: 5 },
    { type: 'fill_in_blank', count: 5 },
    { type: 'technical', count: 8 },
    { type: 'coding', count: 2 }
  ];

  const skillBank = questionBank.filter(q => q.skill.toLowerCase() === skill.toLowerCase());
  const generalPool = questionBank.sort(() => 0.5 - Math.random());
  
  let selected = [];

  pattern.forEach(p => {
    // Try to get questions of this type for this skill
    let typeMatches = skillBank.filter(q => (q.type || 'mcq') === p.type);
    
    // If not enough, fill from general pool of same type
    if (typeMatches.length < p.count) {
        const otherOfType = generalPool.filter(q => (q.type || 'mcq') === p.type && q.skill.toLowerCase() !== skill.toLowerCase());
        typeMatches = [...typeMatches, ...otherOfType];
    }
    
    // Slice to count
    let picked = typeMatches.slice(0, p.count);
    
    // If still not enough (e.g. no coding questions in bank), create/repeat from general pool and force type
    while (picked.length < p.count && generalPool.length > 0) {
        const filler = {...generalPool[Math.floor(Math.random() * generalPool.length)]};
        filler.type = p.type; // Force type match for UI consistency
        if(p.type === 'mcq' && !filler.options) filler.options = ["A", "B", "C", "D"];
        picked.push(filler);
    }
    
    selected = [...selected, ...picked];
  });

  // Final shuffle only within each type group is okay, but we want the pattern preserved
  // but let's shuffle the whole 20 for a mixed feel if requested, 
  // though the user said "with that pattern", usually meaning the breakdown.
  
  if (userId) activeTestsMap.set(userId.toString(), selected);
  
  return selected.map(q => ({
    type: q.type || 'mcq',
    question: q.question,
    options: q.options || []
  }));
};

/**
 * Dynamic AI Question Generation wrapper
 */
export const getQuestionsForSkill = async (skill, difficulty = 'medium', isWeak = 'false', userId = null) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("No GEMINI_API_KEY. Using static questions.");
      return getStaticQuestions(skill, difficulty, 20, userId);
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Switch between ADAPTIVE PROMPT and MASTER PROMPT
    let prompt = ``;
    if (isWeak === 'true') {
      prompt = `You are an AI skill assessment system. The user performed poorly in the following topic: ${skill}. 
      
Generate EXACTLY 20 questions focusing on these specific weak areas.

Breakdown:
- 5 Multiple Choice Questions (MCQs)
- 5 Fill in the Blank Questions
- 8 Technical Conceptual Questions
- 2 HARD Coding/Scenario Questions (Total: 20)

Output format must be a STRICT JSON ARRAY OF EXACTLY 20 OBJECTS. Follow this schema precisely:
[
  {
    "type": "mcq",
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "answer": "Exact text of correct option"
  },
  {
    "type": "fill_in_blank",
    "question": "The ___ keyword is used to declare a constant.",
    "answer": "const"
  },
  {
    "type": "technical",
    "question": "Explain how closures work in JavaScript.",
    "answer": "A closure is a function bound together with its lexical environment..."
  },
  {
    "type": "coding",
    "question": "Write an optimized function to reverse a linked list.",
    "answer": "function reverseList(head) { ... }"
  }
]

Rules:
- STRICT JSON ARRAY ONLY. NO markdown formatting.
- "options" field is REQUIRED ONLY for "mcq" type questions.
- MCQs must have EXACTLY 4 options, and "answer" must match one option exactly.`;
    } else {
      prompt = `You are an expert technical interviewer.

Generate EXACTLY 20 questions for the skill: ${skill}.

Breakdown:
- 5 Multiple Choice Questions (MCQs)
- 5 Fill in the Blank Questions
- 8 Technical Conceptual Questions
- 2 HARD Coding/Scenario Questions (Total: 20)

Output format must be a STRICT JSON ARRAY OF EXACTLY 20 OBJECTS. Follow this schema precisely:
[
  {
    "type": "mcq",
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "answer": "Exact text of correct option"
  },
  {
    "type": "fill_in_blank",
    "question": "The ___ keyword is used to declare a constant.",
    "answer": "const"
  },
  {
    "type": "technical",
    "question": "Explain how closures work in JavaScript.",
    "answer": "A closure is a function bound together with its lexical environment..."
  },
  {
    "type": "coding",
    "question": "Write an optimized function to reverse a linked list.",
    "answer": "function reverseList(head) { ... }"
  }
]

Rules:
- STRICT JSON ARRAY ONLY. NO markdown formatting.
- "options" field is REQUIRED ONLY for "mcq" type questions. DO NOT include it for others.
- Fill in the blank answers should be 1-2 words max.
- MCQs must have EXACTLY 4 options, and "answer" must match one option exactly.`;
    }

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    let generatedQuestions = JSON.parse(text);
    
    // Ensure array structure
    if(!Array.isArray(generatedQuestions)) {
        generatedQuestions = [generatedQuestions];
    }

    if (userId) activeTestsMap.set(userId.toString(), generatedQuestions);

    return generatedQuestions.map(q => ({
      type: q.type || 'mcq',
      question: q.question,
      options: q.options || []
    }));

  } catch (err) {
    console.error("AI Generation failed:", err.message);
    return getStaticQuestions(skill, difficulty, 20, userId);
  }
};

/**
 * Weekly Grand Assessment: 100 Mixed Questions
 */
export const getWeeklyAssessment = async (userId) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Pro for 100 q's

    const prompt = `You are the lead technical examiner. Generate a "Master Job Readiness Assessment".
    
Total: 100 Questions for general Software Engineering/Development skills.

Breakdown:
- 10 HARD Coding Challenges (Algorithm + Efficiency)
- 10 MEDIUM Coding Problems 
- 20 Scenario-based Architecture Questions
- 30 Technical Conceptual Questions (Fill in blanks/Technical type)
- 30 Multiple Choice Questions (Core Fundamentals)

Output EXACTLY 100 objects in a STRICT JSON ARRAY ONLY. Schema for each object:
{ "type": "mcq"|"fill_in_blank"|"technical"|"coding", "question": "...", "options": ["A","B","C","D"](only if mcq), "answer": "..." }

Rules: No markdown. No truncation. Return all 100. Correct syntax is critical.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    let generated = JSON.parse(text);

    if (userId) activeTestsMap.set(userId.toString(), generated);
    return generated;
  } catch (e) {
    console.error("Weekly Gen Failed:", e);
    // Fallback to smaller set if AI times out on 100
    return getStaticQuestions("General", "medium", 20, userId);
  }
};

/**
 * Handle External achievement uploads for manual verification
 */
export const submitExternalAchievement = async (userId, platform, url) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (!user.assessmentProfile.externalCredentials) user.assessmentProfile.externalCredentials = [];
  
  user.assessmentProfile.externalCredentials.push({
    platform,
    credentialUrl: url,
    status: 'Pending',
    submittedAt: new Date()
  });

  await user.save();
  return { success: true, message: "Achievement submitted for manual verification." };
};

/**
 * Submit test answers, calculate score and update user's profile
 */
export const submitSkillTest = async (userId, skill, submittedAnswers) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    let correctCount = 0;
    const totalQuestions = submittedAnswers.length;

    // Evaluate answers
    let activeQuestions = activeTestsMap.get(userId.toString());
    if (!activeQuestions) activeQuestions = questionBank; // Fallback

    submittedAnswers.forEach(ans => {
      const actualQuestion = activeQuestions.find(q => q.question === ans.question);
      if (actualQuestion) {
        const uAns = (ans.selectedOption || '').trim().toLowerCase();
        const evalAns = (actualQuestion.answer || '').trim().toLowerCase();
        
        if (actualQuestion.type === 'mcq' || actualQuestion.type === 'fill_in_blank' || !actualQuestion.type) {
           if (uAns === evalAns) {
             correctCount++;
           }
        } else {
           // Technical / Coding questions - loose grading for minor project
           const expectedWords = evalAns.split(/\s+/);
           const userWords = uAns.split(/\s+/);
           const overlap = userWords.filter(w => expectedWords.includes(w)).length;
           
           if (overlap >= 2 || uAns.length > 20) {
             correctCount++;
           }
        }
      }
    });

    if (activeTestsMap.has(userId.toString())) activeTestsMap.delete(userId.toString());

    // Score = (Correct Answers / Total Questions) * 100
    const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const finalScore = Math.round(rawScore);

    // Update User Profile
    if (!user.assessmentProfile) {
      user.assessmentProfile = {
        totalScore: 0,
        globalRank: 0,
        testsTaken: 0,
        weakAreas: [],
        skillScores: []
      };
    }

    user.assessmentProfile.testsTaken += 1;
    user.assessmentProfile.lastTestDate = new Date();

    // Check if skill score exists
    const skillScoreIndex = user.assessmentProfile.skillScores.findIndex(s => s.skill.toLowerCase() === skill.toLowerCase());
    if (skillScoreIndex > -1) {
      user.assessmentProfile.skillScores[skillScoreIndex].score = finalScore;
      user.assessmentProfile.skillScores[skillScoreIndex].history.push({ date: new Date(), score: finalScore });
    } else {
      user.assessmentProfile.skillScores.push({
        skill,
        score: finalScore,
        history: [{ date: new Date(), score: finalScore }]
      });
    }

    // Identify weak areas (e.g. if score < 60)
    if (finalScore < 60 && !user.assessmentProfile.weakAreas.includes(skill)) {
      user.assessmentProfile.weakAreas.push(skill);
    } else if (finalScore >= 60) {
      // Remove from weak areas if improved
      user.assessmentProfile.weakAreas = user.assessmentProfile.weakAreas.filter(w => w !== skill);
    }

    // Advanced Ranking Strategy: Final Score = 0.7 * Test Score + 0.3 * Consistency
    const avgSkillScore = user.assessmentProfile.skillScores.reduce((acc, curr) => acc + curr.score, 0) / user.assessmentProfile.skillScores.length;
    const consistencyBoost = user.assessmentProfile.testsTaken > 5 ? 10 : 0; // Simple consistency logic
    user.assessmentProfile.totalScore = Math.round((0.7 * avgSkillScore) + (0.3 * consistencyBoost));

    await user.save();

    return {
      success: true,
      score: finalScore,
      correctCount,
      totalQuestions,
      weakAreas: user.assessmentProfile.weakAreas
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Weekly Recalculation: Updates Global Rankings for all users
 */
export const updateWeeklyRankings = async () => {
  // First, set current rank as previous rank for all users
  await User.updateMany(
    { 'assessmentProfile.testsTaken': { $gt: 0 } },
    [{ $set: { 'assessmentProfile.previousRank': '$assessmentProfile.globalRank' } }]
  );

  // Sort users based on score
  const users = await User.find({ 'assessmentProfile.testsTaken': { $gt: 0 } })
                          .sort({ 'assessmentProfile.totalScore': -1 });

  let rank = 1;
  for (const user of users) {
    user.assessmentProfile.globalRank = rank;
    rank++;
    await user.save();
  }

  return { success: true, message: `Updated rankings for ${users.length} users.` };
};

/**
 * Fetch top ranked users (Leaderboard)
 */
export const getLeaderboard = async (limit = 10) => {
  const users = await User.find({ 'assessmentProfile.testsTaken': { $gt: 0 } })
                          .sort({ 'assessmentProfile.globalRank': 1 })
                          .limit(limit)
                          .select('name assessmentProfile.totalScore assessmentProfile.globalRank assessmentProfile.previousRank assessmentProfile.isStarred assessmentProfile.skillScores');
  return users;
};
