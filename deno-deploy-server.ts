// Wormzone 3D - Deno Deploy Native WebSocket Server
// Uses Deno.serve() for proper WebSocket upgrade handling on Deno Deploy

import { serveStatic } from "https://deno.land/std@0.224.0/http/file_server.ts";

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
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

const DEFAULT_COLORS = [
  0x4CAF50, 0x2196F3, 0xFFC107, 0xFF5722,
  0x9C27B0, 0x00BCD4, 0xE91E63, 0x795548,
  0xFF9800, 0x009688, 0x673AB7, 0xE91E63,
];

const MAX_CHAT_HISTORY = 50;
let chatHistory: ChatMessage[] = [];

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
  hasJoined: boolean;
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
  type: 'turn' | 'join' | 'leave' | 'respawn' | 'chat' | 'update_profile';
  direction?: number;
  name?: string;
  color?: number;
  message?: string;
}

interface BroadcastMessage {
  type: 'state' | 'player_joined' | 'player_left' | 'game_over' | 'init' | 'chat' | 'scoreboard' | 'player_updated' | 'chat_history' | 'ping';
  data: GameState | { playerId: string; player: Player } | { playerId: string } | { winner: string; scores: Record<string, number> } | { playerId: string; name: string; message: string; timestamp: number } | { players: Record<string, { name: string; score: number; color: number; isAlive: boolean }> } | { playerId: string; name: string; color: number } | ChatMessage[] | { timestamp: number };
  playerId?: string;
  timestamp: number;
}

interface ChatMessage {
  playerId: string;
  name: string;
  color: number;
  message: string;
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
  private playerColors: Map<string, number> = new Map();

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

  public addPlayer(playerId: string, name: string = `Player-${playerId.substring(0, 4)}`, color?: number): Player {
    let playerColor: number;
    if (color !== undefined) {
      playerColor = color;
      this.playerColors.set(playerId, color);
    } else if (this.playerColors.has(playerId)) {
      playerColor = this.playerColors.get(playerId)!;
    } else {
      playerColor = DEFAULT_COLORS[Object.keys(this.players).length % DEFAULT_COLORS.length];
    }
    
    const player: Player = {
      id: playerId,
      name,
      color: playerColor,
      direction: Math.random() * Math.PI * 2,
      segments: [],
      score: 0,
      speed: SNAKE_SPEED_BASE,
      isAlive: true,
      lastUpdate: Date.now(),
      path: [],
      powerup: null,
      powerupTimer: 0,
      hasJoined: false,
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
      player.segments.push({ position: { ...startPos } });
    }

    // Initialize path
    for (let i = 0; i < 2000; i++) {
      player.path.push({ ...startPos });
    }

    this.players[playerId] = player;
    return player;
  }

  public updatePlayerProfile(playerId: string, name?: string, color?: number) {
    const player = this.players[playerId];
    if (!player) return;
    
    if (name !== undefined) {
      player.name = name;
    }
    if (color !== undefined) {
      player.color = color;
      this.playerColors.set(playerId, color);
    }
    player.hasJoined = true;
  }

  public removePlayer(playerId: string) {
    this.playerColors.delete(playerId);
    delete this.players[playerId];
  }

  public handleInput(playerId: string, input: PlayerInput) {
    const player = this.players[playerId];
    if (!player) return;

    switch (input.type) {
      case 'turn':
        if (input.direction && player.isAlive) {
          player.direction += input.direction * ROTATION_SPEED;
        }
        break;
      case 'join':
        // Handle initial join with name/color
        if (input.name) player.name = input.name;
        if (input.color) {
          player.color = input.color;
          this.playerColors.set(playerId, input.color);
        }
        player.hasJoined = true;
        break;
      case 'respawn':
        this.respawnPlayer(player);
        break;
      case 'chat':
        if (input.message && input.message.trim()) {
          this.addChatMessage(playerId, input.message.trim());
        }
        break;
      case 'update_profile':
        this.updatePlayerProfile(playerId, input.name, input.color);
        break;
    }
  }

  private addChatMessage(playerId: string, message: string) {
    const player = this.players[playerId];
    if (!player) return;
    
    const chatMessage: ChatMessage = {
      playerId,
      name: player.name,
      color: player.color,
      message,
      timestamp: Date.now(),
    };
    
    chatHistory.push(chatMessage);
    if (chatHistory.length > MAX_CHAT_HISTORY) {
      chatHistory.shift();
    }
    
    // Broadcast to all players
    broadcast({
      type: "chat",
      data: chatMessage,
      timestamp: Date.now(),
    });
  }

  public getChatHistory(): ChatMessage[] {
    return [...chatHistory];
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
  }

  public update() {
    const now = Date.now();

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

      if (!player.isAlive) continue;

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

      if (!player.isAlive) continue;

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

  public getScoreboardData(): Record<string, { name: string; score: number; color: number; isAlive: boolean }> {
    const data: Record<string, { name: string; score: number; color: number; isAlive: boolean }> = {};
    for (const playerId in this.players) {
      const p = this.players[playerId];
      data[playerId] = {
        name: p.name,
        score: p.score,
        color: p.color,
        isAlive: p.isAlive,
      };
    }
    return data;
  }

  public getPlayerCount(): number {
    return Object.keys(this.players).length;
  }
}

// ============================================================================
// Server Setup
// ============================================================================

const gameState = new GameStateManager();

// Store WebSocket connections with player IDs
const sockets = new Map<string, WebSocket>();

// Broadcast to all connected clients except sender
function broadcast(message: BroadcastMessage, excludeSocket?: WebSocket) {
  const encoded = JSON.stringify(message);
  
  for (const socket of sockets.values()) {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(encoded);
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

  // Broadcast scoreboard
  broadcast({
    type: "scoreboard",
    data: gameState.getScoreboardData(),
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

// ============================================================================
// Deno.serve() Handler - Native WebSocket Support
// ============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const upgradeHeader = req.headers.get("upgrade");
  
  console.log(`📥 Request: ${req.method} ${url.pathname} | Upgrade: ${upgradeHeader}`);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Upgrade",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  
  // Handle WebSocket upgrade - case insensitive
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    
    const playerId = crypto.randomUUID();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("host") || "unknown";
    
    console.log(`👤 New player connected: ${playerId} (from ${ip})`);
    console.log(`🎯 Total players: ${gameState.getPlayerCount()}`);
    
    sockets.set(playerId, socket);
    
    socket.onopen = () => {
      // Send initial state with chat history
      socket.send(JSON.stringify({
        type: "init",
        playerId,
        state: gameState.getState(),
        chatHistory: gameState.getChatHistory(),
      }));
      
      // Add player to game
      const player = gameState.addPlayer(playerId);
      broadcast({
        type: "player_joined",
        data: { playerId, player },
        timestamp: Date.now(),
      }, socket);
      
      // Start heartbeat for this connection
      const heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
        } else {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL);
      
      (socket as any).heartbeat = heartbeat;
    };
    
    socket.onmessage = (message: MessageEvent) => {
      try {
        const data: PlayerInput & { type: string } = JSON.parse(message.data);
        
        // Handle ping/pong
        if (data.type === "pong") {
          return; // Client responded to our ping
        }
        
        // Get playerId from the socket
        const pid = (socket as any).playerId || playerId;
        if (!pid) return;
        
        // Handle name/color update
        if (data.name || data.color) {
          const player = gameState.getState().players[pid];
          if (player) {
            if (data.name) player.name = data.name;
            if (data.color) player.color = data.color;
          }
        }
        
        // Handle input
        gameState.handleInput(pid, data);
      } catch (error) {
        console.error(`Error processing message from ${(socket as any).playerId || "unknown"}:`, error);
      }
    };
    
    socket.onclose = () => {
      const pid = (socket as any).playerId || playerId;
      
      if (pid) {
        console.log(`👋 Player disconnected: ${pid}`);
        // Clear heartbeat
        const heartbeat = (socket as any).heartbeat;
        if (heartbeat) clearInterval(heartbeat);
        
        sockets.delete(pid);
        gameState.removePlayer(pid);
        broadcast({
          type: "player_left",
          data: { playerId: pid },
          timestamp: Date.now(),
        });
      }
    };
    
    socket.onerror = (error: Error) => {
      const pid = (socket as any).playerId || playerId || "unknown";
      console.error(`WebSocket error for ${pid}:`, error.message);
    };
    
    // Add CORS header to response
    response.headers.set("Access-Control-Allow-Origin", "*");
    
    return response;
  }
  
  // Serve static files
  let path = url.pathname;
  
  // Handle root and multiplayer routes
  if (path === "/" || path === "/multiplayer" || path === "/multiplayer.html") {
    path = "deno-deploy.html";
  } else if (path.startsWith("/")) {
    path = path.slice(1); // Remove leading slash
  }
  
  const fileResponse = await serveStatic(req, path);
  if (fileResponse) return fileResponse;
  
  // Fallback to index.html for SPA routing
  if (!path.includes('.')) {
    const indexResponse = await serveStatic(req, "deno-deploy.html");
    if (indexResponse) return indexResponse;
  }
  
  return new Response("Not Found", { status: 404 });
});

console.log(`
🎮 Wormzone 3D - Enhanced Multiplayer Server (Deno Deploy Native)
==================================================================
🌐 Server running on port 8000 (or \$PORT env)

✨ Features:
   - Name & Color customization
   - Live real-time scoreboard
   - Player names above snakes
   - Chat system
   - Multiplayer battle royale!
   - Heartbeat/ping-pong for connection health

📝 To play:
   Open: https://your-project.deno.dev/multiplayer.html

🔗 WebSocket: wss://your-project.deno.dev

WebSockets work automatically on Deno Deploy - no extra config needed!
`);