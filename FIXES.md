# Bug Fixes and Improvements

## Issue: File Upload Permission Errors (EACCES)

### Problem
The GitLab uploader was returning `HTTP 400 Bad Request` errors. The root cause was:
```
Error: EACCES: permission denied, mkdir '/app/uploads/logs'
```

The Docker container couldn't create subdirectories (`images/`, `logs/`, `blueprints/`, `misc/`) inside `/app/uploads/` when files were uploaded.

### Root Cause
1. The Dockerfile created `/app/uploads` with correct permissions
2. However, `docker-compose.yml` mounts `./uploads:/app/uploads` as a volume
3. This volume mount **replaces** the container's directory with the host directory
4. The mounted host directory didn't have the subdirectories pre-created
5. The container process (running as non-root user `node`) couldn't create them

### Solution
Updated `Dockerfile` to pre-create all required subdirectories:
```dockerfile
RUN mkdir -p uploads/images uploads/logs uploads/blueprints uploads/misc && \
    chown -R node:node /app && \
    chmod -R 777 /app/uploads
```

### To Apply the Fix
Rebuild the Docker image:
```bash
docker compose down
docker compose up -d --build
```

---

## Improvement: Environment Variable Configuration (.env)

### Changes
1. **Created `.env.example`**: Template file with all configuration options
2. **Created `.env`**: Actual configuration file (gitignored)
3. **Updated `docker-compose.yml`**: Now uses `env_file` to load from `.env`
4. **Updated `.gitignore`**: Added `.env` to prevent committing secrets
5. **Updated `README.md`**: Documented `.env` file usage

### Benefits
- ✅ Secrets (tokens) are no longer hardcoded in `docker-compose.yml`
- ✅ `.env` is gitignored - safe to commit the repo without exposing tokens
- ✅ Easy to configure - just copy `.env.example` to `.env` and edit
- ✅ Clean separation of configuration from infrastructure

### How to Use
1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual tokens:
   ```env
   PLATFORM=gitlab
   GITLAB_TOKEN=your_actual_token_here
   GITLAB_URL=https://git.ramshacklegame.com
   GITLAB_PROJECT_ID=mountainous-development/Ramshackle_Issues
   ```

3. Restart the container:
   ```bash
   docker compose down
   docker compose up -d --build
   ```

---

## Next Steps
1. **Rebuild the container** to apply the permission fixes
2. **Configure your `.env` file** with your actual tokens
3. **Test the uploader** from Unity to confirm it's working

The 400 Bad Request error should now be resolved!
