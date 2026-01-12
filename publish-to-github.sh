#!/bin/bash

# Quick script to publish Xantuus AI to GitHub
# This will initialize git, commit all files, and push to GitHub

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📦 Publishing Xantuus AI to GitHub${NC}"
echo ""

# Get GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

# Get repository name (default: xantuus-ai)
read -p "Enter repository name (default: xantuus-ai): " REPO_NAME
REPO_NAME=${REPO_NAME:-xantuus-ai}

echo ""
echo -e "${YELLOW}⚠️  Before continuing, please:${NC}"
echo "1. Create a new repository on GitHub: https://github.com/new"
echo "2. Name it: $REPO_NAME"
echo "3. DO NOT initialize with README, .gitignore, or license"
echo ""
read -p "Press Enter when you've created the repository..."

# Check if git is already initialized
if [ ! -d ".git" ]; then
    echo -e "${BLUE}🔧 Initializing Git repository...${NC}"
    git init
else
    echo -e "${GREEN}✓ Git repository already initialized${NC}"
fi

# Add all files
echo -e "${BLUE}📝 Adding files to git...${NC}"
git add .

# Create initial commit
echo -e "${BLUE}💾 Creating initial commit...${NC}"
git commit -m "Initial commit - Xantuus AI Platform with Prompt Templates" || echo "Files already committed"

# Rename branch to main if needed
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${BLUE}🔀 Renaming branch to main...${NC}"
    git branch -M main
fi

# Add remote
REMOTE_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"
echo -e "${BLUE}🔗 Adding remote: $REMOTE_URL${NC}"
git remote add origin $REMOTE_URL 2>/dev/null || git remote set-url origin $REMOTE_URL

# Push to GitHub
echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
git push -u origin main

echo ""
echo -e "${GREEN}✅ Success! Your code is now on GitHub!${NC}"
echo -e "${BLUE}🔗 Repository: https://github.com/$GITHUB_USERNAME/$REPO_NAME${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Set up GitHub Secrets for CI/CD deployment (if using GitHub Actions)"
echo "2. Configure Google Cloud Platform for deployment"
echo "3. See DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
