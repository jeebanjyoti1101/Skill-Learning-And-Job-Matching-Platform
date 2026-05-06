import mongoose from 'mongoose';

const learningResourceSchema = new mongoose.Schema({
  skill: {
    type: String,
    required: true,
    index: true
  },
  courses: [{
    title: String,
    platform: String,
    provider: String,
    link: String,
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner'
    }
  }],
  roadmap: [{
    step: Number,
    topic: String,
    description: String,
    resources: [String]
  }],
  estimatedTime: {
    type: String,
    default: ''
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Beginner'
  },
  title: {
    type: String
  },
  platform: {
    type: String
  },
  provider: {
    type: String
  },
  sourceType: {
    type: String,
    enum: ['static', 'dynamic'],
    default: 'static'
  },
  link: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
learningResourceSchema.index({ skill: 1, level: 1, sourceType: 1 });

export default mongoose.model('LearningResource', learningResourceSchema);
