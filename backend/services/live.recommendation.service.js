import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..");
const PIPELINE_SCRIPT = path.join(BACKEND_ROOT, "data", "learning_pipeline", "pipeline.py");
const RUNS_DIR = path.join(BACKEND_ROOT, "data", "learning_pipeline", "api_runs");
const DEFAULT_VENV_PYTHON = path.resolve(BACKEND_ROOT, "..", ".venv", "Scripts", "python.exe");

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr || ""}`.trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current);
  return out;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function normalizeResource(row) {
  const likeViewRatio = Number(row.engagement_score || 0);
  const cosineSimilarity = Number(row.semantic_similarity || 0);
  const commentSentiment = Number(row.sentiment_score || 0);

  return {
    skill: row.skill,
    videoId: row.video_id || "",
    title: row.video_title,
    channel: row.channel || "",
    channelSubscribers: Number(row.channel_subscribers || 0),
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    likeViewRatio,
    cosineSimilarity,
    commentSentiment,
    engagementScore: likeViewRatio,
    semanticSimilarity: cosineSimilarity,
    sentimentScore: commentSentiment,
    semanticComponent: Number(row.semantic_component || 0),
    engagementComponent: Number(row.engagement_component || 0),
    sentimentComponent: Number(row.sentiment_component || 0),
    channelComponent: Number(row.channel_component || 0),
    channelStrength: Number(row.channel_strength || 0),
    realtimeScore: Number(row.realtime_score || 0),
    thumbnailUrl: row.video_id
      ? `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`
      : "",
  };
}

import crypto from "crypto";

const rankedCache = new Map();
const CACHE_EXPIRATION = 60 * 60 * 1000; // 1 hour

function getCacheKey(args) {
  const s = JSON.stringify(args);
  return crypto.createHash('md5').update(s).digest('hex');
}

export async function getRealtimeRankedResources(options) {
  const {
    skills,
    videosPerSkill = 3,
    commentsPerVideo = 4,
    topK = 3,
    semanticWeight = 0.5,
    engagementWeight = 0.3,
    sentimentWeight = 0.2,
  } = options;

  const cacheKey = getCacheKey(options);
  const cached = rankedCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRATION)) {
    console.log(`🚀 Using cached ML-ranked resources for: ${skills.join(', ')}`);
    return cached.data;
  }

  await fs.mkdir(RUNS_DIR, { recursive: true });

  const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const outputDir = path.join(RUNS_DIR, runId);
  await fs.mkdir(outputDir, { recursive: true });

  let pythonCmd = process.env.PYTHON_EXECUTABLE || "python";
  try {
    await fs.access(DEFAULT_VENV_PYTHON);
    pythonCmd = process.env.PYTHON_EXECUTABLE || DEFAULT_VENV_PYTHON;
  } catch {
    // Keep default command when virtualenv python is unavailable.
  }
  const args = [
    PIPELINE_SCRIPT,
    "--skills",
    ...skills,
    "--videos-per-skill",
    String(videosPerSkill),
    "--comments-per-video",
    String(commentsPerVideo),
    "--output-dir",
    outputDir,
    "--top-k",
    String(topK),
    "--semantic-weight",
    String(semanticWeight),
    "--engagement-weight",
    String(engagementWeight),
    "--sentiment-weight",
    String(sentimentWeight),
  ];

  try {
    await execFileAsync(pythonCmd, args, {
      cwd: BACKEND_ROOT,
      timeout: 5 * 60 * 1000,
      env: process.env,
      maxBuffer: 1024 * 1024 * 8,
    });

    const outputCsv = path.join(outputDir, "top_recommended_resources.csv");
    const csvContent = await fs.readFile(outputCsv, "utf8");
    const rows = parseCsv(csvContent).map(normalizeResource);

    const result = {
      success: true,
      count: rows.length,
      skills,
      weights: {
        semanticWeight,
        engagementWeight,
        sentimentWeight,
      },
      resources: rows,
    };

    // Cache the result
    rankedCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } finally {
    await fs.rm(outputDir, { recursive: true, force: true });
  }
}
