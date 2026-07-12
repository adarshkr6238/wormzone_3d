// Wormzone 3D - Multiplayer WebSocket Server
// Deno native WebSocket server for real-time multiplayer

import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { WebSocketServer } from "jsr:@std/http/websocket";

// ============================================================================
// Game Configuration
// ============================================================================

const WORLD_SIZE = 250;
const SNAKE_SPEED_BASE = 0.15;
const ROTATION_SPEED = 0.05;
const SEGMENT_DISTANCE = 0.4;
const INITIAL_SEGMENTS = 10;
const MAX_PLAYERS = 8;
const FOOD_COUNT = 50;
const POWERUP_COUNT = 5;

// Player colors (distinct colors for each player)
const PLAYER_COLORS = [
  0x4CAF50, // Green
  0x2196F3, // Blue
  0xFFC107, // Amber
  0xFF5722, // Deep Orange
  0x9C27B0, // Purple
  0x00BCD4, // Cyan
  0xE91E63, // Pink
  0x795548, // Brown
  0x607D8B, // Blue Grey
];

// ============================================================================
// Type Definitions
// ============================================================================

interface Position {
  x: number;
  y: number;
  z: number;
}

interface Segment {
  position: Position;
}

interface Player {
  id: string;
  name: string;
  color: number;
  direction: number;
  segments: Segment[];
  score: number;
  speed: number;
  isAlive: boolean;
  lastUpdate: number;
  path: Position[];
  powerup: string | null;
  powerupTimer: number;
}

interface Food {
  id: string;
  position: Position;
  type: 'food' | 'speed' | 'multiplier';
}

interface GameState {
  players: Record<string, Player>;
  foods: Food[];
  powerups: Food[];
  startTime: number;
}

interface PlayerInput {
  type: 'turn' | 'join' | 'leave' | 'respawn';
  direction?: number; // -1 for left, 1 for right
  name?: string;
}

interface BroadcastMessage {
  type: 'state' | 'player_joined' | 'player_left' | 'game_over' | 'chat';
  data: GameState | { playerId: string; player: Player } | { playerId: string } | { winner: string; scores: Record<string, number> } | { playerId: string; message: string };
  timestamp: number;
}

// ============================================================================
// Game State Manager
// ============================================================================

class GameStateManager {
  private players: Record<string, Player> = {};
  private foods: Food[] = [];
  private powerups: Food[] = [];
  private lastFoodSpawn: number = 0;
  private lastPowerupSpawn: number = 0;
  private gameStartTime: number = Date.now();

  constructor() {
    this.initializeFood();
    this.initializePowerups();
  }

  private initializeFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.foods.push(this.createFood('food'));
    }
  }

  private initializePowerups() {
    for (let i = 0; i < POWERUP_COUNT; i++) {
      this.powerups.push(this.createFood('powerup'));
    }
  }

  private createFood(type: 'food' | 'powerup'): Food {
    const types = ['speed', 'multiplier'];
    return {
      id: crypto.randomUUID(),
      position: this.getRandomPosition(),
      type: type === 'food' ? 'food' : types[Math.floor(Math.random() * types.length)],
    };
  }

  private getRandomPosition(): Position {
    return {
      x: (Math.random() - 0.5) * (WORLD_SIZE - 20),
      y: 0.5,
      z: (Math.random() - 0.5) * (WORLD_SIZE - 20),
    };
  }

  public addPlayer(playerId: string, name: string = `Player-${playerId.substring(0, 4)}`): Player {
    const color = PLAYER_COLORS[Object.keys(this.players).length % PLAYER_COLORS.length];
    
    const player: Player = {
      id: playerId,
      name,
      color,
      direction: Math.random() * Math.PI * 2,
      segments: [],
      score: 0,
      speed: SNAKE_SPEED_BASE,
      isAlive: true,
      lastUpdate: Date.now(),
      path: [],
      powerup: null,
      powerupTimer: 0,
    };

    // Initialize player position in a circle
    const angle = (Object.keys(this.players).length / MAX_PLAYERS) * Math.PI * 2;
    const distance = 30;
    const startPos = {
      x: Math.cos(angle) * distance,
      y: 0.5,
      z: Math.sin(angle) * distance,
    };

    // Add initial segments
    for (let i = 0; i < INITIAL_SEGMENTS; i++) {
      player.segments.push({
        position: { ...startPos },
      });
    }

    // Initialize path
    for (let i = 0; i < 2000; i++) {
      player.path.push({ ...startPos });
    }

    this.players[playerId] = player;
    return player;
  }

  public removePlayer(playerId: string) {
    delete this.players[playerId];
  }

  public handleInput(playerId: string, input: PlayerInput) {
    const player = this.players[playerId];
    if (!player || !player.isAlive) return;

    switch (input.type) {
      case 'turn':
        if (input.direction) {
          player.direction += input.direction * ROTATION_SPEED;
        }
        break;
      case 'respawn':
        this.respawnPlayer(player);
        break;
    }
  }

  private respawnPlayer(player: Player) {
    player.isAlive = true;
    player.score = 0;
    player.speed = SNAKE_SPEED_BASE;
    player.powerup = null;
    player.powerupTimer = 0;

    // Reset position
    const angle = (Object.keys(this.players).indexOf(player.id) / MAX_PLAYERS) * Math.PI * 2;
    const distance = 30;
    const startPos = {
      x: Math.cos(angle) * distance,
      y: 0.5,
      z: Math.sin(angle) * distance,
    };

    player.segments = [];
    player.path = [];

    for (let i = 0; i < INITIAL_SEGMENTS; i++) {
      player.segments.push({ position: { ...startPos } });
    }

    for (let i = 0; i < 2000; i++) {
      player.path.push({ ...startPos });
    }

    player.headPosition = startPos;
  }

  public update() {
    const now = Date.now();

    // Update all players
    for (const playerId in this.players) {
      const player = this.players[playerId];
      if (!player.isAlive) continue;

      // Apply powerup effects
      if (player.powerupTimer > 0) {
        player.powerupTimer--;
        if (player.powerupTimer <= 0) {
          player.powerup = null;
          player.speed = SNAKE_SPEED_BASE;
        }
      }

      // Move player
      const vx = Math.sin(player.direction) * player.speed;
      const vz = Math.cos(player.direction) * player.speed;

      const headPosition = player.path[0] || player.segments[0].position;
      const newHeadPos = {
        x: headPosition.x + vx,
        y: headPosition.y,
        z: headPosition.z + vz,
      };

      // Check boundary collision
      if (Math.abs(newHeadPos.x) > WORLD_SIZE / 2 || Math.abs(newHeadPos.z) > WORLD_SIZE / 2) {
        player.isAlive = false;
        continue;
      }

      // Update path
      player.path.unshift(newHeadPos);
      if (player.path.length > 2000) player.path.pop();

      // Update segments
      for (let i = 1; i < player.segments.length; i++) {
        const index = Math.floor(i * (SEGMENT_DISTANCE / SNAKE_SPEED_BASE));
        const targetPos = player.path[index] || player.path[player.path.length - 1];
        
        // Smooth movement
        player.segments[i].position.x += (targetPos.x - player.segments[i].position.x) * 0.2;
        player.segments[i].position.y += (targetPos.y - player.segments[i].position.y) * 0.2;
        player.segments[i].position.z += (targetPos.z - player.segments[i].position.z) * 0.2;
      }

      // Check self-collision
      const head = player.segments[0];
      for (let i = 10; i < player.segments.length; i++) {
        const segment = player.segments[i];
        const dist = Math.sqrt(
          Math.pow(head.position.x - segment.position.x, 2) +
          Math.pow(head.position.z - segment.position.z, 2)
        );
        if (dist < 0.6) {
          player.isAlive = false;
          break;
        }
      }

      // Check collision with other players
      for (const otherId in this.players) {
        if (otherId === playerId) continue;
        const otherPlayer = this.players[otherId];
        if (!otherPlayer.isAlive) continue;

        for (let i = 0; i < otherPlayer.segments.length; i++) {
          const segment = otherPlayer.segments[i];
          const dist = Math.sqrt(
            Math.pow(head.position.x - segment.position.x, 2) +
            Math.pow(head.position.z - segment.position.z, 2)
          );
          if (dist < 0.6) {
            player.isAlive = false;
            break;
          }
        }
        if (!player.isAlive) break;
      }

      // Check food collection
      for (let i = 0; i < this.foods.length; i++) {
        const food = this.foods[i];
        const dist = Math.sqrt(
          Math.pow(head.position.x - food.position.x, 2) +
          Math.pow(head.position.z - food.position.z, 2)
        );
        if (dist < 1.1) {
          player.score += 10;
          player.segments.push({ position: { ...head.position } });
          this.foods.splice(i, 1);
          this.foods.push(this.createFood('food'));
          i--;
        }
      }

      // Check powerup collection
      for (let i = 0; i < this.powerups.length; i++) {
        const powerup = this.powerups[i];
        const dist = Math.sqrt(
          Math.pow(head.position.x - powerup.position.x, 2) +
          Math.pow(head.position.z - powerup.position.z, 2)
        );
        if (dist < 1.1) {
          if (powerup.type === 'speed') {
            player.speed = SNAKE_SPEED_BASE * 2.2;
          } else if (powerup.type === 'multiplier') {
            // Score multiplier would be applied when scoring
          }
          player.powerup = powerup.type;
          player.powerupTimer = 800;
          this.powerups.splice(i, 1);
          this.powerups.push(this.createFood('powerup'));
          i--;
        }
      }

      player.lastUpdate = now;
    }

    // Spawn new food if needed
    if (now - this.lastFoodSpawn > 5000 && this.foods.length < FOOD_COUNT) {
      this.foods.push(this.createFood('food'));
      this.lastFoodSpawn = now;
    }

    // Spawn new powerup if needed
    if (now - this.lastPowerupSpawn > 15000 && this.powerups.length < POWERUP_COUNT) {
      this.powerups.push(this.createFood('powerup'));
      this.lastPowerupSpawn = now;
    }

    // Check if only one player remains
    const alivePlayers = Object.values(this.players).filter(p => p.isAlive);
    if (alivePlayers.length === 1 && Object.keys(this.players).length > 1) {
      // Last player standing wins!
      const winner = alivePlayers[0];
      return { type: 'game_over', winner: winner.id, scores: this.getScores() };
    }

    return null;
  }

  public getState(): GameState {
    return {
      players: this.players,
      foods: this.foods,
      powerups: this.powerups,
      startTime: this.gameStartTime,
    };
  }

  public getScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const playerId in this.players) {
      scores[playerId] = this.players[playerId].score;
    }
    return scores;
  }

  public getPlayerCount(): number {
    return Object.keys(this.players).length;
  }
}

// ============================================================================
// WebSocket Server
// ============================================================================

const app = new Application();
const router = new Router();
const gameState = new GameStateManager();

// HTTP routes for serving static files
router.get("/", async (ctx) => {
  await ctx.send({
    root: `${Deno.cwd()}/public`,
    index: "index.html",
  });
});

router.get("/multiplayer", async (ctx) => {
  await ctx.send({
    root: `${Deno.cwd()}/public`,
    index: "multiplayer.html",
  });
});

// Serve static files
router.get("/public/:path*", async (ctx) => {
  await ctx.send({
    root: `${Deno.cwd()}/public`,
    path: ctx.params.path,
  });
});

app.use(router.routes());
app.use(router.allowedMethods());

// WebSocket server
const wss = new WebSocketServer(8080);

console.log(`
🎮 Wormzone 3D - Multiplayer Server
=====================================
🌐 HTTP Server:  http://localhost:8000
🔗 WebSocket:    ws://localhost:8080

Waiting for players to connect...
`);

wss.on("connection", (ws: WebSocket, req: Request) => {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("host") || "unknown";
  const playerId = crypto.randomUUID();
  
  console.log(`👤 New player connected: ${playerId} (from ${ip})`);
  console.log(`🎯 Total players: ${gameState.getPlayerCount()}`);

  // Send initial state
  ws.send(JSON.stringify({
    type: "init",
    playerId,
    state: gameState.getState(),
  }));

  // Broadcast to all players that a new player joined
  const player = gameState.addPlayer(playerId);
  broadcast({
    type: "player_joined",
    data: { playerId, player },
    timestamp: Date.now(),
  }, ws);

  // Handle messages from client
  ws.on("message", (message: string) => {
    try {
      const data: PlayerInput & { playerId?: string; name?: string } = JSON.parse(message);
      
      // Set player name if provided
      if (data.name) {
        const player = gameState.getState().players[playerId];
        if (player) {
          player.name = data.name;
        }
      }

      // Handle input
      gameState.handleInput(playerId, data);
    } catch (error) {
      console.error(`Error processing message from ${playerId}:`, error.message);
    }
  });

  // Handle disconnection
  ws.on("close", () => {
    console.log(`👋 Player disconnected: ${playerId}`);
    gameState.removePlayer(playerId);
    broadcast({
      type: "player_left",
      data: { playerId },
      timestamp: Date.now(),
    });
  });

  ws.on("error", (error: Error) => {
    console.error(`WebSocket error for ${playerId}:`, error.message);
  });
});

// Broadcast to all connected clients except sender
function broadcast(message: BroadcastMessage, excludeWs?: WebSocket) {
  const encoded = JSON.stringify(message);
  
  for (const client of wss.clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

// Game loop
setInterval(() => {
  const gameEvent = gameState.update();
  
  // Broadcast game state to all players
  broadcast({
    type: "state",
    data: gameState.getState(),
    timestamp: Date.now(),
  });

  // If there's a game over event, broadcast it
  if (gameEvent && gameEvent.type === 'game_over') {
    broadcast({
      type: "game_over",
      data: gameEvent,
      timestamp: Date.now(),
    });
  }
}, 16); // ~60fps

// Start HTTP server
await app.listen({ port: 8000 });
console.log(`HTTP server running on port 8000`);
