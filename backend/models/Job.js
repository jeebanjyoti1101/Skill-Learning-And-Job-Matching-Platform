import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  company: {
    type: String,
    default: 'Various Companies'
  },
  skillsRequired: {
    type: [String],
    default: []
  },
  experienceLevel: {
    type: String,
    enum: ['Entry Level', 'Mid Level', 'Senior Level', 'Expert'],
    default: 'Entry Level'
  },
  category: {
    type: String,
    default: 'IT'
  },
  certifications: {
    type: [String],
    default: []
  },
  salary: {
    type: String,
    default: null
  },
  location: {
    type: String,
    default: 'Remote'
  },
  link: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
jobSchema.index({ title: 'text', description: 'text' });
jobSchema.index({ skillsRequired: 1 });
jobSchema.index({ category: 1, experienceLevel: 1 });

export default mongoose.model('Job', jobSchema);
