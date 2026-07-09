#!/bin/bash

# Wormzone 3D - Deploy to Deno Deploy Script

echo "============================================"
echo "  Deploying Wormzone 3D to Deno Deploy"
echo "============================================"
echo ""

# Check if gh is installed and logged in
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed!"
    echo ""
    echo "Install it first:"
    echo "  type -s curl | bash -s -- https://cli.github.com/sh"
    echo ""
    exit 1
fi

# Check if logged in
if ! gh auth status &>/dev/null; then
    echo "❌ Error: Not logged in to GitHub!"
    echo ""
    echo "Log in first:"
    echo "  gh auth login"
    echo ""
    exit 1
fi

echo "✅ GitHub CLI is installed and you're logged in!"
echo ""

# Get current directory
REPO_DIR=$(pwd)
REPO_NAME="wormzone_3d"

# Check if we're in the right directory
if [ "$(basename $REPO_DIR)" != "$REPO_NAME" ]; then
    echo "⚠️  Warning: Not in wormzone_3d directory"
    echo ""
    read -p "Change to wormzone_3d? (y/n): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        cd ~/wormzone_3d || { echo "Failed to change directory"; exit 1; }
        REPO_DIR=$(pwd)
    fi
fi

echo "📁 Current directory: $REPO_DIR"
echo ""

# Create Deno Deploy configuration
echo "📝 Creating Deno Deploy configuration..."

# Create deploy.json for Deno Deploy
cat > deploy.json << 'EOF'
{
  "name": "wormzone-3d-multiplayer",
  "entrypoint": "multiplayer-server.ts",
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
echo "📤 Pushing changes to GitHub..."
git add -A
git commit -m "Add multiplayer mode with WebSocket support" || {
    echo "⚠️  No changes to commit or commit failed"
}
git push origin main || {
    echo "❌ Failed to push to GitHub"
    exit 1
}

echo "✅ Pushed to GitHub!"
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

# Deploy
read -p "Enter your Deno API token (leave empty to use DENO_API_TOKEN env var): " token

if [ -z "$token" ]; then
    if [ -z "$DENO_API_TOKEN" ]; then
        echo "❌ Error: DENO_API_TOKEN environment variable not set!"
        echo ""
        echo "Set it first:"
        echo "  export DENO_API_TOKEN=your_token_here"
        echo ""
        echo "Get it from: https://dash.deno.com/account#access-tokens"
        exit 1
    else
        token="$DENO_API_TOKEN"
    fi
fi

echo "🚀 Deploying to Deno Deploy..."
echo ""

# Deploy using deno-deploy CLI
denodeploy --token=$token --project=wormzone-3d-multiplayer --entrypoint=multiplayer-server.ts .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment started!"
    echo ""
    echo "🌐 Your game will be accessible at:"
    echo "   https://wormzone-3d-multiplayer.deno.dev"
    echo ""
    echo "⏳ It may take a few minutes to deploy..."
    echo ""
    echo "📊 Monitor deployment at:"
    echo "   https://dash.deno.com/projects/wormzone-3d-multiplayer"
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "Try deploying manually:"
    echo "  1. Go to: https://dash.deno.com/new"
    echo "  2. Select your wormzone_3d repository"
    echo "  3. Set entrypoint to: multiplayer-server.ts"
    echo "  4. Click Deploy"
fi
