# GitLab Support - Setup Instructions

## ✅ GitLab Support Successfully Added!

Your bug reporter proxy now supports both GitHub and GitLab platforms!

## What Changed

### 1. **docker-compose.yml**
- Added `PLATFORM` environment variable (set to `gitlab`)
- Added GitLab configuration variables:
  - `GITLAB_TOKEN` - Your GitLab Personal Access Token
  - `GITLAB_URL` - Your GitLab instance URL (https://git.ramshacklegame.com)
  - `GITLAB_PROJECT_ID` - Your project path (mountainous-development/Ramshackle_Issues)

### 2. **server.js**
- Added full GitLab API support
- Platform auto-detection based on `PLATFORM` env var
- GitLab-specific functions:
  - `createGitlabIssue()` - Creates issues in GitLab
  - `uploadBlueprintToGitlab()` - Uploads blueprints to GitLab repo
  - `createGitlabSnippet()` - Creates private snippets for debug logs
  - `updateGitlabIssue()` - Updates issues with blueprint links

### 3. **README.md**
- Comprehensive documentation for both platforms
- Configuration examples
- Platform comparison table
- Troubleshooting guide

## Next Steps

### 1. Get Your GitLab Token

1. Go to: https://git.ramshacklegame.com
2. Click your avatar → **Settings** → **Access Tokens**
3. Create a new token:
   - **Name**: `Bug Reporter`
   - **Scopes**: ✅ `api`
   - **Expiration**: Your preference (or none)
4. Click **Create personal access token**
5. **Copy the token** (you won't see it again!)

### 2. Update docker-compose.yml

Replace `your_gitlab_token_here` on line 19 with your actual token:

```yaml
- GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx  # Paste your token here
```

### 3. Deploy

```bash
cd "l:\Y\Misc Git Repos\Ramshackle-Diagnostics"
docker-compose down
docker-compose up -d --build
```

### 4. Test the Service

```bash
# Check the logs
docker-compose logs -f

# You should see:
# {"level":"info","msg":"platform_configured","platform":"gitlab"}
```

## How It Works

When a bug report is submitted:

1. **Issue Creation**: Creates a GitLab issue in `mountainous-development/Ramshackle_Issues`
2. **Labels**: Adds labels like `bug`, `has-screenshot`, `has-blueprint`, etc.
3. **Debug Logs**: Uploads as a private GitLab Snippet
4. **Blueprints**: Commits to the `blueprints/` folder in your repo
5. **Updates Issue**: Adds blueprint download link to the issue

## API Differences

| Action | GitHub API | GitLab API |
|--------|-----------|------------|
| Authentication | `Authorization: token xxx` | `PRIVATE-TOKEN: xxx` |
| Issue Body | `body` | `description` |
| Issue ID | `number` | `iid` |
| Debug Storage | Gist | Snippet |
| File Upload | PUT `/contents/:path` | POST `/repository/files/:path` |

## Files Created/Modified

- ✅ `server.js` - Updated with GitLab support
- ✅ `docker-compose.yml` - Added GitLab env vars
- ✅ `README.md` - Full documentation
- 📦 `server_github_only_backup.js` - Backup of GitHub-only version

## Troubleshooting

### "GitLab configuration missing"
Make sure all three GitLab env vars are set in docker-compose.yml

### "Failed to create GitLab issue"
- Check your token has `api` scope
- Verify the project path is correct (visible in GitLab project settings)
- Ensure the GitLab URL is accessible from the container

### Blueprint upload fails
- Make sure you have `Developer` or `Maintainer` role in the project
- Check that the `main` branch exists (or change the branch name in server.js)

### Snippet creation fails
- Verify project-level snippets are enabled in your GitLab project settings

## Ready to Go! 🚀

Your proxy is now configured for GitLab. Just add your token and restart the service!
