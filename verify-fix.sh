#!/bin/bash

echo "=== Testing Database Connection Status Fix ==="
echo ""

# Test 1: Check public status endpoint
echo "1. Testing /api/admin/status (public endpoint):"
BASE_URL=${BASE_URL:-http://localhost/scheduler}
RESPONSE=$(curl -s "$BASE_URL/api/admin/status")
echo "Response: $RESPONSE"
DB_CONNECTED=$(echo $RESPONSE | grep -o '"database_connected":true')
if [ ! -z "$DB_CONNECTED" ]; then
    echo "✅ Status endpoint shows database_connected: true"
else
    echo "❌ Status endpoint does NOT show database connected"
fi
echo ""

# Test 2: Check settings endpoint (requires auth)
echo "2. Testing /api/admin/settings (authenticated endpoint):"
RESPONSE=$(curl -s "$BASE_URL/api/admin/settings")
echo "Response: $RESPONSE"
DB_CONNECTED=$(echo $RESPONSE | grep -o '"database_connected":true')
if [ ! -z "$DB_CONNECTED" ]; then
    echo "✅ Settings endpoint shows database_connected: true"
else
    echo "❌ Settings endpoint does NOT show database connected"
fi
echo ""

# Final verdict
echo "=== FINAL RESULT ==="
if [ ! -z "$DB_CONNECTED" ]; then
    echo "✅ SUCCESS: Database shows as connected."
else
    echo "❌ FAILURE: Database not connected."
fi
