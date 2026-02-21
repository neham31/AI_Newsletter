#!/bin/bash

# ============================================
# Newsletter Pipeline Verification Script
# ============================================
# This script tests each stage of the newsletter pipeline
# Usage: ./scripts/verify-pipeline.sh
# Requires: CRON_SECRET environment variable or .env.local file

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    # Only load specific variables we need (avoid issues with spaces in values)
    NEXT_PUBLIC_APP_URL=$(grep '^NEXT_PUBLIC_APP_URL=' .env.local | cut -d'=' -f2-)
    CRON_SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d'=' -f2-)
    NEXT_PUBLIC_SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d'=' -f2-)
    SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d'=' -f2-)
fi

# Configuration
BASE_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"

if [ -z "$CRON_SECRET" ]; then
    echo -e "${RED}Error: CRON_SECRET not set${NC}"
    echo "Set it in .env.local or export CRON_SECRET=your-secret"
    exit 1
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Newsletter Pipeline Verification${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Base URL: ${BASE_URL}"
echo ""

# Function to make authenticated requests
call_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3

    echo -e "${YELLOW}► ${description}${NC}"
    echo -e "  Calling: ${method} ${endpoint}"

    response=$(curl -s -L -w "\n%{http_code}" -X "${method}" "${BASE_URL}${endpoint}" \
        -H "Authorization: Bearer ${CRON_SECRET}" \
        -H "Content-Type: application/json")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✓ Status: ${http_code}${NC}"
        echo -e "  Response: ${body}"
    else
        echo -e "  ${RED}✗ Status: ${http_code}${NC}"
        echo -e "  Response: ${body}"
    fi
    echo ""
}

# ============================================
# Stage 1: Test RSS Feed Ingestion
# ============================================
echo -e "${BLUE}──────────────────────────────────────────${NC}"
echo -e "${BLUE}Stage 1: RSS Feed Ingestion${NC}"
echo -e "${BLUE}──────────────────────────────────────────${NC}"
call_endpoint "POST" "/api/ingest/rss" "Polling RSS feeds for blog articles"

# ============================================
# Stage 2: Test Email Processing
# ============================================
echo -e "${BLUE}──────────────────────────────────────────${NC}"
echo -e "${BLUE}Stage 2: Email Processing${NC}"
echo -e "${BLUE}──────────────────────────────────────────${NC}"
call_endpoint "POST" "/api/ingest/process-emails" "Processing queued newsletter emails"

# ============================================
# Stage 3: Check Articles Status
# ============================================
echo -e "${BLUE}──────────────────────────────────────────${NC}"
echo -e "${BLUE}Stage 3: Articles Status${NC}"
echo -e "${BLUE}──────────────────────────────────────────${NC}"

# Query Supabase directly if we have the credentials
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}► Checking articles in database${NC}"

    # Count total articles
    articles_response=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles?select=id&limit=1" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Prefer: count=exact" \
        -w "\n%{http_code}")

    http_code=$(echo "$articles_response" | tail -n1)

    if [ "$http_code" -eq 200 ]; then
        # Extract count from content-range header
        count_response=$(curl -s -I "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles?select=id" \
            -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
            -H "Prefer: count=exact" | grep -i "content-range" | sed 's/.*\///' | tr -d '\r')
        echo -e "  ${GREEN}✓ Total articles in database: ${count_response:-0}${NC}"
    else
        echo -e "  ${RED}✗ Failed to query articles${NC}"
    fi

    # Count raw_emails pending processing
    echo -e "${YELLOW}► Checking pending raw_emails${NC}"
    pending_response=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/raw_emails?processed=eq.false&select=id" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Prefer: count=exact" \
        -w "\n%{http_code}")

    http_code=$(echo "$pending_response" | tail -n1)
    body=$(echo "$pending_response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        count=$(echo "$body" | grep -o '\[.*\]' | tr -cd ',' | wc -c)
        count=$((count + 1))
        if [ "$body" = "[]" ]; then
            count=0
        fi
        echo -e "  ${GREEN}✓ Pending emails to process: ${count}${NC}"
    else
        echo -e "  ${RED}✗ Failed to query raw_emails${NC}"
    fi

    # Check ingestion log for recent activity
    echo -e "${YELLOW}► Checking recent ingestion activity${NC}"
    log_response=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ingestion_log?select=type,created_at&order=created_at.desc&limit=5" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

    if [ -n "$log_response" ] && [ "$log_response" != "[]" ]; then
        echo -e "  ${GREEN}✓ Recent ingestion log entries:${NC}"
        echo "$log_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for entry in data:
        print(f\"    - {entry.get('type', 'unknown')} at {entry.get('created_at', 'unknown')}\")
except:
    print('    (Could not parse response)')
" 2>/dev/null || echo "    $log_response"
    else
        echo -e "  ${YELLOW}⚠ No recent ingestion activity${NC}"
    fi

    # Check user count
    echo -e "${YELLOW}► Checking active verified users${NC}"
    users_response=$(curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?is_active=eq.true&email_verified=eq.true&select=id,email,frequency" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

    if [ -n "$users_response" ] && [ "$users_response" != "[]" ]; then
        echo -e "  ${GREEN}✓ Active verified users:${NC}"
        echo "$users_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for user in data:
        print(f\"    - {user.get('email', 'unknown')} ({user.get('frequency', 'unknown')})\")
except:
    print('    (Could not parse response)')
" 2>/dev/null || echo "    $users_response"
    else
        echo -e "  ${RED}✗ No active verified users found${NC}"
    fi

    echo ""
else
    echo -e "${YELLOW}⚠ Supabase credentials not found, skipping database checks${NC}"
    echo ""
fi

# ============================================
# Stage 4: Test Digest Sending
# ============================================
echo -e "${BLUE}──────────────────────────────────────────${NC}"
echo -e "${BLUE}Stage 4: Digest Sending${NC}"
echo -e "${BLUE}──────────────────────────────────────────${NC}"
call_endpoint "POST" "/api/digest/send?frequency=daily" "Sending daily digest to eligible users"

# ============================================
# Summary
# ============================================
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Verification Complete${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "If no articles exist yet, you may need to:"
echo "  1. Wait for newsletter emails to arrive in Resend"
echo "  2. Wait for RSS feeds to have new content"
echo "  3. Run this script again after content arrives"
echo ""
echo "Check Vercel logs for detailed error messages:"
echo "  vercel logs --follow"
echo ""
