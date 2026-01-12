#!/bin/bash

# Vercel Environment Setup Script
# This script helps you set all environment variables in Vercel

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Setting up Vercel Environment Variables${NC}"
echo ""

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${YELLOW}This will set environment variables for Production, Preview, and Development${NC}"
echo ""
read -p "Press Enter to continue..."
echo ""

# Function to add env var
add_env() {
    local name=$1
    local value=$2
    echo -e "${BLUE}Adding $name...${NC}"
    echo "$value" | vercel env add "$name" production preview development
}

echo -e "${GREEN}Setting Database URLs...${NC}"
add_env "DATABASE_URL" "postgresql://postgres.oydugfovufqzmicgunun:Da013093%21Ba040617@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
add_env "DIRECT_URL" "postgresql://postgres.oydugfovufqzmicgunun:Da013093%21Ba040617@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

echo -e "${GREEN}Setting Auth Configuration...${NC}"
read -p "Enter NEXTAUTH_SECRET (or press Enter to generate): " nextauth_secret
if [ -z "$nextauth_secret" ]; then
  nextauth_secret=$(openssl rand -base64 32)
  echo "Generated: $nextauth_secret"
fi
add_env "NEXTAUTH_SECRET" "$nextauth_secret"

echo -e "${GREEN}Setting Google OAuth...${NC}"
read -p "Enter GOOGLE_CLIENT_ID: " google_client_id
add_env "GOOGLE_CLIENT_ID" "$google_client_id"
read -p "Enter GOOGLE_CLIENT_SECRET: " google_client_secret
add_env "GOOGLE_CLIENT_SECRET" "$google_client_secret"

echo -e "${GREEN}Setting Anthropic API Key...${NC}"
read -p "Enter ANTHROPIC_API_KEY: " anthropic_key
add_env "ANTHROPIC_API_KEY" "$anthropic_key"

echo -e "${GREEN}Setting Admin Email...${NC}"
add_env "ADMIN_EMAIL" "david.archie@me.com"

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: After first deployment, add NEXTAUTH_URL${NC}"
echo -e "${BLUE}Run: vercel env add NEXTAUTH_URL${NC}"
echo -e "${BLUE}Value: https://your-app-name.vercel.app${NC}"
echo ""

echo -e "${GREEN}✅ Environment variables configured!${NC}"
echo -e "${BLUE}Now run: vercel --prod${NC}"
