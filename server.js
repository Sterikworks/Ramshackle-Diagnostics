require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Express setup
const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// GitHub config
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = 'Sterikworks/Ramshackle_Issues';

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup for .vessel file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.vessel') return cb(new Error('Only .vessel files allowed'));
    cb(null, true);
  },
});

// --- Route: Health Check ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- Route: Upload .vessel file ---
app.post('/upload-vessel', upload.single('vessel'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});

// --- Route: Submit Bug Report ---
app.post('/submit-bug', async (req, res) => {
  const { title, description, issueType, screenshotUrl, systemInfo, userToken, vesselFileUrl } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description required.' });
  }

  let body = `${description}\n\n## Screenshot\n\n`;
  body += screenshotUrl ? `![Screenshot](${screenshotUrl})\n\n` : "[No screenshot provided]\n\n";

  if (vesselFileUrl) {
    body += `## Vessel File\n[Download .vessel](${vesselFileUrl})\n\n`;
  }

  if (systemInfo) {
    body += `<details>\n<summary>System Info</summary>\n\n\`\`\`\n${systemInfo}\n\`\`\`\n</details>\n\n`;
  }

  body += `---\n**Submitted by:** ${userToken || "Anonymous"}`;

  const labels = [issueType?.toLowerCase() || 'unclassified'];
  const versionMatch = systemInfo?.match(/Game Version:?\s*([0-9\.]+)/i);
  if (versionMatch) labels.push(`v${versionMatch[1]}`);
  if (screenshotUrl) labels.push("has-screenshot");
  if (vesselFileUrl) labels.push("has-vessel");

  try {
    const githubRes = await axios.post(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      { title, body, labels },
      { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'UnityBugReporter' } }
    );
    res.json({ success: true, issue_url: githubRes.data.html_url });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create GitHub issue' });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
