import express from 'express';
import { getChatbotResponse } from '../services/ai.chatbot.service.js';
import { recordInteraction } from '../services/recommendation.service.js';

const router = express.Router();

/**
 * POST /api/chatbot/message
 * Send a message to the chatbot and get a response
 * 
 * Body: {
 *   message: "Find jobs for Python and SQL",
 *   context: {
 *     userSkills: ["Python", "SQL"],
 *     userName: "John",
 *     userEmail: "john@example.com",
 *     sessionId: "abc123"
 *   }
 * }
 */
router.post('/message', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, context } = req.body;

    console.log('┌─────────────────────────────────────────────────');
    console.log('│ [CHATBOT] New message received');
    console.log('│ Message:', message?.substring(0, 100));
    console.log('│ Context skills:', context?.userSkills?.length || 0);
    console.log('└─────────────────────────────────────────────────');

    if (!message || !message.trim()) {
      console.warn('[CHATBOT] ⚠️  Empty message received');
      return res.status(400).json({
        success: false,
        message: 'Message is required',
        error: 'EMPTY_MESSAGE'
      });
    }

    const response = await getChatbotResponse(message, context || {});
    const responseTime = Date.now() - startTime;

    console.log('┌─────────────────────────────────────────────────');
    console.log('│ [CHATBOT] ✅ Response generated');
    console.log('│ Intent:', response.intent || 'unknown');
    console.log('│ Response time:', responseTime + 'ms');
    console.log('│ Has jobs:', !!response.jobs);
    console.log('│ Has suggestions:', !!response.suggestions);
    console.log('└─────────────────────────────────────────────────');

    // Record chatbot interaction for analytics
    if (context?.userEmail) {
      await recordInteraction({
        userId: context.userEmail,
        type: 'chatbot_query',
        targetType: 'search',
        targetTitle: message.substring(0, 100),
        metadata: {
          query: message,
          skills: context.userSkills || [],
          intent: response.intent,
          responseTime
        }
      });
    }

    res.json(response);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('┌─────────────────────────────────────────────────');
    console.error('│ [CHATBOT] ❌ ERROR');
    console.error('│ Error:', error.message);
    console.error('│ Stack:', error.stack?.split('\n')[0]);
    console.error('│ Time:', responseTime + 'ms');
    console.error('└─────────────────────────────────────────────────');
    
    res.status(500).json({
      success: false,
      message: "Sorry, I'm having trouble right now. Please try again.",
      error: error.message,
      suggestions: ['Find jobs', 'Show top skills', 'Help'],
      debug: {
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/chatbot/feedback
 * Submit feedback on a chatbot response
 */
router.post('/feedback', async (req, res) => {
  try {
    const { messageId, helpful, comment, userId } = req.body;

    await recordInteraction({
      userId: userId || 'anonymous',
      type: 'recommendation_click',
      targetType: 'recommendation',
      targetId: messageId || '',
      feedback: {
        relevant: helpful,
        comment: comment || ''
      }
    });

    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/chatbot/suggestions
 * Get starter suggestions for the chatbot
 */
router.get('/suggestions', (req, res) => {
  res.json({
    success: true,
    suggestions: [
      { text: 'Find jobs matching my skills', icon: '🎯' },
      { text: 'What are the top skills in demand?', icon: '📈' },
      { text: 'Analyze my skill gap', icon: '📊' },
      { text: 'Plan my career path', icon: '🗺️' },
      { text: 'Find learning resources', icon: '📚' },
      { text: 'How does the matching algorithm work?', icon: '🧠' }
    ]
  });
});

export default router;
