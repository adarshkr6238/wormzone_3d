# Wormzone 3D - Complete Deployment Guide

Deploy your multiplayer Wormzone 3D game to **Deno Deploy** so anyone can play!

## Quick Deployment (5 minutes)

### Method 1: Using GitHub Integration (Recommended)

1. **Push your code to GitHub** (already done!)
   ```bash
   cd wormzone_3d
   git add -A
   git commit -m "Add multiplayer mode"
   git push origin main
   ```

2. **Go to Deno Deploy Dashboard**
   - Visit: [https://dash.deno.com/new](https://dash.deno.com/new)
   
3. **Create New Project**
   - Click "GitHub" icon
   - Select your repository: `adarshkr6238/wormzone_3d`
   - Click "Link Repository"
   
4. **Configure Project**
   - **Entrypoint**: `deno-deploy-server.ts`
   - **Permissions**: All (net, read, env)
   - Click "Deploy"

5. **Your game is live!** 🎉
   - URL: `https://<project-name>.deno.dev`
   - Share with friends!

---

### Method 2: Using Deno Deploy CLI

1. **Install Deno Deploy CLI**
   ```bash
   deno install --allow-all --name deno-deploy https://deno.land/x/deploy/cli.ts
   ```

2. **Deploy from local directory**
   ```bash
   cd wormzone_3d
   deno-deploy --token=$DENO_API_TOKEN --project=wormzone-3d-multiplayer --entrypoint=deno-deploy-server.ts .
   ```

3. **Access your game**
   - URL: `https://wormzone-3d-multiplayer.deno.dev`

---

### Method 3: Using Our API Server

1. **Start our Deno API server**
   ```bash
   cd ~/deno-server
   deno task dev
   ```

2. **Create an app via API**
   ```bash
   curl -X POST http://localhost:8000/api/apps \
     -H "Content-Type: application/json" \
     -d '{"slug": "wormzone-3d-multiplayer", "labels": {"game": "snake"}}'
   ```

3. **Deploy from GitHub**
   ```bash
   curl -X POST http://localhost:8000/api/apps/wormzone-3d-multiplayer/deploy \
     -H "Content-Type: application/json" \
     -d '{"git_repository": "https://github.com/adarshkr6238/wormzone_3d", "git_branch": "main"}'
   ```

4. **Access at**: `https://wormzone-3d-multiplayer.deno.dev`

---

## Detailed Deployment Instructions

### Step 1: Prepare Your Code

Your `wormzone_3d` directory should have:
```
wormzone_3d/
├── deno-deploy-server.ts    # ✅ Server for Deno Deploy
├── public/
│   ├── deno-deploy.html      # ✅ Game page for Deno Deploy
│   ├── deno-deploy-game.js   # ✅ Client for Deno Deploy
│   ├── multiplayer.html      # Multiplayer page (local)
│   ├── multiplayer-game.js   # Multiplayer client (local)
│   ├── index.html            # Original single-player
│   ├── game.js               # Original game logic
│   └── ...
├── deploy-to-deno.sh         # Deployment script
└── ...
```

### Step 2: Choose Your Server

| Server | Use Case | Ports |
|--------|----------|-------|
| `multiplayer-server.ts` | Local testing | HTTP: 8000, WS: 8080 |
| `deno-deploy-server.ts` | Deno Deploy | Single port (auto) |

### Step 3: Deploy

#### For Deno Deploy:
- Use `deno-deploy-server.ts` (handles HTTP + WebSocket on same port)
- Entrypoint: `deno-deploy-server.ts`
- Entry file for browser: `public/deno-deploy.html`

#### For Local Testing:
- Use `multiplayer-server.ts` (separate HTTP and WS ports)
- Access: `http://localhost:8000/multiplayer.html`
- WebSocket: `ws://localhost:8080`

---

## Configuration Files

### For Deno Deploy: `deno.json`
```json
{
  "permissions": {
    "net": true,
    "read": true,
    "env": true
  }
}
```

### For Local Development: `deno.json`
```json
{
  "tasks": {
    "dev": "deno run --watch --allow-all multiplayer-server.ts",
    "deploy": "deno run --allow-all deno-deploy-server.ts"
  },
  "permissions": {
    "net": true,
    "read": true,
    "env": true
  }
}
```

---

## WebSocket on Deno Deploy

### How It Works

Deno Deploy supports WebSockets natively! When a client connects:

1. **Client** sends WebSocket upgrade request to `/`
2. **Server** accepts upgrade and creates WebSocket connection
3. **Client** and **Server** communicate via WebSocket protocol
4. **Server** broadcasts game state to all clients at 60 FPS

### Important Notes

✅ **Same port**: WebSocket uses the same port as HTTP
✅ **Automatic**: Deno Deploy handles the upgrade automatically
✅ **Secure**: wss:// for HTTPS, ws:// for HTTP
❌ **No separate port**: Cannot use port 8080 separately

### Client Connection Code

```javascript
// In deno-deploy-game.js
const wsUrl = window.location.protocol === 'https:' 
    ? `wss://${window.location.host}` 
    : `ws://${window.location.host}`;

const ws = new WebSocket(wsUrl);
```

---

## Troubleshooting Deployment

### "Module not found" Error

**Problem**: Deno can't find Three.js or other modules

**Solution**: 
- Make sure you're using ES Modules import syntax
- Check that the CDN URLs are accessible
- Try clearing Deno cache: `deno cache --reload`

### WebSocket Connection Fails

**Problem**: WebSocket connection doesn't establish

**Solutions**:
1. Check if the server is running
2. Verify WebSocket URL is correct
3. Try on a different browser
4. Check browser console for errors
5. On Deno Deploy, ensure you're using the same host

### Game is Laggy

**Solutions**:
- Reduce `MAX_PLAYERS` from 8 to 4
- Reduce `FOOD_COUNT` from 50 to 20
- Reduce `POWERUP_COUNT` from 5 to 2
- Close other browser tabs
- Use a wired connection

### Players Can't Connect

**Solutions**:
- Make sure they're using the correct URL
- Check if the deployment completed successfully
- Verify WebSocket is working (check browser dev tools)
- Try refreshing the page

### Deployment Stuck

**Solutions**:
- Check Deno Deploy dashboard for errors
- Verify your DENO_API_TOKEN has correct permissions
- Try redeploying
- Check the logs in the dashboard

---

## Custom Domain Setup

Once deployed, add a custom domain:

1. Go to Deno Deploy dashboard
2. Select your project
3. Click "Settings" > "Domains"
4. Click "Add Domain"
5. Enter your domain (e.g., `wormzone.yourdomain.com`)
6. Configure DNS (add CNAME record pointing to Deno Deploy)

---

## Environment Variables

Your server supports these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8000 | Server port (Deno Deploy sets this automatically) |

Set them in Deno Deploy dashboard under "Settings" > "Environment Variables"

---

## Monitoring Your Deployment

### View Logs

On Deno Deploy:
1. Go to your project dashboard
2. Click "Logs" tab
3. View real-time logs

Via API (using our server):
```bash
curl http://localhost:8000/api/apps/wormzone-3d-multiplayer/logs
```

### View Analytics
```bash
curl http://localhost:8000/api/apps/wormzone-3d-multiplayer/analytics
```

### Check Health
```bash
curl http://localhost:8000/health
```

---

## Performance Optimization

### For Deno Deploy:

1. **Enable caching** - Deno Deploy has built-in CDN
2. **Minimize dependencies** - Use fewer external modules
3. **Optimize game loop** - Reduce update frequency if needed
4. **Limit players** - Keep MAX_PLAYERS reasonable (4-8)

### Server Optimizations:

```typescript
// In GameStateManager
const MAX_PLAYERS = 6;      // Instead of 8
const FOOD_COUNT = 30;       // Instead of 50
const POWERUP_COUNT = 3;     // Instead of 5
const UPDATE_INTERVAL = 32; // ~30fps instead of 60fps
```

### Client Optimizations:

```javascript
// In deno-deploy-game.js
const inputThrottle = 100; // ms between inputs (reduce network traffic)
```

---

## Scaling Your Game

### Single Instance
- Supports up to 8 players
- Good for testing and small groups
- Low latency

### Multiple Instances
- Deploy multiple instances
- Use a load balancer
- Each instance = separate game room
- Players: 8 per room

### Room System (Advanced)
- Implement room creation/joining
- Each room = separate game state
- Players can choose which room to join
- Requires database for room persistence

---

## Security Considerations

### Rate Limiting
- Deno Deploy has built-in rate limiting
- Consider adding your own for production

### Input Validation
- Always validate player inputs on the server
- Prevent cheating (speed hacks, teleporting, etc.)

### Authentication (Optional)
- Add player authentication for persistent profiles
- Store scores and stats
- Prevent impersonation

---

## Complete Example: Deploy with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Deno Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Deno Deploy
        uses: denoland/deployctl@v1
        with:
          project: wormzone-3d-multiplayer
          entrypoint: deno-deploy-server.ts
          token: ${{ secrets.DENO_API_TOKEN }}
```

1. Create a GitHub Secret: `DENO_API_TOKEN`
2. Add your Deno Deploy token
3. Push to main branch
4. Automatic deployment on every push!

---

## Success Checklist

- [ ] Code pushed to GitHub
- [ ] Deno Deploy project created
- [ ] Entrypoint set to `deno-deploy-server.ts`
- [ ] Permissions configured (net, read, env)
- [ ] Deployment started
- [ ] Deployment completed (green checkmark)
- [ ] Game accessible at project URL
- [ ] Multiplayer works (test with 2+ browsers)
- [ ] Mobile controls work
- [ ] Game over detection works

---

## Need Help?

### Deno Deploy Support
- [Deno Deploy Docs](https://docs.deno.com/deploy)
- [Deno Deploy Discord](https://discord.gg/deno)
- [GitHub Issues](https://github.com/denoland/deploy)

### This Project
- Check `MULTIPLAYER.md` for game details
- Check `DENO_DEPLOY.md` for Deno Deploy setup
- Review `deno-deploy-server.ts` for server code
- Review `public/deno-deploy-game.js` for client code

---

## 🎉 Your Game is Live!

Once deployed, share your game URL with friends:

```
https://wormzone-3d-multiplayer.deno.dev
```

**Each player gets their own snake. Last one standing wins!** 🏆

---

*Happy deploying!* 🚀
