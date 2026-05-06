import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: false // Optional for now to avoid breaking existing users
  },
  // Skills (self-declared and validated)
  skills: [{
    name: { type: String, required: true },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], default: 'Beginner' },
    validated: { type: Boolean, default: false },
    yearsOfExperience: { type: Number, default: 0 }
  }],
  // Certifications and completed courses
  certifications: [{
    name: String,
    provider: String,
    dateObtained: Date,
    expiryDate: Date,
    credentialUrl: String
  }],
  completedCourses: [{
    title: String,
    platform: String,
    completedDate: Date,
    skillsCovered: [String]
  }],
  // Interests and career goals
  interests: [String],
  careerGoals: {
    shortTerm: { type: String, default: '' },
    longTerm: { type: String, default: '' },
    targetRoles: [String],
    targetIndustries: [String]
  },
  // Previous job experience and roles
  experience: [{
    title: String,
    company: String,
    industry: String,
    duration: String,
    description: String,
    skillsUsed: [String]
  }],
  // Preferred industries and job functions
  preferences: {
    industries: [String],
    jobFunctions: [String],
    employmentType: {
      type: [String],
      enum: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'],
      default: ['Full-time']
    },
    experienceLevel: {
      type: String,
      enum: ['Entry Level', 'Mid Level', 'Senior Level', 'Expert'],
      default: 'Entry Level'
    },
    salaryRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' }
    }
  },
  // Location preferences
  locationPreferences: {
    workType: { type: String, enum: ['Remote', 'Onsite', 'Hybrid', 'Any'], default: 'Any' },
    cities: [String],
    countries: [String]
  },
  // Educational background
  education: [{
    degree: String,
    field: String,
    institution: String,
    year: Number
  }],
  // Continuous Assessment & Ranking Profile
  assessmentProfile: {
    totalScore: { type: Number, default: 0 },
    globalRank: { type: Number, default: 0 },
    consistencyScore: { type: Number, default: 0 },
    testsTaken: { type: Number, default: 0 },
    weakAreas: [String],
    lastTestDate: Date,
    skillScores: [{
      skill: String,
      score: Number,
      history: [{ date: Date, score: Number }]
    }],
    previousRank: { type: Number, default: 0 },
    isStarred: { type: Boolean, default: false },
    externalCredentials: [{
      platform: String,
      credentialUrl: String,
      status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
      submittedAt: { type: Date, default: Date.now }
    }]
  },
  // Profile metadata
  profileCompleteness: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ 'skills.name': 1 });
userSchema.index({ 'careerGoals.targetRoles': 1 });

// Calculate profile completeness before saving
userSchema.pre('save', function(next) {
  let score = 0;
  const weights = {
    name: 10,
    email: 10,
    skills: 20,
    certifications: 10,
    interests: 5,
    careerGoals: 15,
    experience: 15,
    preferences: 5,
    locationPreferences: 5,
    education: 5
  };

  if (this.name) score += weights.name;
  if (this.email) score += weights.email;
  if (this.skills && this.skills.length > 0) score += weights.skills;
  if (this.certifications && this.certifications.length > 0) score += weights.certifications;
  if (this.interests && this.interests.length > 0) score += weights.interests;
  if (this.careerGoals && (this.careerGoals.shortTerm || this.careerGoals.targetRoles?.length > 0)) score += weights.careerGoals;
  if (this.experience && this.experience.length > 0) score += weights.experience;
  if (this.preferences && this.preferences.industries?.length > 0) score += weights.preferences;
  if (this.locationPreferences && this.locationPreferences.workType !== 'Any') score += weights.locationPreferences;
  if (this.education && this.education.length > 0) score += weights.education;

  this.profileCompleteness = score;
  this.lastActive = new Date();
  next();
});

export default mongoose.model('User', userSchema);
