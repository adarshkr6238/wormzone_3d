# Wormzone 3D - Multiplayer Mode

Turn your single-player Snake game into a **competitive multiplayer battle** where each player controls their own snake and competes to be the last one standing!

## Features

✅ **Real-time multiplayer** - Play with friends in the same game
✅ **Each player gets their own snake** - Unique colors for each player
✅ **Competitive gameplay** - Last snake standing wins!
✅ **Score tracking** - See who's leading
✅ **Powerups** - Speed boosts and multipliers
✅ **Mobile-friendly** - Touch controls work great on phones
✅ **WebSocket-based** - Low latency, real-time updates

## Quick Start

### 1. Start the Multiplayer Server

```bash
cd wormzone_3d
deno run --allow-all multiplayer-server.ts
```

This starts:
- **HTTP Server** on port 8000 (serves the game)
- **WebSocket Server** on port 8080 (real-time communication)

### 2. Open the Game

Open your browser and visit: **http://localhost:8000/multiplayer.html**

Or on your phone (same network): **http://<your-ip>:8000/multiplayer.html**

### 3. Join the Game

- Enter your name
- Click "Join Game"
- Use **A/D** or **Left/Right Arrow** keys to turn
- Use **C** to switch camera views
- On mobile: Tap left/right sides of the screen

### 4. Play with Friends

Share the URL with friends on the same network. Each person who joins gets their own snake!

## How It Works

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Player 1   │◄───►│ WebSocket   │◄───►│   Player 2   │
│  (Browser)   │     │  Server     │     │  (Browser)   │
└─────────────┘     │ (Deno)      │     └─────────────┘
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │ Game State   │
                     │ Manager      │
                     └─────────────┘
```

### Game State Manager

The server maintains:
- All player positions, directions, and scores
- Food and powerup locations
- Collision detection
- Winner determination

### Real-time Sync

- **60 FPS** updates to all players
- **Low latency** WebSocket communication
- **Smooth interpolation** for fluid movement

## Game Rules

### Winning
- **Last snake standing wins!**
- When only one player remains alive, they win and a celebration message appears

### Controls
| Action | Keyboard | Mobile |
|--------|----------|--------|
| Turn Left | A / ← | Tap left side |
| Turn Right | D / → | Tap right side |
| Switch Camera | C | N/A |
| Join Game | Enter name & click Join | Same |
| Respawn | Click "Play Again" | Same |

### Camera Modes
- **Third Person**: Follows your snake from behind
- **Top Down**: Bird's eye view of the entire arena

### Collisions
- **Wall collision**: Hitting the arena boundaries = Game Over
- **Self collision**: Running into your own tail = Game Over
- **Player collision**: Running into another player's snake = Game Over
- **Food**: Eat to grow longer and score points
- **Powerups**: Speed boost or score multiplier

## Deployment

### Option 1: Local Network (Easiest)

```bash
# Start server
deno run --allow-all multiplayer-server.ts

# On your phone (same WiFi):
# Open browser and go to: http://<your-computer-ip>:8000/multiplayer.html
```

Find your computer's IP:
- **Linux/Mac**: `ip a` or `ifconfig`
- **Windows**: `ipconfig`
- **Termux**: `ifconfig` or `ip route`

### Option 2: Deploy to Deno Deploy

1. **Create a new project** on Deno Deploy
2. **Link your GitHub repo** (adarshkr6238/wormzone_3d)
3. **Set environment variables**:
   - None needed for basic deployment
4. **Deploy!**

Your game will be live at: `https://<project-name>.deno.dev`

**Note**: For WebSocket to work on Deno Deploy, you need to:
- Use the same domain for both HTTP and WebSocket
- Configure CORS if needed

### Option 3: Using Our API Server

```bash
# Terminal 1: Start our Deno API server
cd ../deno-server
deno task dev

# Terminal 2: Deploy wormzone with multiplayer
cd wormzone_3d
# Manually create an app and deploy with git_repository
```

## Project Structure

```
wormzone_3d/
├── multiplayer-server.ts    # WebSocket + HTTP server
├── public/
│   ├── index.html           # Single-player (with multiplayer link)
│   ├── multiplayer.html     # Multiplayer game page
│   ├── game.js              # Single-player game logic
│   └── multiplayer-game.js # Multiplayer game logic
├── deno-server.ts          # Simple static server
├── deno.json               # Deno configuration
├── package.json            # Node.js config (legacy)
└── server.js               # Node.js server (legacy)
```

## Customization

### Change Game Settings

Edit `multiplayer-server.ts`:

```typescript
// Adjust these constants at the top of the file:
const WORLD_SIZE = 250;           // Arena size
const SNAKE_SPEED_BASE = 0.15;   // Base snake speed
const ROTATION_SPEED = 0.05;     // Turn speed
const INITIAL_SEGMENTS = 10;      // Starting snake length
const MAX_PLAYERS = 8;            // Maximum players
const FOOD_COUNT = 50;           // Number of food items
const POWERUP_COUNT = 5;         // Number of powerups
```

### Change Player Colors

Edit the `PLAYER_COLORS` array in `multiplayer-server.ts`:

```typescript
const PLAYER_COLORS = [
  0x4CAF50, // Green
  0x2196F3, // Blue
  0xFFC107, // Amber
  // ... add more colors
];
```

### Change Appearance

Edit `multiplayer-game.js` to customize:
- Snake appearance (size, materials)
- Food and powerup appearance
- Camera behavior
- UI styling

## Multiplayer Game Logic

### Server-Side (multiplayer-server.ts)

The server handles:
1. **Player connections** - WebSocket handshake
2. **Game state updates** - 60 times per second
3. **Collision detection** - Walls, self, other players
4. **Food spawning** - Automatic food generation
5. **Powerup spawning** - Speed and multiplier powerups
6. **Winner determination** - Last player standing

### Client-Side (multiplayer-game.js)

The client handles:
1. **WebSocket connection** - Connects to server
2. **Input handling** - Keyboard and touch controls
3. **State rendering** - Updates 3D scene based on server state
4. **Camera control** - Third-person and top-down views
5. **UI updates** - Score, player list, game over screens

## Powerups

### Speed Boost
- **Color**: Cyan (0x00e5ff)
- **Effect**: Doubles your snake's speed for 8 seconds
- **Strategy**: Great for quick escapes or chasing food

### Score Multiplier
- **Color**: Pink (0xff4081)
- **Effect**: Doubles your score for the next foods you eat
- **Strategy**: Collect food while active for bonus points

## Tips for Winning

1. **Stay in the center** - More room to maneuver
2. **Watch other players** - Avoid their paths
3. **Use speed boosts wisely** - Don't crash while going fast!
4. **Corner your opponents** - Force them into walls or each other
5. **Grow strategically** - Longer snakes are harder to control

## Troubleshooting

### WebSocket Connection Failed
- Check if the server is running: `deno run --allow-all multiplayer-server.ts`
- Check the port: WebSocket runs on port 8080
- Check firewall: Allow incoming connections on ports 8000 and 8080
- Try on same computer first: `http://localhost:8000/multiplayer.html`

### Game is Laggy
- Reduce `MAX_PLAYERS` in the server
- Reduce `FOOD_COUNT` and `POWERUP_COUNT`
- Close other browser tabs
- Use a wired connection instead of WiFi

### Players Can't Connect
- Make sure they're on the same network
- Share the correct URL: `http://<your-ip>:8000/multiplayer.html`
- Check if your router blocks the ports

### No Food/Powerups Appear
- Check the server console for errors
- Make sure the game state is updating
- Try refreshing the page

## Advanced: Custom Server

### Run on Different Ports

```bash
# Set environment variables before starting
export PORT=8080
export WS_PORT=8081
deno run --allow-all --env multiplayer-server.ts
```

Then update the WebSocket URL in `multiplayer-game.js`:

```javascript
const wsUrl = `ws://${host}:${port}`;
```

### Run with HTTPS

For production, use a reverse proxy like Nginx or Caddy to add HTTPS.

## Contributing

Want to add features? Here are some ideas:

- [ ] Teams mode (2v2, 4v4)
- [ ] Different game modes (time trial, most food, etc.)
- [ ] Custom snake skins
- [ ] Chat between players
- [ ] Spectator mode
- [ ] Replay system
- [ ] Leaderboard
- [ ] Bots for single-player practice

## License

This multiplayer mode is an extension of your original Wormzone 3D game. Feel free to use, modify, and share!

---

**Enjoy the multiplayer battle!** 🎮🐍

*Last snake standing wins!*
