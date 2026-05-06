import mongoose from 'mongoose';

const userInteractionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  // Interaction type
  type: {
    type: String,
    enum: [
      'job_view', 'job_save', 'job_apply', 'job_dismiss',
      'job_like', 'job_dislike',
      'course_start', 'course_complete', 'course_bookmark',
      'recommendation_click', 'recommendation_dismiss',
      'skill_add', 'skill_remove',
      'search_query', 'chatbot_query'
    ],
    required: true
  },
  // Target item reference
  targetType: {
    type: String,
    enum: ['job', 'course', 'skill', 'recommendation', 'search'],
    required: true
  },
  targetId: {
    type: String,
    default: ''
  },
  targetTitle: {
    type: String,
    default: ''
  },
  // Context
  metadata: {
    skills: [String],
    matchPercentage: Number,
    query: String,
    source: String,
    timeSpent: Number, // seconds
    rating: { type: Number, min: 1, max: 5 }
  },
  // Feedback
  feedback: {
    relevant: { type: Boolean, default: null },
    comment: { type: String, default: '' }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
userInteractionSchema.index({ userId: 1, type: 1 });
userInteractionSchema.index({ userId: 1, targetType: 1, timestamp: -1 });
userInteractionSchema.index({ targetId: 1, type: 1 });
userInteractionSchema.index({ timestamp: -1 });

export default mongoose.model('UserInteraction', userInteractionSchema);
