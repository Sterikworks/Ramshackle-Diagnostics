# Ramshackle Bug Reporter

Docker-based bug reporting service that accepts bug reports from the Unity game and creates GitHub issues automatically.

## Features

- Accepts bug reports via REST API
- Uploads .vessel files (max 5MB)
- Creates GitHub issues with labels, screenshots, and system info
- Containerized with Docker for easy deployment

## Prerequisites

- Docker and Docker Compose installed
- GitHub Personal Access Token with `repo` scope

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd Ramshackle-Diagnostics
   ```

2. **Configure your GitHub token**

   Edit `docker-compose.yml` and replace the placeholder with your actual GitHub Personal Access Token (needs `repo` scope):
   ```yaml
   - GITHUB_TOKEN=your_github_token_here              # <- Replace this value
   ```

3. **Build and run**
   ```bash
   docker-compose up -d
   ```

4. **Check status**
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
   nano docker-compose.yml  # Edit GITHUB_TOKEN value
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
  "systemInfo": "OS: Windows\nGame Version: 1.0.0",
  "userToken": "user-identifier",
  "vesselFileUrl": "https://..."
}
```

## File Structure

```
.
├── Dockerfile              # Container definition
├── docker-compose.yml      # Docker Compose config (edit GITHUB_TOKEN here)
├── package.json           # Node.js dependencies
├── server.js              # Main application
└── uploads/               # Uploaded files (persisted)
```

## Ports

- Default: `5000` (configurable in docker-compose.yml)

## Volumes

- `./uploads` - Persisted uploaded .vessel files

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
Verify your `GITHUB_TOKEN` in `docker-compose.yml` has `repo` scope and is valid.

## License

ISC
