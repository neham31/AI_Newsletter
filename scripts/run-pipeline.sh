#!/bin/bash

# Load environment variables
source .env.local

CRON_SECRET="${CRON_SECRET}"
BASE_URL="https://www.explai.in"

echo "=== AI Newsletter Pipeline ==="
echo ""

# Step 1: Process emails (one at a time to avoid timeout)
echo "Step 1: Processing emails..."
for i in {1..10}; do
  echo "  Processing batch $i..."
  RESULT=$(curl -s -X GET "${BASE_URL}/api/ingest/process-emails?limit=1" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    --max-time 30 2>/dev/null)

  if echo "$RESULT" | grep -q '"processed":0'; then
    echo "  No more emails to process."
    break
  fi
  echo "  $RESULT"
  sleep 2
done

echo ""
echo "Step 2: Sending daily digest..."
RESULT=$(curl -s -X GET "${BASE_URL}/api/digest/send?frequency=daily" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  --max-time 60)
echo "$RESULT"

echo ""
echo "=== Pipeline complete ==="
