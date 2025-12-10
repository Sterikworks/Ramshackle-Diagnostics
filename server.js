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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// serve uploaded files (useful if your server is reachable publicly)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ───────────────────────────────────────────────────────────────────────────────
/** Structured logging (single-line JSON to STDOUT for `docker compose logs -f`) */
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

    // Skip logging health check requests (too noisy)
    if ((req.originalUrl || req.url) === '/health') return;

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
  destination: (_req, file, cb) => {
    let subdir = 'misc';
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      subdir = 'images';
    } else if (['.txt', '.log'].includes(ext)) {
      subdir = 'logs';
    } else if (ext === '.blueprint') {
      subdir = 'blueprints';
    }
    
    const targetDir = path.join(uploadDir, subdir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: (_req, file, cb) => {
    const base = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${base}`);
  },
});

const ALLOWED_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.txt', '.log', '.blueprint'
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext)) return cb(null, true);
  const error = new Error(`Only image files (PNG, JPG, GIF, WebP), debug logs (.txt, .log), and blueprints (.blueprint) allowed. Got: ${ext}`);
  error.code = 'UNSUPPORTED_FILE_TYPE';
  cb(error);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// ───────────────────────────────────────────────────────────────────────────────
// Health check (for docker-compose healthcheck)
// ───────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ───────────────────────────────────────────────────────────────────────────────
// Helper: create GitHub Gist (for large debug logs)
// ───────────────────────────────────────────────────────────────────────────────
async function createGithubGist({ filename, content, description }) {
  if (!GITHUB_TOKEN) {
    throw new Error('GitHub token missing (GITHUB_TOKEN)');
  }

  const url = 'https://api.github.com/gists';
  console.log(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'info',
      msg: 'create_gist_attempt',
      filename,
    })
  );

  const resp = await axios.post(
    url,
    {
      description: description || 'Bug Report Debug Logs',
      public: false,
      files: {
        [filename]: { content },
      },
    },
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
      msg: 'create_gist_success',
      gist_id: resp.data?.id,
      gist_url: resp.data?.html_url,
    })
  );

  return resp.data;
}

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
// Core handler used by both /report and /submit-bug
// ───────────────────────────────────────────────────────────────────────────────
const reportHandler = async (req, res) => {
  try {
    // Extract form fields (multipart) or JSON body
    const body = req.body || {};

    // Log incoming request details
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'info',
        msg: 'bug_report_received',
        content_type: req.headers['content-type'],
        body_keys: Object.keys(body),
        files_count: req.files ? req.files.length : 0,
        files_list: req.files ? req.files.map(f => ({ name: f.fieldname, originalname: f.originalname, size: f.size })) : [],
      })
    );

    // Base fields (always allowed)
    const title = (body.title || '').toString().trim() || 'Unity Bug Report';
    const description = (body.description || '').toString();
    const reporterName = body.reporterName ? String(body.reporterName).trim() : undefined;

    // Optional Unity fields (only included if provided)
    const issueType = body.issueType ? String(body.issueType) : undefined;     // e.g., "bug"
    const screenshotUrl = body.screenshotUrl ? String(body.screenshotUrl) : undefined;
    const systemInfo = body.systemInfo ? String(body.systemInfo) : undefined;
    const userToken = body.userToken ? String(body.userToken) : undefined;

    // Optional uploaded attachment via multipart (declare early so we can use it in labels)
    // With upload.any(), files are in req.files array
    // Separate blueprint and debug log files
    let blueprintFile = null;
    let debugLogFile = null;
    
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (file.originalname.toLowerCase().endsWith('.blueprint')) {
          blueprintFile = file;
        } else if (file.originalname.toLowerCase().endsWith('.txt') || file.originalname.toLowerCase().endsWith('.log')) {
          debugLogFile = file;
        }
      });
    }

    // Log parsed fields
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'info',
        msg: 'bug_report_parsed_fields',
        title_length: title.length,
        description_length: description.length,
        reporter_name: reporterName,
        has_issue_type: Boolean(issueType),
        has_screenshot_url: Boolean(screenshotUrl),
        has_system_info: Boolean(systemInfo),
        has_user_token: Boolean(userToken),
        has_blueprint: Boolean(blueprintFile),
        has_debug_logs: Boolean(debugLogFile),
      })
    );

    // Labels: use provided labels, else fall back to issueType, else 'bug'
    let labels = Array.isArray(body.labels)
      ? body.labels
      : (typeof body.labels === 'string' && body.labels.length > 0 ? [body.labels] : []);
    if ((!labels || labels.length === 0) && issueType) labels = [issueType];
    if (!labels || labels.length === 0) labels = ['bug'];
    
    // Add meta labels for screenshot and attachments
    if (screenshotUrl) labels.push('has-screenshot');
    if (blueprintFile) labels.push('has-blueprint');
    if (debugLogFile) labels.push('has-debug-logs');

    let debugLogsUrl = null;
    let blueprintUrl = null;
    
    // Handle blueprint file
    if (blueprintFile) {
      blueprintUrl = `/uploads/blueprints/${blueprintFile.filename}`;
      
      console.log(
        JSON.stringify({
          t: new Date().toISOString(),
          level: 'info',
          msg: 'blueprint_file_saved',
          filename: blueprintFile.originalname,
          size: blueprintFile.size,
          path: blueprintUrl,
        })
      );
    }
    
    // Handle debug logs file
    if (debugLogFile) {
      try {
        // Read the debug logs file
        const debugContent = fs.readFileSync(debugLogFile.path, 'utf-8');
        
        // Create a Gist for the debug logs
        const gist = await createGithubGist({
          filename: debugLogFile.originalname,
          content: debugContent,
          description: `Debug logs from bug report: ${title}`,
        });
        
        debugLogsUrl = gist.html_url;
        
        console.log(
          JSON.stringify({
            t: new Date().toISOString(),
            level: 'info',
            msg: 'debug_logs_gist_created',
            filename: debugLogFile.originalname,
            gist_url: debugLogsUrl,
          })
        );
      } catch (err) {
        console.error(
          JSON.stringify({
            t: new Date().toISOString(),
            level: 'error',
            msg: 'failed_to_create_gist',
            filename: debugLogFile?.originalname,
            error: err.message,
          })
        );
      }
    }

    // Build the GitHub issue body — NO sensitive metadata
    // Order: Reporter, Description, System Info, Screenshot, Debug Logs
    const mdSections = [];

    if (reporterName) {
      mdSections.push(`**Reported by:** ${reporterName}`);
    }

    if (description) mdSections.push(`### Description\n${description}`);

    if (systemInfo) {
      mdSections.push(`<details>\n<summary><strong>System Info</strong></summary>\n\n\`\`\`\n${systemInfo}\n\`\`\`\n\n</details>`);
    }

    if (screenshotUrl) {
      mdSections.push(`## Screenshot\n\n![Screenshot](${screenshotUrl})`);
    }

    if (blueprintUrl) {
      mdSections.push(`[Download Vessel Blueprint](${blueprintUrl})`);
    }

    if (debugLogsUrl) {
      mdSections.push(`[View debug logs on Gist](${debugLogsUrl})`);
    }

    // We intentionally DO NOT add metadata (IP, UA, etc.) to the issue body.
    // Keep a small internal log line for observability only:
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        level: 'info',
        msg: 'report_received',
        label_hint: issueType || null,
        user_token_present: Boolean(userToken),
        blueprint_present: Boolean(blueprintUrl),
        debug_logs_present: Boolean(debugLogsUrl),
      })
    );

    const issueBody = mdSections.join('\n\n');

    const issue = await createGithubIssue({
      title,
      body: issueBody,
      labels,
    });

    res.json({
      success: true,
      issue_url: issue.html_url,
      issue_number: issue.number,
      // Debug logs are stored as a Gist on GitHub
      debug_logs_url: debugLogsUrl || null,
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
        stack: err?.stack,
      })
    );

    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(400).json({ error: err.message });
    }

    res.status(status).json({ error: 'Failed to create GitHub issue' });
  }
};

// Configure multer to accept text fields + one file
// Using .any() to accept all fields, then we'll parse what we need
const uploadWithFields = upload.any();

// Wire the routes
app.post('/report', uploadWithFields, reportHandler);
app.post('/submit-bug', uploadWithFields, reportHandler); // compat alias for Unity client

// Error handling middleware for multer errors
app.use((err, req, res, next) => {
  console.error(
    JSON.stringify({
      t: new Date().toISOString(),
      level: 'error',
      msg: 'multer_or_request_error',
      error: err.message,
      code: err.code,
      status: err.status || 500,
    })
  );

  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
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
