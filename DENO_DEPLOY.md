# Wormzone 3D - Deno Deploy Guide

Deploy your 3D Snake game to Deno Deploy!

## Quick Start

### Option 1: Deploy via Deno Deploy Dashboard (Easiest)

1. Go to: [https://dash.deno.com/new](https://dash.deno.com/new)
2. Click "GitHub" and select your repository: `adarshkr6238/wormzone_3d`
3. Click "Link Repository"
4. Click "Deploy"
5. Your game will be live at: `https://wormzone-3d.deno.dev`

### Option 2: Deploy via API (Using our local server)

```bash
# 1. Start our Deno API server (in another terminal)
cd ../deno-server
deno task dev

# 2. Run the deploy script
cd wormzone_3d
./deploy.sh
```

### Option 3: Deploy with Deno CLI

```bash
# Install Deno Deploy CLI
deno install --allow-all --name deno-deploy https://deno.land/x/deploy/cli.ts

# Deploy
denodeploy --project=wormzone-3d --token=$DENO_API_TOKEN
```

## Project Structure

```
wormzone_3d/
├── deno-server.ts      # Deno static file server (replaces server.js)
├── deno.json           # Deno configuration
├── deploy.sh           # Deployment script
├── package.json        # Original Node.js config
├── server.js           # Original Node.js server
└── public/             # Game files
    ├── index.html      # Game HTML
    └── game.js         # Game logic (Three.js)
```

## Running Locally with Deno

### Start the Deno server:

```bash
# Development mode (auto-reload)
deno task dev

# Production mode
deno task start

# Or manually
deno run --allow-net --allow-read deno-server.ts
```

Then open: [http://localhost:3000](http://localhost:3000)

## Converting from Node.js to Deno

Your original project uses:
- **Node.js** with Express
- **CommonJS** modules

The Deno version uses:
- **Deno runtime** (no Node.js)
- **ES Modules** (native)
- **std/http/file_server** (built-in)

### Key Differences:

| Feature | Node.js (Original) | Deno (New) |
|---------|-------------------|-------------|
| Runtime | Node.js | Deno |
| Framework | Express | std/http |
| Modules | CommonJS | ES Modules |
| Package Manager | npm | None (built-in) |
| Performance | Good | Better on Deno Deploy |

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. Link your GitHub account in Deno Deploy dashboard
2. Select the `wormzone_3d` repository
3. Deploy the `main` branch
4. Automatic redeploys on push!

### Method 2: Manual Upload

1. Zip your project (excluding node_modules)
2. Upload to Deno Deploy dashboard
3. Deploy manually

### Method 3: API Deployment

Use our Deno API server:

```bash
# Create an app
curl -X POST http://localhost:8000/api/apps \
  -H "Content-Type: application/json" \
  -d '{"slug": "wormzone-3d", "labels": {"game": "snake"}}'

# Deploy from GitHub
curl -X POST http://localhost:8000/api/apps/wormzone-3d/deploy \
  -H "Content-Type: application/json" \
  -d '{"git_repository": "https://github.com/adarshkr6238/wormzone_3d", "git_branch": "main"}'
```

## Custom Domain

Once deployed, you can add a custom domain:

1. Go to Deno Deploy dashboard
2. Select your project
3. Click "Settings" > "Domains"
4. Add your domain (e.g., `wormzone.yourdomain.com`)

## Environment Variables

Your Deno server supports:
- `PORT` - Server port (default: 3000)

Set them in Deno Deploy dashboard under "Settings" > "Environment Variables"

## Monitoring

### View Logs

```bash
# Via our API server
curl http://localhost:8000/api/apps/wormzone-3d/logs

# Or via Deno Deploy dashboard
# Go to: https://dash.deno.com/projects/wormzone-3d/logs
```

### View Analytics

```bash
curl http://localhost:8000/api/apps/wormzone-3d/analytics
```

## Troubleshooting

### "Module not found" errors
Make sure you're using ES Modules import syntax:
```javascript
import { serveDir } from "https://deno.land/std/http/file_server.ts";
```

### CORS issues
The static server serves files with proper CORS headers by default.

### Deployment stuck
- Check the logs in Deno Deploy dashboard
- Make sure your `deno.json` has the correct permissions
- Try redeploying

## Performance Tips

1. **Use Deno natively** - The `deno-server.ts` is optimized for Deno Deploy
2. **Enable caching** - Deno Deploy has built-in CDN caching
3. **Minimize dependencies** - Deno works best with ES Modules from deno.land
4. **Use static files** - For a game like this, static hosting is very efficient

## Next Steps

1. ✅ Clone your repo
2. ✅ Create Deno server file
3. ⏳ Deploy to Deno Deploy
4. 🎮 Share your game with the world!

## Links

- [Deno Deploy Dashboard](https://dash.deno.com)
- [Deno Documentation](https://docs.deno.com)
- [Deno Deploy Docs](https://docs.deno.com/deploy)
- [Three.js Documentation](https://threejs.org/docs)

---

**Your Wormzone 3D game is ready for Deno Deploy!** 🎮
