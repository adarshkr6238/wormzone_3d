#!/bin/bash

# Wormzone 3D - Deployment Script
# Deploy to Deno Deploy using the API server

echo "🚀 Deploying Wormzone 3D to Deno Deploy..."
echo ""

# Check if DENO_API_TOKEN is set
if [ -z "$DENO_API_TOKEN" ]; then
    echo "❌ Error: DENO_API_TOKEN not found!"
    echo ""
    echo "Set it first:"
    echo "  export DENO_API_TOKEN=your_token_here"
    echo ""
    echo "Or get it from: https://dash.deno.com/account#access-tokens"
    exit 1
fi

# Check if our API server is running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "⚠️  Warning: Local API server not running on port 8000"
    echo ""
    echo "Start it first:"
    echo "  cd ../deno-server && deno task dev"
    echo ""
    echo "Or deploy directly via Deno Deploy dashboard:"
    echo "  https://dash.deno.com/new"
    exit 1
fi

echo "✅ API server is running!"
echo ""

# Get or create app ID
APP_SLUG="wormzone-3d"
APP_RESPONSE=$(curl -s http://localhost:8000/api/apps | jq -r ".items[] | select(.slug == \"$APP_SLUG\") | .id")

if [ -z "$APP_RESPONSE" ] || [ "$APP_RESPONSE" = "null" ]; then
    echo "🆕 Creating new app: $APP_SLUG"
    APP_RESPONSE=$(curl -s -X POST http://localhost:8000/api/apps \
        -H "Content-Type: application/json" \
        -d "{\"slug\": \"$APP_SLUG\", \"labels\": {\"game\": \"snake-3d\", \"type\": \"wormzone\"}}")
    APP_ID=$(echo "$APP_RESPONSE" | jq -r '.id')
    echo "✅ App created: $APP_ID"
else
    APP_ID="$APP_RESPONSE"
    echo "✅ Using existing app: $APP_ID"
fi

echo ""
echo "📦 Deploying code from local directory..."
echo ""

# Deploy the app
DEPLOY_RESPONSE=$(curl -s -X POST http://localhost:8000/api/apps/$APP_SLUG/deploy \
    -H "Content-Type: application/json" \
    -d "{\"git_repository\": \"https://github.com/adarshkr6238/wormzone_3d\", \"git_branch\": \"main\"}")

REVISION_ID=$(echo "$DEPLOY_RESPONSE" | jq -r '.id')

echo "✅ Deployment started!"
echo ""
echo "📋 Deployment Details:"
echo "   App ID:     $APP_ID"
echo "   App Slug:   $APP_SLUG"
echo "   Revision:   $REVISION_ID"
echo ""
echo "🌐 Your game will be available at:"
echo "   https://$APP_SLUG.deno.dev"
echo ""
echo "⏳ Checking deployment status..."
echo ""

# Wait a bit and check status
sleep 3

PROGRESS=$(curl -s http://localhost:8000/api/revisions/$REVISION_ID/progress 2>/dev/null | jq -r '.status // .state')
echo "   Status: $PROGRESS"

echo ""
echo "🎮 Once deployed, visit: https://$APP_SLUG.deno.dev"
