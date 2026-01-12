#!/bin/bash

# Xantuus AI - Cloud Run Deployment Script
# This script builds and deploys the application to Google Cloud Run

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Deploying Xantuus AI to Cloud Run...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed. Please install it from https://cloud.google.com/sdk/docs/install${NC}"
    exit 1
fi

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"xantuus-ai-prod"}
SERVICE_NAME=${SERVICE_NAME:-"xantuus-ai"}
REGION=${REGION:-"us-central1"}
ENV_FILE=${ENV_FILE:-"env.yaml"}

# Check if env.yaml exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file '$ENV_FILE' not found!${NC}"
    echo -e "${BLUE}Please create $ENV_FILE with your environment variables.${NC}"
    echo -e "${BLUE}See env.yaml.example for reference.${NC}"
    exit 1
fi

# Set project
echo -e "${BLUE}📦 Setting project to: $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Build and deploy
echo -e "${BLUE}🔨 Building and deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --env-vars-file $ENV_FILE \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0

# Get deployment URL
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}🌐 Your app is live at:${NC}"
gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)'

echo -e "${GREEN}✨ Done!${NC}"
