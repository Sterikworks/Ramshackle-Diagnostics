# Ramshackle Bug Reporter

Docker-based bug reporting service that accepts bug reports from the Unity game and creates GitHub or GitLab issues automatically.

## Features

- Accepts bug reports via REST API
- **Multi-Platform Support**: Works with GitHub or GitLab (including self-hosted GitLab)
- Uploads .vessel files (max 100MB)
- Creates issues with labels, screenshots, and system info
- Stores debug logs in Gists (GitHub) or Snippets (GitLab)
- Containerized with Docker for easy deployment

## Prerequisites

- Docker and Docker Compose installed
- **GitHub**: Personal Access Token with `repo` scope
- **GitLab**: Personal Access Token with `api` scope

## Quick Start

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd Ramshackle-Diagnostics
```

### 2. Configure Your Platform

Edit `docker-compose.yml` and choose your platform:

#### For GitLab (Default)
```yaml
environment:
  - PLATFORM=gitlab
  - GITLAB_TOKEN=your_gitlab_token_here
  - GITLAB_URL=https://git.ramshacklegame.com
  - GITLAB_PROJECT_ID=mountainous-development/Ramshackle_Issues
```

**To create a GitLab Personal Access Token:**
1. Go to your GitLab instance (e.g., `https://git.ramshacklegame.com`)
2. Navigate to **Settings → Access Tokens**
3. Create a token with `api` scope
4. Copy the token and paste it as `GITLAB_TOKEN`

#### For GitHub
```yaml
environment:
  - PLATFORM=github
  - GITHUB_TOKEN=your_github_token_here
  - GITHUB_REPO=Sterikworks/Ramshackle_Issues
```

**To create a GitHub Personal Access Token:**
1. Go to https://github.com/settings/tokens
2. Create a token with `repo` scope
3. Copy the token and paste it as `GITHUB_TOKEN`

### 3. Build and run
```bash
docker-compose up -d
```

### 4. Check status
```bash
docker-compose ps
docker-compose logs -f
```

## Deployment

### VPS Deployment

1. SSH into your VPS:
   ```bash
   ssh user@your-vps-ip
   ```

2. Clone and configure:
   ```bash
   git clone <your-repo-url>
   cd Ramshackle-Diagnostics
   nano docker-compose.yml  # Edit platform settings
   ```

3. Start the service:
   ```bash
   docker-compose up -d
   ```

### Updating

To update the service:

```bash
cd Ramshackle-Diagnostics
git pull
docker-compose down
docker-compose up -d --build
```

## API Endpoints

### Health Check
```
GET /health
```

### Upload Vessel File
```
POST /upload-vessel
Content-Type: multipart/form-data

Form field: vessel (file)
```

### Submit Bug Report
```
POST /submit-bug
Content-Type: application/json

{
  "title": "Bug title",
  "description": "Bug description",
  "issueType": "bug",
  "screenshotUrl": "https://...",
  "systemInfo": "OS: Windows\\nGame Version: 1.0.0",
  "userToken": "user-identifier",
  "vesselFileUrl": "https://..."
}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLATFORM` | No | Platform to use: `github` or `gitlab` (default: `github`) |
| `GITHUB_TOKEN` | For GitHub | GitHub Personal Access Token (needs `repo` scope) |
| `GITHUB_REPO` | For GitHub | GitHub repository in format `owner/repo` |
| `GITLAB_TOKEN` | For GitLab | GitLab Personal Access Token (needs `api` scope) |
| `GITLAB_URL` | For GitLab | GitLab instance URL (e.g., `https://git.ramshacklegame.com`) |
| `GITLAB_PROJECT_ID` | For GitLab | Project path in format `namespace/project` |

### Platform Differences

| Feature | GitHub | GitLab |
|---------|--------|--------|
| Issue Creation | ✅ | ✅ |
| Blueprint Upload | ✅ Committed to repo | ✅ Committed to repo |
| Debug Logs | 📝 Gist (private) | 📝 Snippet (private) |
| Labels | ✅ | ✅ |
| Screenshots | ✅ Via URL | ✅ Via URL |

## File Structure

```
.
├── Dockerfile                    # Container definition
├── docker-compose.yml            # Docker Compose config (configure platform here)
├── package.json                  # Node.js dependencies
├── server.js                     # Main application (supports GitHub & GitLab)
├── server_github_only_backup.js  # Original GitHub-only version
└── uploads/                      # Uploaded files (persisted)
```

## Ports

- Default: `5000` (configurable in docker-compose.yml)

## Volumes

- `./uploads` - Persisted uploaded .vessel files, debug logs, and screenshots

## Troubleshooting

**Container won't start:**
```bash
docker-compose logs
```

**Port already in use:**
Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "3000:5000"  # Change 3000 to your desired port
```

**GitHub API errors:**
- Verify your `GITHUB_TOKEN` in `docker-compose.yml` has `repo` scope
- Check that `GITHUB_REPO` is in the correct format (`owner/repo`)

**GitLab API errors:**
- Verify your `GITLAB_TOKEN` has `api` scope
- Check that `GITLAB_URL` doesn't have a trailing slash
- Verify `GITLAB_PROJECT_ID` is the correct project path (visible in your GitLab project)
- For self-hosted GitLab, ensure the URL is accessible from the Docker container

**Platform not switching:**
Make sure you restart the container after changing `PLATFORM`:
```bash
docker-compose down
docker-compose up -d
```

## License

it's a fucking javascript web server who cares
