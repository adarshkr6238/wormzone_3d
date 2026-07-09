#!/bin/bash

# Wormzone 3D - Redeploy Multiplayer to Existing Project
# This script redeploys your game with multiplayer support

echo "============================================"
echo "  Redeploying Wormzone 3D Multiplayer"
echo "============================================"
echo ""

# Check current directory
REPO_DIR=$(pwd)
if [ "$(basename $REPO_DIR)" != "wormzone_3d" ]; then
    echo "❌ Error: Not in wormzone_3d directory!"
    echo ""
    echo "Please run this script from wormzone_3d/"
    exit 1
fi

echo "✅ In wormzone_3d directory"
echo ""

# Check if deno-deploy CLI is installed
if ! deno run --quiet https://deno.land/x/deploy/cli.ts --help &>/dev/null; then
    echo "📥 Installing Deno Deploy CLI..."
    deno install --allow-all --name deno-deploy https://deno.land/x/deploy/cli.ts || {
        echo "❌ Failed to install deno-deploy CLI"
        exit 1
    }
fi

echo "✅ Deno Deploy CLI is ready!"
echo ""

# Get token
if [ -z "$DENO_API_TOKEN" ]; then
    # Try to get from deno-server/.env
    if [ -f ../deno-server/.env ]; then
        DENO_API_TOKEN=$(grep DENO_API_TOKEN ../deno-server/.env | cut -d'=' -f2)
        if [ -z "$DENO_API_TOKEN" ]; then
            read -p "Enter your Deno API token: " DENO_API_TOKEN
        fi
    else
        read -p "Enter your Deno API token: " DENO_API_TOKEN
    fi
fi

if [ -z "$DENO_API_TOKEN" ]; then
    echo "❌ Error: DENO_API_TOKEN is required!"
    exit 1
fi

PROJECT_NAME="wormzone-3d"

echo "📦 Preparing deployment..."
echo ""

# Create a temporary deploy configuration
cat > deploy.json << 'EOF'
{
  "entrypoint": "deno-deploy-server.ts",
  "permissions": {
    "net": true,
    "read": true,
    "env": true
  }
}
EOF

echo "✅ Created deploy.json"
echo ""

# Commit and push changes
echo "📤 Pushing latest changes to GitHub..."
git add -A
git commit -m "Update to multiplayer mode with deno-deploy-server.ts" || {
    echo "⚠️  No changes to commit"
}
git push origin main || {
    echo "❌ Failed to push to GitHub"
    exit 1
}

echo "✅ Pushed to GitHub!"
echo ""

# Redeploy using deno-deploy CLI
echo "🚀 Redeploying to Deno Deploy..."
echo ""

denodeploy --token=$DENO_API_TOKEN --project=$PROJECT_NAME --entrypoint=deno-deploy-server.ts .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Redeployment started!"
    echo ""
    echo "🌐 Your multiplayer game will be accessible at:"
    echo "   https://$PROJECT_NAME.adarshkr.deno.net/multiplayer.html"
    echo ""
    echo "⏳ It may take a few minutes to redeploy..."
    echo ""
    echo "📊 Monitor deployment at:"
    echo "   https://dash.deno.com/projects/$PROJECT_NAME"
    echo ""
    echo "🎮 Once deployed, visit:"
    echo "   https://$PROJECT_NAME.adarshkr.deno.net/multiplayer.html"
    echo ""
    echo "💡 To test if it's working:"
    echo "   curl -I https://$PROJECT_NAME.adarshkr.deno.net/multiplayer.html"
else
    echo ""
    echo "❌ Redeployment failed!"
    echo ""
    echo "Try these alternatives:"
    echo ""
    echo "1. Redeploy via dashboard:"
    echo "   - Go to: https://dash.deno.com/projects/$PROJECT_NAME"
    echo "   - Click 'Redeploy'"
    echo ""
    echo "2. Change entrypoint in dashboard:"
    echo "   - Go to project settings"
    echo "   - Set entrypoint to: deno-deploy-server.ts"
    echo "   - Click 'Redeploy'"
fi

# Clean up
rm -f deploy.json
