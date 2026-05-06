import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import UserInteraction from '../models/UserInteraction.js';
import { getAllJobs, getSkillsFrequency } from './data.loader.service.js';

/**
 * Hybrid Recommendation Service
 * TF-IDF + Cosine + Random Forest + Gradient Boosting Ranker + Explainability
 */

const skillsData = getSkillsFrequency();
const skillsFrequency = skillsData.frequency || {};
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_SCRIPT_PATH = path.join(__dirname, '../ml/hybrid_recommender.py');
const MODEL_PATH = path.join(__dirname, '../ml/models/hybrid_model.joblib');
const DATASET_PATH = path.join(__dirname, '../data/merged_jobs_dataset.json');

const EXPERIENCE_LEVELS = {
  'Entry Level': 1,
  'Mid Level': 2,
  'Senior Level': 3,
  Expert: 4
};

const SKILL_RELATIONS = {
  javascript: ['js', 'es6', 'ecmascript', 'typescript', 'node.js', 'react', 'vue', 'angular'],
  python: ['django', 'flask', 'fastapi', 'pandas', 'numpy', 'pytorch', 'tensorflow'],
  java: ['spring', 'spring boot', 'hibernate', 'jvm', 'kotlin'],
  aws: ['amazon web services', 'ec2', 's3', 'lambda', 'cloud computing'],
  azure: ['microsoft azure', 'azure devops', 'cloud computing'],
  gcp: ['google cloud', 'google cloud platform', 'cloud computing'],
  react: ['react.js', 'reactjs', 'redux', 'next.js'],
  'node.js': ['nodejs', 'express', 'express.js'],
  sql: ['mysql', 'postgresql', 'sqlite', 'database', 'rdbms'],
  nosql: ['mongodb', 'cassandra', 'redis', 'dynamodb'],
  docker: ['containerization', 'kubernetes', 'container'],
  'machine learning': ['ml', 'deep learning', 'ai', 'neural networks', 'nlp'],
  'data science': ['data analysis', 'data analytics', 'statistics', 'data visualization'],
  devops: ['ci/cd', 'jenkins', 'github actions', 'ansible', 'terraform'],
  cybersecurity: ['security', 'penetration testing', 'ethical hacking', 'infosec'],
  html: ['html5'],
  css: ['css3', 'sass', 'less', 'tailwind', 'bootstrap']
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeSkill(s) {
  return String(s || '').toLowerCase().trim();
}

function parseSalaryToNumber(salary) {
  if (!salary) return null;
  if (typeof salary === 'number') return salary;
  const text = String(salary).replace(/,/g, '');
  const numbers = text.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  const values = numbers.map(n => Number(n)).filter(n => Number.isFinite(n));
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg < 1000) return avg * 1000;
  return avg;
}

function normalizePythonRecommendation(rec) {
  const score = Number(rec.hybridScore || 0);
  return {
    ...rec,
    isGoodMatch: score >= 55,
    isPartialMatch: score >= 35 && score < 55,
    requiresUpskilling: score >= 15 && score < 35,
    employabilityScore: Math.round(score),
    readinessLevel: getReadinessLevel(score),
    explanation: {
      matchedSkills: rec.matchedSkills || [],
      relatedMatches: (rec.relatedSkillMatches || []).map(m => `${m.userSkill || ''} -> ${m.jobSkill || ''}`),
      missingSkills: rec.missingSkills || [],
      whyRecommended: [
        `Cosine similarity: ${Math.round(Number(rec.cosineSimilarityScore || 0))}%`,
        `Random Forest match probability: ${Math.round(Number(rec.randomForestProbability || 0))}%`,
        `Gradient Boosting score: ${Math.round(Number(rec.gradientBoostingScore || 0))}%`,
        `XGBoost score: ${Math.round(Number(rec.xgboostScore || 0))}%`
      ]
    }
  };
}

async function runPythonHybridRecommendation(userProfile, options = {}) {
  const userSkills = (userProfile.skills || []).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
  const userLevel = userProfile.preferences?.experienceLevel || 'Entry Level';
  const desiredSalary = userProfile.preferences?.desiredSalary || null;

  const python = process.env.PYTHON_PATH || 'python';
  const topN = options.topN || options.limit || 15;
  const args = [
    PYTHON_SCRIPT_PATH,
    'recommend',
    '--dataset-path', DATASET_PATH,
    '--model-path', MODEL_PATH,
    '--skills-json', JSON.stringify(userSkills),
    '--experience-level', userLevel,
    '--top-n', String(topN)
  ];

  if (desiredSalary) {
    args.push('--desired-salary', String(desiredSalary));
  }
  if (options.minSalary != null) {
    args.push('--min-salary', String(options.minSalary));
  }
  if (options.maxSalary != null) {
    args.push('--max-salary', String(options.maxSalary));
  }
  if (options.strictExperienceLevel === true) {
    args.push('--strict-experience');
  }

  const { stdout } = await execFileAsync(python, args, {
    cwd: path.join(__dirname, '..'),
    maxBuffer: 1024 * 1024 * 10
  });

  return JSON.parse(stdout.trim());
}

export const trainHybridModels = async () => {
  const python = process.env.PYTHON_PATH || 'python';
  const args = [
    PYTHON_SCRIPT_PATH,
    'train',
    '--dataset-path', DATASET_PATH,
    '--model-path', MODEL_PATH
  ];

  const { stdout } = await execFileAsync(python, args, {
    cwd: path.join(__dirname, '..'),
    maxBuffer: 1024 * 1024 * 10
  });

  return JSON.parse(stdout.trim());
};

const readHybridModelMetrics = async () => {
  const python = process.env.PYTHON_PATH || 'python';
  const oneLiner = [
    'import json,joblib',
    `m=joblib.load(r'''${MODEL_PATH}''')`,
    'print(json.dumps({"metrics":m.get("metrics",{}),"modelPath":m.get("modelPath")}, ensure_ascii=True))'
  ].join(';');

  const { stdout } = await execFileAsync(python, ['-c', oneLiner], {
    cwd: path.join(__dirname, '..'),
    maxBuffer: 1024 * 1024 * 10
  });

  return JSON.parse(stdout.trim());
};

export const getHybridEvaluation = async (options = {}) => {
  const { retrain = false } = options;
  const trainResult = retrain ? await trainHybridModels() : await readHybridModelMetrics();
  const metrics = trainResult.metrics || {};

  const primary = metrics.family_holdout_f1 != null
    ? {
      split: 'family_holdout',
      accuracy: metrics.family_holdout_accuracy ?? null,
      precision: metrics.family_holdout_precision ?? null,
      recall: metrics.family_holdout_recall ?? null,
      f1: metrics.family_holdout_f1 ?? null,
      auc: metrics.family_holdout_auc ?? null
    }
    : {
      split: 'group_holdout',
      accuracy: metrics.group_holdout_accuracy ?? metrics.accuracy ?? null,
      precision: metrics.group_holdout_precision ?? metrics.precision ?? null,
      recall: metrics.group_holdout_recall ?? metrics.recall ?? null,
      f1: metrics.group_holdout_f1 ?? metrics.f1 ?? null,
      auc: metrics.group_holdout_auc ?? metrics.auc ?? null
    };

  return {
    success: true,
    evaluation: {
      primary,
      secondary: {
        random_split: {
          accuracy: metrics.accuracy ?? null,
          precision: metrics.precision ?? null,
          recall: metrics.recall ?? null,
          f1: metrics.f1 ?? null,
          auc: metrics.auc ?? null
        },
        cross_validation: {
          accuracy_mean: metrics.cv_accuracy_mean ?? null,
          f1_mean: metrics.cv_f1_mean ?? null,
          auc_mean: metrics.cv_auc_mean ?? null
        }
      },
      raw: metrics
    },
    modelPath: trainResult.modelPath || MODEL_PATH,
    ranker: metrics.ranker || 'gradient_boosting',
    retrained: retrain
  };
};

function getDemandLevel(freq) {
  if (freq >= 40) return 'High Demand';
  if (freq >= 20) return 'Medium Demand';
  if (freq >= 10) return 'Growing';
  return 'Niche';
}

function estimateSkillLearningTime(skill) {
  const complexSkills = ['machine learning', 'deep learning', 'kubernetes', 'system design', 'cloud architecture'];
  const mediumSkills = ['react', 'angular', 'vue', 'docker', 'aws', 'azure', 'node.js', 'python', 'java'];
  const s = skill.toLowerCase();

  if (complexSkills.some(cs => s.includes(cs))) return 8;
  if (mediumSkills.some(ms => s.includes(ms))) return 4;
  return 2;
}

function getReadinessLevel(score) {
  if (score >= 80) return 'Job Ready - Apply Now!';
  if (score >= 60) return 'Almost Ready - Minor skill gaps';
  if (score >= 40) return 'Partially Ready - Some learning needed';
  if (score >= 25) return 'Early Stage - Focused learning required';
  return 'Beginner - Structured learning path recommended';
}

function enhancedSkillMatch(userSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) {
    return { score: 0, directMatches: [], relatedMatches: [], missingSkills: [], totalRequired: 0 };
  }

  const userLower = (userSkills || []).map(normalizeSkill);
  const jobLower = (jobSkills || []).map(normalizeSkill);

  const directMatches = [];
  const relatedMatches = [];
  const missingSkills = [];

  for (const jobSkill of jobLower) {
    if (!jobSkill) continue;

    if (userLower.includes(jobSkill)) {
      directMatches.push(jobSkill);
      continue;
    }

    let foundRelated = false;
    for (const [baseSkill, related] of Object.entries(SKILL_RELATIONS)) {
      if (related.includes(jobSkill) && userLower.includes(baseSkill)) {
        relatedMatches.push({ jobSkill, userSkill: baseSkill });
        foundRelated = true;
        break;
      }
      if (baseSkill === jobSkill && related.some(r => userLower.includes(r))) {
        const matchedRelated = related.find(r => userLower.includes(r));
        relatedMatches.push({ jobSkill, userSkill: matchedRelated });
        foundRelated = true;
        break;
      }
    }

    if (!foundRelated) {
      missingSkills.push(jobSkill);
    }
  }

  const totalRequired = Math.max(1, jobLower.length);
  const score = ((directMatches.length + relatedMatches.length * 0.5) / totalRequired) * 100;

  return {
    score: clamp(score, 0, 100),
    directMatches,
    relatedMatches,
    missingSkills,
    totalRequired: jobLower.length
  };
}

function buildIdfMap(jobs) {
  const df = new Map();
  const totalDocs = Math.max(1, jobs.length);

  for (const job of jobs) {
    const skills = new Set((job.skillsRequired || job.skills_required || []).map(normalizeSkill).filter(Boolean));
    for (const skill of skills) {
      df.set(skill, (df.get(skill) || 0) + 1);
    }
  }

  const idf = new Map();
  for (const [skill, count] of df.entries()) {
    idf.set(skill, Math.log((totalDocs + 1) / (count + 1)) + 1);
  }

  for (const [skill, freq] of Object.entries(skillsFrequency)) {
    if (!idf.has(skill)) {
      idf.set(skill, Math.log((totalDocs + 1) / ((freq || 1) + 1)) + 1);
    }
  }

  return idf;
}

function buildTfidfVector(skills, idfMap) {
  const tf = new Map();
  const normalized = (skills || []).map(normalizeSkill).filter(Boolean);
  const total = Math.max(1, normalized.length);

  for (const skill of normalized) {
    tf.set(skill, (tf.get(skill) || 0) + 1);
  }

  const vector = new Map();
  for (const [skill, count] of tf.entries()) {
    const tfVal = count / total;
    const idfVal = idfMap.get(skill) || 1;
    vector.set(skill, tfVal * idfVal);
  }

  return vector;
}

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...vecA.keys(), ...vecB.keys()]);
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const k of keys) {
    const a = vecA.get(k) || 0;
    const b = vecB.get(k) || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function experienceLevelScore(userLevel, jobLevel) {
  const userRank = EXPERIENCE_LEVELS[userLevel] || 1;
  const jobRank = EXPERIENCE_LEVELS[jobLevel] || 1;
  const diff = Math.abs(userRank - jobRank);
  if (diff === 0) return 1;
  if (diff === 1) return 0.6;
  if (diff === 2) return 0.25;
  return 0;
}

function salaryAlignmentScore(userSalary, jobSalary) {
  const user = parseSalaryToNumber(userSalary);
  const job = parseSalaryToNumber(jobSalary);
  if (!user || !job) return 0.5;
  if (job >= user) return 1;

  const ratio = job / user;
  return clamp(ratio, 0, 1);
}

function inferPseudoLabel(cosine, skillMatchRatio, experienceScore, relatedRatio, salaryScore) {
  const score =
    cosine * 0.35 +
    skillMatchRatio * 0.35 +
    experienceScore * 0.15 +
    relatedRatio * 0.1 +
    salaryScore * 0.05;

  return score >= 0.55 ? 1 : 0;
}

function shuffleDeterministic(arr) {
  // Deterministic shuffle for reproducibility without external seed libs.
  return [...arr].sort((a, b) => {
    const av = Math.sin((a.index + 1) * 12.9898) * 43758.5453;
    const bv = Math.sin((b.index + 1) * 12.9898) * 43758.5453;
    return (av - Math.floor(av)) - (bv - Math.floor(bv));
  });
}

function splitTrainTest(features, labels, testRatio = 0.2) {
  const rows = features.map((row, index) => ({ row, label: labels[index], index }));
  const shuffled = shuffleDeterministic(rows);
  const testSize = Math.max(1, Math.floor(shuffled.length * testRatio));
  const test = shuffled.slice(0, testSize);
  const train = shuffled.slice(testSize);

  return {
    trainX: train.map(r => r.row),
    trainY: train.map(r => r.label),
    testX: test.map(r => r.row),
    testY: test.map(r => r.label)
  };
}

function giniImpurity(labels) {
  if (!labels.length) return 0;
  const p1 = labels.reduce((s, y) => s + y, 0) / labels.length;
  const p0 = 1 - p1;
  return 1 - (p1 * p1 + p0 * p0);
}

function majorityProbability(labels) {
  if (!labels.length) return 0;
  return labels.reduce((s, y) => s + y, 0) / labels.length;
}

function bestSplit(X, y, featureIndices) {
  let best = null;

  for (const fi of featureIndices) {
    const values = X.map(row => row[fi]).filter(v => Number.isFinite(v));
    if (values.length < 4) continue;

    const sorted = [...new Set(values)].sort((a, b) => a - b);
    if (sorted.length < 2) continue;

    const step = Math.max(1, Math.floor(sorted.length / 10));
    for (let i = step; i < sorted.length; i += step) {
      const threshold = sorted[i];
      const leftY = [];
      const rightY = [];

      for (let j = 0; j < X.length; j++) {
        if (X[j][fi] <= threshold) leftY.push(y[j]);
        else rightY.push(y[j]);
      }

      if (leftY.length === 0 || rightY.length === 0) continue;

      const impurity =
        (leftY.length / y.length) * giniImpurity(leftY) +
        (rightY.length / y.length) * giniImpurity(rightY);

      if (!best || impurity < best.impurity) {
        best = { fi, threshold, impurity, leftY, rightY };
      }
    }
  }

  return best;
}

function buildTree(X, y, maxDepth, minSamples, featureBagSize, depth = 0) {
  const prob = majorityProbability(y);
  if (depth >= maxDepth || y.length <= minSamples || prob === 0 || prob === 1) {
    return { leaf: true, prob };
  }

  const totalFeatures = X[0].length;
  const allFeatures = [...Array(totalFeatures).keys()];
  const featureIndices = allFeatures
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.max(1, Math.min(featureBagSize, totalFeatures)));

  const split = bestSplit(X, y, featureIndices);
  if (!split) {
    return { leaf: true, prob };
  }

  const leftX = [];
  const rightX = [];
  const leftY = [];
  const rightY = [];

  for (let i = 0; i < X.length; i++) {
    if (X[i][split.fi] <= split.threshold) {
      leftX.push(X[i]);
      leftY.push(y[i]);
    } else {
      rightX.push(X[i]);
      rightY.push(y[i]);
    }
  }

  return {
    leaf: false,
    fi: split.fi,
    threshold: split.threshold,
    left: buildTree(leftX, leftY, maxDepth, minSamples, featureBagSize, depth + 1),
    right: buildTree(rightX, rightY, maxDepth, minSamples, featureBagSize, depth + 1)
  };
}

function predictTree(node, row) {
  if (node.leaf) return node.prob;
  if (row[node.fi] <= node.threshold) return predictTree(node.left, row);
  return predictTree(node.right, row);
}

function trainRandomForest(X, y, options = {}) {
  const nTrees = options.nTrees || 40;
  const maxDepth = options.maxDepth || 4;
  const minSamples = options.minSamples || 8;
  const featureBagSize = options.featureBagSize || Math.max(2, Math.floor(Math.sqrt(X[0].length)));

  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    const sampleX = [];
    const sampleY = [];

    for (let i = 0; i < X.length; i++) {
      const idx = Math.floor(Math.random() * X.length);
      sampleX.push(X[idx]);
      sampleY.push(y[idx]);
    }

    trees.push(buildTree(sampleX, sampleY, maxDepth, minSamples, featureBagSize));
  }

  return {
    predictProba: row => {
      const probs = trees.map(tree => predictTree(tree, row));
      const avg = probs.reduce((a, b) => a + b, 0) / probs.length;
      return clamp(avg, 0, 1);
    }
  };
}

function fitDecisionStump(X, residuals) {
  const nFeatures = X[0].length;
  let best = null;

  for (let fi = 0; fi < nFeatures; fi++) {
    const values = [...new Set(X.map(r => r[fi]).filter(v => Number.isFinite(v)))].sort((a, b) => a - b);
    if (values.length < 2) continue;

    const step = Math.max(1, Math.floor(values.length / 10));
    for (let i = step; i < values.length; i += step) {
      const threshold = values[i];
      const left = [];
      const right = [];

      for (let j = 0; j < X.length; j++) {
        if (X[j][fi] <= threshold) left.push(residuals[j]);
        else right.push(residuals[j]);
      }

      if (!left.length || !right.length) continue;

      const leftMean = left.reduce((a, b) => a + b, 0) / left.length;
      const rightMean = right.reduce((a, b) => a + b, 0) / right.length;

      let mse = 0;
      for (let j = 0; j < X.length; j++) {
        const pred = X[j][fi] <= threshold ? leftMean : rightMean;
        const err = residuals[j] - pred;
        mse += err * err;
      }

      if (!best || mse < best.mse) {
        best = { fi, threshold, leftMean, rightMean, mse };
      }
    }
  }

  return best;
}

function trainGradientBoostingRanker(X, y, options = {}) {
  const nEstimators = options.nEstimators || 60;
  const learningRate = options.learningRate || 0.08;

  const base = y.reduce((a, b) => a + b, 0) / Math.max(1, y.length);
  let preds = new Array(y.length).fill(base);
  const stumps = [];

  for (let m = 0; m < nEstimators; m++) {
    const residuals = y.map((target, i) => target - preds[i]);
    const stump = fitDecisionStump(X, residuals);
    if (!stump) break;

    stumps.push(stump);
    preds = preds.map((p, i) => {
      const update = X[i][stump.fi] <= stump.threshold ? stump.leftMean : stump.rightMean;
      return p + learningRate * update;
    });
  }

  return {
    predict: row => {
      let pred = base;
      for (const stump of stumps) {
        const update = row[stump.fi] <= stump.threshold ? stump.leftMean : stump.rightMean;
        pred += learningRate * update;
      }
      return pred;
    }
  };
}

function computeAUC(yTrue, yProb) {
  const pairs = yTrue.map((y, i) => ({ y, p: yProb[i] })).sort((a, b) => b.p - a.p);

  let tp = 0;
  let fp = 0;
  const positives = yTrue.reduce((a, b) => a + b, 0);
  const negatives = yTrue.length - positives;

  if (positives === 0 || negatives === 0) return 0.5;

  const points = [{ tpr: 0, fpr: 0 }];
  for (const item of pairs) {
    if (item.y === 1) tp += 1;
    else fp += 1;
    points.push({ tpr: tp / positives, fpr: fp / negatives });
  }

  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    const x1 = points[i - 1].fpr;
    const x2 = points[i].fpr;
    const y1 = points[i - 1].tpr;
    const y2 = points[i].tpr;
    auc += ((y1 + y2) / 2) * (x2 - x1);
  }

  return clamp(auc, 0, 1);
}

function evaluateClassification(yTrue, yProb, threshold = 0.5) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const pred = yProb[i] >= threshold ? 1 : 0;
    const actual = yTrue[i];

    if (pred === 1 && actual === 1) tp += 1;
    else if (pred === 1 && actual === 0) fp += 1;
    else if (pred === 0 && actual === 0) tn += 1;
    else fn += 1;
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const auc = computeAUC(yTrue, yProb);

  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    auc: Number(auc.toFixed(4)),
    confusionMatrix: { tp, fp, tn, fn }
  };
}

async function collaborativeScore(userId, jobTitle) {
  try {
    const userInteractions = await UserInteraction.find({
      userId,
      type: { $in: ['job_like', 'job_apply', 'job_save'] }
    }).lean();

    if (userInteractions.length === 0) return 0;

    const likedJobs = userInteractions.map(i => i.targetTitle);
    const similarUsers = await UserInteraction.find({
      userId: { $ne: userId },
      targetTitle: { $in: likedJobs },
      type: { $in: ['job_like', 'job_apply', 'job_save'] }
    }).lean();

    if (similarUsers.length === 0) return 0;

    const similarUserIds = [...new Set(similarUsers.map(u => u.userId))];
    const targetJobInteractions = await UserInteraction.find({
      userId: { $in: similarUserIds },
      targetTitle: jobTitle,
      type: { $in: ['job_like', 'job_apply', 'job_save'] }
    }).lean();

    return similarUserIds.length === 0 ? 0 : targetJobInteractions.length / similarUserIds.length;
  } catch {
    return 0;
  }
}

function applyDiversity(jobs, factor) {
  if (jobs.length <= 3 || factor <= 0) return jobs;

  const diverse = [jobs[0]];
  for (let i = 1; i < jobs.length; i++) {
    const firstWord = (jobs[i].title || '').split(' ')[0].toLowerCase();
    const sameCategory = diverse.filter(d => (d.title || '').split(' ')[0].toLowerCase() === firstWord).length;
    const maxPerCategory = Math.max(2, Math.floor(diverse.length * (1 - factor)));

    if (sameCategory < maxPerCategory || diverse.length < 3) {
      diverse.push(jobs[i]);
    }
  }

  return diverse;
}

function generateLearningPlan(missingSkills) {
  const phases = [];
  const highDemand = missingSkills.filter(s => s.demandLevel === 'High Demand');
  const medDemand = missingSkills.filter(s => s.demandLevel === 'Medium Demand');
  const others = missingSkills.filter(s => !['High Demand', 'Medium Demand'].includes(s.demandLevel));

  if (highDemand.length > 0) {
    phases.push({
      phase: 1,
      title: 'Priority Skills (High Demand)',
      timeline: '1-4 weeks',
      skills: highDemand.slice(0, 5).map(s => s.skill),
      advice: 'Start here because these skills are most sought after in the market.'
    });
  }

  if (medDemand.length > 0) {
    phases.push({
      phase: phases.length + 1,
      title: 'Secondary Skills (Medium Demand)',
      timeline: '2-6 weeks',
      skills: medDemand.slice(0, 5).map(s => s.skill),
      advice: 'Build on your foundation with these valuable skills.'
    });
  }

  if (others.length > 0) {
    phases.push({
      phase: phases.length + 1,
      title: 'Specialized Skills',
      timeline: '4-8 weeks',
      skills: others.slice(0, 5).map(s => s.skill),
      advice: 'These niche skills help differentiate your profile.'
    });
  }

  return phases;
}

function generateSmartRecommendations(score, missingSkills) {
  const recs = [];
  if (score >= 75) {
    recs.push('You are close to being job-ready. Focus on remaining gaps and start applying.');
    recs.push('Update your resume and profile to highlight matching skills.');
  } else if (score >= 50) {
    recs.push('Good progress. A focused 1-2 month learning sprint can close the gap.');
    recs.push('Prioritize high-demand missing skills first.');
  } else if (score >= 30) {
    recs.push('Build a structured learning plan around prioritized skills.');
    recs.push('Consider guided courses for faster progression.');
  } else {
    recs.push('Start with fundamentals and build consistency before specialization.');
    recs.push('Use a 3-6 month roadmap and track milestone progress.');
  }

  if (missingSkills.length > 0) {
    recs.push(`Immediate action: begin with "${missingSkills[0].skill}".`);
  }

  return recs;
}

export const getHybridRecommendations = async (userProfile, options = {}) => {
  try {
    const {
      limit = 15,
      topN,
      minScore = 15,
      minSalary = null,
      maxSalary = null,
      strictExperienceLevel = false,
      includeCollaborative = false,
      includeEvaluation = true,
      usePythonModel = true,
      diversityFactor = 0.2,
      maxTrainingRows = 5000,
      rfWeight = 0.3,
      rankWeight = 0.25,
      cosineWeight = 0.3,
      collaborativeWeight = 0.1,
      experienceWeight = 0.05
    } = options;

    const userSkills = (userProfile.skills || []).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean);
    const userId = userProfile._id?.toString() || userProfile.email || 'anonymous';
    const userLevel = userProfile.preferences?.experienceLevel || 'Entry Level';
    const desiredSalary = userProfile.preferences?.desiredSalary || null;

    if (userSkills.length === 0) {
      return { success: false, message: 'User skills are required for recommendations' };
    }

    if (usePythonModel) {
      try {
        const py = await runPythonHybridRecommendation(userProfile, {
          limit,
          topN,
          minSalary,
          maxSalary,
          strictExperienceLevel
        });

        const mappedJobs = (py.jobs || [])
          .map(normalizePythonRecommendation)
          .filter(j => j.hybridScore >= minScore)
          .slice(0, topN || limit);

        return {
          success: py.success !== false,
          userSkills,
          userPreferences: {
            experienceLevel: userLevel,
            desiredSalary
          },
          statistics: py.statistics || {
            totalJobsAnalyzed: mappedJobs.length,
            jobsReturned: mappedJobs.length
          },
          evaluation: includeEvaluation ? (py.evaluation || undefined) : undefined,
          jobs: mappedJobs
        };
      } catch (pythonError) {
        console.warn('Python hybrid model unavailable, falling back to JS pipeline:', pythonError.message);
      }
    }

    const jobsData = await getAllJobs();
    const idfMap = buildIdfMap(jobsData);
    const userVector = buildTfidfVector(userSkills, idfMap);

    const rows = jobsData.map((job, index) => {
      const jobSkills = job.skillsRequired || job.skills_required || [];
      const match = enhancedSkillMatch(userSkills, jobSkills);
      const jobVector = buildTfidfVector(jobSkills, idfMap);
      const cosine = cosineSimilarity(userVector, jobVector);
      const skillMatchRatio = match.totalRequired > 0 ? match.directMatches.length / match.totalRequired : 0;
      const relatedRatio = match.totalRequired > 0 ? match.relatedMatches.length / match.totalRequired : 0;
      const expScore = experienceLevelScore(userLevel, job.experienceLevel || job.experience_level || 'Entry Level');
      const salaryScore = salaryAlignmentScore(desiredSalary, job.salary || null);
      const matchCountNorm = Math.min(1, match.directMatches.length / 10);

      const features = [
        cosine,
        skillMatchRatio,
        matchCountNorm,
        expScore,
        relatedRatio,
        salaryScore
      ];

      const rankingTarget =
        cosine * 0.35 +
        skillMatchRatio * 0.35 +
        expScore * 0.15 +
        relatedRatio * 0.1 +
        salaryScore * 0.05;

      return {
        index,
        job,
        match,
        cosine,
        expScore,
        salaryScore,
        features,
        label: null,
        rankingTarget
      };
    }).filter(r => (r.job.skillsRequired || r.job.skills_required || []).length > 0);

    const sortedTargets = [...rows.map(r => r.rankingTarget)].sort((a, b) => a - b);
    const cutIndex = Math.floor(sortedTargets.length * 0.65);
    const dynamicThreshold = sortedTargets[Math.max(0, Math.min(sortedTargets.length - 1, cutIndex))] || 0.55;

    rows.forEach(r => {
      const heuristicLabel = inferPseudoLabel(
        r.features[0],
        r.features[1],
        r.features[3],
        r.features[4],
        r.features[5]
      );
      r.label = r.rankingTarget >= dynamicThreshold || heuristicLabel === 1 ? 1 : 0;
    });

    const sampledRows = rows.slice(0, Math.min(maxTrainingRows, rows.length));
    const featureMatrix = sampledRows.map(r => r.features);
    const labels = sampledRows.map(r => r.label);
    const targets = sampledRows.map(r => r.rankingTarget);

    if (featureMatrix.length < 10) {
      return { success: false, message: 'Not enough training data to produce hybrid recommendations' };
    }

    const { trainX, trainY, testX, testY } = splitTrainTest(featureMatrix, labels, 0.2);
    const forest = trainRandomForest(trainX, trainY, { nTrees: 45, maxDepth: 4, minSamples: 8 });
    const ranker = trainGradientBoostingRanker(featureMatrix, targets, { nEstimators: 55, learningRate: 0.08 });

    const testProb = testX.map(row => forest.predictProba(row));
    const evaluation = includeEvaluation ? evaluateClassification(testY, testProb, 0.5) : null;

    const rawRankScores = rows.map(r => ranker.predict(r.features));
    const minRank = Math.min(...rawRankScores);
    const maxRank = Math.max(...rawRankScores);

    const normalizeRank = value => {
      if (maxRank === minRank) return 0.5;
      return (value - minRank) / (maxRank - minRank);
    };

    let scored = rows.map((row, idx) => {
      const rfProbability = forest.predictProba(row.features);
      const rankScore = normalizeRank(rawRankScores[idx]);

      const baseHybridScore = (
        row.cosine * cosineWeight +
        rfProbability * rfWeight +
        rankScore * rankWeight +
        row.expScore * experienceWeight
      );

      return {
        row,
        rfProbability,
        rankScore,
        collaborativeScore: 0,
        baseHybridScore,
        hybridScore: baseHybridScore
      };
    });

    if (includeCollaborative) {
      const preselect = [...scored].sort((a, b) => b.baseHybridScore - a.baseHybridScore).slice(0, 120);
      const collabMap = new Map();

      await Promise.all(preselect.map(async item => {
        const c = await collaborativeScore(userId, item.row.job.title);
        collabMap.set(item.row.job.title, c);
      }));

      scored = scored.map(item => {
        const collab = collabMap.get(item.row.job.title) || 0;
        const hybrid = item.baseHybridScore + collab * collaborativeWeight;
        return {
          ...item,
          collaborativeScore: collab,
          hybridScore: clamp(hybrid, 0, 1)
        };
      });
    }

    let recommendations = scored
      .map(item => {
        const job = item.row.job;
        const match = item.row.match;
        const score100 = Math.round(item.hybridScore * 1000) / 10;

        return {
          jobId: job._id || job.title,
          title: job.title,
          description: job.description || '',
          company: job.company || 'Various Companies',
          location: job.location || 'Remote',
          requiredSkills: job.skillsRequired || job.skills_required || [],
          experienceLevel: job.experienceLevel || job.experience_level || 'Entry Level',
          salary: job.salary || null,
          certifications: job.certifications || [],
          source: job.source || 'database',

          hybridScore: score100,
          cosineSimilarityScore: Math.round(item.row.cosine * 1000) / 10,
          randomForestProbability: Math.round(item.rfProbability * 1000) / 10,
          rankingModelScore: Math.round(item.rankScore * 1000) / 10,
          experienceScore: Math.round(item.row.expScore * 1000) / 10,
          collaborativeScore: Math.round(item.collaborativeScore * 1000) / 10,

          matchedSkills: match.directMatches,
          relatedSkillMatches: match.relatedMatches,
          missingSkills: match.missingSkills,
          skillMatchCount: match.directMatches.length,
          missingSkillsCount: match.missingSkills.length,
          confidenceScore: Math.round(item.hybridScore * 1000) / 10,

          explanation: {
            matchedSkills: match.directMatches,
            relatedMatches: match.relatedMatches.map(m => `${m.userSkill} -> ${m.jobSkill}`),
            missingSkills: match.missingSkills,
            whyRecommended: [
              `Cosine similarity: ${Math.round(item.row.cosine * 100)}%`,
              `Random Forest match probability: ${Math.round(item.rfProbability * 100)}%`,
              `Ranking score: ${Math.round(item.rankScore * 100)}%`,
              `Experience fit: ${Math.round(item.row.expScore * 100)}%`
            ]
          },

          isGoodMatch: score100 >= 55,
          isPartialMatch: score100 >= 35 && score100 < 55,
          requiresUpskilling: score100 >= 15 && score100 < 35,
          employabilityScore: Math.round(score100),
          readinessLevel: getReadinessLevel(score100)
        };
      })
      .filter(j => j.hybridScore >= minScore)
      .filter(j => {
        if (strictExperienceLevel && j.experienceLevel !== userLevel) return false;
        const salary = parseSalaryToNumber(j.salary);
        if (minSalary != null && salary != null && salary < minSalary) return false;
        if (maxSalary != null && salary != null && salary > maxSalary) return false;
        return true;
      })
      .sort((a, b) => b.hybridScore - a.hybridScore);

    recommendations = applyDiversity(recommendations, diversityFactor);
    recommendations = recommendations.slice(0, topN || limit);

    const stats = {
      totalJobsAnalyzed: rows.length,
      jobsReturned: recommendations.length,
      goodMatches: recommendations.filter(j => j.isGoodMatch).length,
      partialMatches: recommendations.filter(j => j.isPartialMatch).length,
      requiresUpskilling: recommendations.filter(j => j.requiresUpskilling).length,
      averageHybridScore: recommendations.length
        ? Number((recommendations.reduce((sum, j) => sum + j.hybridScore, 0) / recommendations.length).toFixed(2))
        : 0,
      models: {
        classifier: 'Random Forest',
        ranker: 'Gradient Boosting Ranker',
        vectorizer: 'TF-IDF + Cosine Similarity'
      }
    };

    return {
      success: true,
      userSkills,
      userPreferences: {
        experienceLevel: userLevel,
        desiredSalary
      },
      statistics: stats,
      evaluation: evaluation || undefined,
      jobs: recommendations
    };
  } catch (error) {
    console.error('Hybrid Recommendation Error:', error.message);
    throw new Error('Failed to generate hybrid recommendations');
  }
};

export const getEnhancedSkillGap = async (userSkills, targetJobTitle) => {
  try {
    const jobsData = await getAllJobs();

    let targetJob = jobsData.find(j => (j.title || '').toLowerCase() === targetJobTitle.toLowerCase());
    if (!targetJob) {
      targetJob = jobsData.find(j =>
        (j.title || '').toLowerCase().includes(targetJobTitle.toLowerCase()) ||
        targetJobTitle.toLowerCase().includes((j.title || '').toLowerCase())
      );
    }

    if (!targetJob) {
      return { success: false, message: `Job "${targetJobTitle}" not found.` };
    }

    const jobSkills = targetJob.skillsRequired || targetJob.skills_required || [];
    const match = enhancedSkillMatch(userSkills, jobSkills);

    const prioritizedMissing = match.missingSkills
      .map(skill => ({
        skill,
        demand: skillsFrequency[skill.toLowerCase()] || 0,
        demandLevel: getDemandLevel(skillsFrequency[skill.toLowerCase()] || 0),
        estimatedLearningTime: estimateSkillLearningTime(skill)
      }))
      .sort((a, b) => b.demand - a.demand);

    const totalLearningWeeks = prioritizedMissing.reduce((sum, s) => sum + s.estimatedLearningTime, 0);

    return {
      success: true,
      job: {
        title: targetJob.title,
        description: targetJob.description || '',
        totalSkillsRequired: jobSkills.length,
        certifications: targetJob.certifications || [],
        experienceLevel: targetJob.experienceLevel || targetJob.experience_level || 'Entry Level',
        salary: targetJob.salary || null
      },
      analysis: {
        overallScore: Math.round(match.score),
        directMatches: match.directMatches.length,
        relatedMatches: match.relatedMatches.length,
        missingSkills: match.missingSkills.length,
        readinessLevel: getReadinessLevel(match.score),
        estimatedTotalLearningTime: `${totalLearningWeeks} weeks`,
        confidenceLevel: match.directMatches.length >= 3 ? 'High' : match.directMatches.length >= 1 ? 'Medium' : 'Low'
      },
      matchingSkills: {
        direct: match.directMatches,
        related: match.relatedMatches.map(r => `${r.userSkill} -> ${r.jobSkill}`)
      },
      missingSkills: prioritizedMissing,
      learningPlan: generateLearningPlan(prioritizedMissing),
      recommendations: generateSmartRecommendations(match.score, prioritizedMissing)
    };
  } catch (error) {
    console.error('Enhanced Skill Gap Error:', error.message);
    throw new Error('Failed to analyze skill gap');
  }
};

export const recordInteraction = async interactionData => {
  try {
    const interaction = new UserInteraction(interactionData);
    await interaction.save();
    return { success: true, interactionId: interaction._id };
  } catch (error) {
    console.error('Record Interaction Error:', error.message);
    return { success: false, message: error.message };
  }
};

export const getUserAnalytics = async userId => {
  try {
    const interactions = await UserInteraction.find({ userId }).sort({ timestamp: -1 }).limit(100).lean();

    const analytics = {
      totalInteractions: interactions.length,
      jobsSaved: interactions.filter(i => i.type === 'job_save').length,
      jobsApplied: interactions.filter(i => i.type === 'job_apply').length,
      coursesStarted: interactions.filter(i => i.type === 'course_start').length,
      coursesCompleted: interactions.filter(i => i.type === 'course_complete').length,
      recentActivity: interactions.slice(0, 10).map(i => ({
        type: i.type,
        target: i.targetTitle,
        timestamp: i.timestamp
      }))
    };

    return { success: true, analytics };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
