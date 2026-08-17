#!/usr/bin/env bash
# Deploys the agent orchestrator (scripts/start-orchestrator.ts) to Cloud Run
# as a standalone always-on worker service, separate from the Vercel-hosted
# Next.js app. Secrets are read from Secret Manager, not from env.yaml.
#
# Usage:
#   PROJECT_ID=your-gcp-project REGION=us-central1 ./deploy-orchestrator.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID, e.g. PROJECT_ID=my-project ./deploy-orchestrator.sh}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="ai-layout-orchestrator"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "Building image for project ${PROJECT_ID}..."
gcloud builds submit \
  --project "${PROJECT_ID}" \
  --tag "${IMAGE}" \
  --file Dockerfile.orchestrator \
  .

echo "Deploying ${SERVICE_NAME} to Cloud Run in ${REGION}..."
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --no-allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --cpu 1 \
  --memory 512Mi \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest" \
  --set-secrets "DIRECT_URL=DIRECT_URL:latest" \
  --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest" \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "REDIS_HOST=${REDIS_HOST:?Set REDIS_HOST, e.g. an Upstash endpoint}" \
  --set-env-vars "REDIS_PORT=${REDIS_PORT:-6379}"

echo "Done. This is a background worker, not an HTTP service — no public URL to hit."
