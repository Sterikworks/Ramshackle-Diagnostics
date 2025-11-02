// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ───────────────────────────────────────────────────────────────────────────────
// Express setup
// ───────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// serve uploaded files (useful if your server is reachable publicly)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ───────────────────────────────────────────────────────────────────────────────
// Structured logging (single-line JSON to STDOUT for `docker compose logs -f`)
// ───────────────────────────────────────────────────────────────────────────────
const safePreview = (obj) => {
  try {
    if (!obj || typeof obj !== 'object') return undefined;
    return JSON.stringify(obj).slice(0, 200);
  } catch {
    return undefined;
  }
};

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  const bodyPreview =
    req.is('application/json') && req.body && typeof req.body === 'object'
      ? safePreview(req.body)
      : undefined;

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;

    // One-line JSON log per completed request
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'info',
        msg: 'http_request',
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms: Math.round(durationMs),
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        content_type: req.headers['content-type'],
        body_preview: bodyPreview,
      })
    );
  });

  next();
});

// Catch top-level errors
process.on('unhandledRejection', (err) => {
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'error',
      msg: 'unhandled_rejection',
      error: String(err && err.stack ? err.stack : err),
    })
  );
});

process.on('uncaughtException', (err) => {
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'error',
      msg: 'uncaught_exception',
      error: String(err && err.stack ? err.stack : err),
    })
  );
});

// ───────────────────────────────────────────────────────────────────────────────
// GitHub config (set these in your docker-compose.yml environment)
// ───────────────────────────────────────────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // e.g., ghp_***
const GITHUB_REPO = process.env.GITHUB_REPO;   // e.g., "Sterikworks/Ramshackle_Issues"

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.warn(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'warn',
      msg: 'missing_github_config',
      has_token: Boolean(GITHUB_TOKEN),
      has_repo: Boolean(GITHUB_REPO),
    })
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Ensure uploads folder exists
// ───────────────────────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ───────────────────────────────────────────────────────────────────────────────
// Multer setup for uploads (images, .vessel, logs, zip, etc.)
// ───────────────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // sanitize filename a little
    const base = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${base}`);
  },
});

const ALLOWED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.vessel', '.txt', '.log', '.zip', '.gz', '.json'
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext)) return cb(null, true);
  const error = new Error(`Unsupported file type: ${ext}`);
  error.code = 'UNSUPPORTED_FILE_TYPE';
  cb(error);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ───────────────────────────────────────────────────────────────────────────────
// Health check (for docker-compose healthcheck)
// ───────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ───────────────────────────────────────────────────────────────────────────────
// Helper: create GitHub issue
// ───────────────────────────────────────────────────────────────────────────────
async function createGithubIssue({ title, body, labels }) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error('GitHub configuration missing (GITHUB_TOKEN / GITHUB_REPO)');
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'info',
      msg: 'create_issue_attempt',
      title,
      labels,
    })
  );

  const resp = await axios.post(
    url,
    { title, body, labels },
    {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'UnityBugReporter',
        Accept: 'application/vnd.github+json',
      },
    }
  );

  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'info',
      msg: 'create_issue_success',
      issue_number: resp.data?.number,
      issue_url: resp.data?.html_url,
    })
  );

  return resp.data;
}

// ───────────────────────────────────────────────────────────────────────────────
// POST /report
// Accepts JSON OR multipart/form-data with optional file `attachment`
// JSON fields suggested by a Unity bug proxy:
//   - title (string, required)
//   - description (string)
//   - playerEmail (string)
//   - labels (array<string>)
//   - metadata (object) (e.g., platform, gameVersion, scene, device info, etc.)
// ───────────────────────────────────────────────────────────────────────────────
app.post('/report', upload.single('attachment'), async (req, res) => {
  try {
    const isMultipart = req.is('multipart/form-data');
    const body = isMultipart ? req.body : req.body || {};

    const title = (body.title || '').toString().trim() || 'Unity Bug Report';
    const description = (body.description || '').toString();
    const playerEmail = (body.playerEmail || '').toString();
    const labels = Array.isArray(body.labels)
      ? body.labels
      : (typeof body.labels === 'string' && body.labels.length > 0 ? [body.labels] : []);

    // Parse metadata if it looks like JSON in multipart
    let metadata = {};
    if (typeof body.metadata === 'string') {
      try { metadata = JSON.parse(body.metadata); } catch { metadata = { raw: body.metadata }; }
    } else if (body.metadata && typeof body.metadata === 'object') {
      metadata = body.metadata;
    }

    const attachment = req.file || null;
    const attachmentUrl = attachment ? `/uploads/${attachment.filename}` : null;

    // Build a clear GitHub issue body
    const mdSections = [];

    if (description) {
      mdSections.push(`### Description\n${description}`);
    }

    if (playerEmail) {
      mdSections.push(`**Player Email:** \`${playerEmail}\``);
    }

    if (attachmentUrl) {
      // Note: this is a link to your server; ensure it’s reachable from GitHub viewers
      mdSections.push(`### Attachment\n[Download attachment](${attachmentUrl})`);
    }

    const metaForIssue = {
      ...metadata,
      request_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_agent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      content_type: req.headers['content-type'],
    };

    mdSections.push(
      '### Metadata\n' +
      '```json\n' +
      JSON.stringify(metaForIssue, null, 2) +
      '\n```'
    );

    const issueBody = mdSections.join('\n\n');

    const issue = await createGithubIssue({
      title,
      body: issueBody,
      labels: labels.length ? labels : ['bug'],
    });

    res.json({
      success: true,
      issue_url: issue.html_url,
      issue_number: issue.number,
      attachment: attachment ? { name: attachment.originalname, url: attachmentUrl } : null,
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || err?.message || 'Unknown error';

    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'error',
        msg: 'report_failed',
        status,
        error: typeof detail === 'string' ? detail : JSON.stringify(detail),
      })
    );

    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(400).json({ error: err.message });
    }

    res.status(status).json({ error: 'Failed to create GitHub issue' });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// Start the server
// ───────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'info',
      msg: 'server_started',
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    })
  );
});
