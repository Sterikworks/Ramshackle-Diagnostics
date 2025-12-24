#!/bin/bash
# Update script for Ramshackle Bug Reporter
# This script stops the container, updates from git, rebuilds, and restarts

set -e  # Exit on any error

echo "🛑 Stopping containers..."
docker compose down

echo "📦 Stashing local changes..."
git stash

echo "🔄 Resetting to HEAD..."
git reset --hard

echo "⬇️  Pulling latest changes..."
git pull

echo "🔨 Building Docker image..."
docker compose build

echo "� Creating upload subdirectories..."
mkdir -p uploads/images uploads/logs uploads/blueprints uploads/misc
chmod -R 777 uploads/

echo "�🚀 Starting containers..."
docker compose up -d

echo "✅ Update complete!"
echo "📋 View logs with: docker compose logs -f"
