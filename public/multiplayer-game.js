// Wormzone 3D - Multiplayer Game Client
// Connects to WebSocket server for real-time multiplayer

import * as THREE from 'three';

// ============================================================================
// Configuration
// ============================================================================

const WORLD_SIZE = 250;
const ROTATION_SPEED = 0.05;

// ============================================================================
// Game State
// ============================================================================

let scene, camera, renderer;
let players = {}; // All players including self
let myPlayerId = null;
let myPlayer = null;
let foods = [];
let powerups = [];
let cameraMode = 'thirdPerson';
let keys = { a: false, d: false, left: false, right: false };
let ws = null;
let isGameOver = false;
let gameStartTime = Date.now();

// ============================================================================
// WebSocket Connection
// ============================================================================

function connectWebSocket() {
    // Try to connect to localhost first, then fall back to window.location
    const protocols = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // If running on Deno Deploy (no port), use same origin. Local dev: HTTP on 8000 → WS on 8080.
    const port = window.location.port ? (window.location.port === '8000' ? '8080' : window.location.port) : '';
    const wsUrl = port ? `${protocols}//${host}:${port}` : `${protocols}//${host}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected!');
            updateConnectionStatus('✅ Connected', true);
        };
        
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleMessage(message);
        };
        
        ws.onclose = (event) => {
            console.log('WebSocket closed', event);
            console.log('Code:', event.code, 'Reason:', event.reason);
            // Show disconnected status
            updateConnectionStatus('❌ Disconnected', false);
            // Try to reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateConnectionStatus('⚠️ Error', false);
        };
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        updateConnectionStatus('❌ Failed to connect', false);
        setTimeout(connectWebSocket, 3000);
    }
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function handleMessage(message) {
    switch (message.type) {
        case 'init':
            myPlayerId = message.playerId;
            console.log(`Initialized with player ID: ${myPlayerId}`);
            // Game will start when state is received
            break;
            
        case 'state':
            updateGameState(message.data);
            break;
            
        case 'player_joined':
            console.log(`Player joined: ${message.data.playerId}`);
            // Player will be added in next state update
            break;
            
        case 'player_left':
            console.log(`Player left: ${message.data.playerId}`);
            removePlayer(message.data.playerId);
            break;
            
        case 'game_over':
            showWinner(message.data.winner, message.data.scores);
            break;
    }
}

function updateGameState(state) {
    // Update players
    for (const playerId in state.players) {
        const playerData = state.players[playerId];
        
        if (!players[playerId]) {
            // New player
            addPlayer(playerId, playerData);
        } else {
            // Update existing player
            updatePlayer(playerId, playerData);
        }
        
        // Track my player
        if (playerId === myPlayerId) {
            myPlayer = players[playerId];
        }
    }
    
    // Remove players that are no longer in state
    for (const playerId in players) {
        if (!state.players[playerId]) {
            removePlayer(playerId);
        }
    }
    
    // Update foods
    foods = state.foods || [];
    updateFoods();
    
    // Update powerups
    powerups = state.powerups || [];
    updatePowerups();
    
    // Update game start time
    if (state.startTime) {
        gameStartTime = state.startTime;
    }
    
    // Update score display
    if (myPlayer) {
        document.getElementById('score-board').innerText = `Score: ${myPlayer.score}`;
    }
    
    // Update players list
    updatePlayersList(state.players);
    
    // Check if game is over for my player
    if (myPlayer && !myPlayer.isAlive) {
        gameOver();
    }
}

function updateConnectionStatus(text, connected) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.innerText = text;
        statusEl.className = connected ? '' : 'disconnected';
    }
}

// ============================================================================
// Player Management
// ============================================================================

function addPlayer(playerId, playerData) {
    const player = {
        id: playerId,
        name: playerData.name || `Player-${playerData.id.substring(0, 4)}`,
        color: playerData.color || 0x4CAF50,
        direction: playerData.direction || 0,
        segments: [],
        score: playerData.score || 0,
        isAlive: playerData.isAlive !== false,
        mesh: null,
        head: null,
        segmentsMeshes: [],
    };
    
    players[playerId] = player;
    createPlayerMesh(player);
    
    console.log(`Added player: ${playerId} (${player.name})`);
}

function createPlayerMesh(player) {
    // Create head
    const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const headMat = new THREE.MeshPhongMaterial({ color: player.color });
    player.head = new THREE.Mesh(headGeo, headMat);
    player.head.castShadow = true;
    scene.add(player.head);
    
    // Add eyes
    const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.2, 0.2, 0.35);
    player.head.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = -0.2;
    player.head.add(eyeR);
    
    // Add light to head
    const headLight = new THREE.PointLight(0xffffff, 2, 20);
    player.head.add(headLight);
    
    // Create segments
    player.segmentsMeshes = [];
    for (let i = 0; i < player.segments.length; i++) {
        addSegmentMesh(player, i);
    }
}

function addSegmentMesh(player, index) {
    const segGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const color = new THREE.Color(player.color);
    color.lerp(new THREE.Color(0xffffff), 0.05 * (index / 10));
    const segMat = new THREE.MeshPhongMaterial({ color: color });
    const segment = new THREE.Mesh(segGeo, segMat);
    segment.castShadow = true;
    scene.add(segment);
    player.segmentsMeshes.push(segment);
}

function updatePlayer(playerId, playerData) {
    const player = players[playerId];
    if (!player) return;
    
    // Update player data
    player.name = playerData.name || player.name;
    player.color = playerData.color || player.color;
    player.direction = playerData.direction || player.direction;
    player.score = playerData.score || player.score;
    player.isAlive = playerData.isAlive !== false;
    player.segments = playerData.segments || player.segments;
    
    // Update head position
    if (player.head && playerData.segments && playerData.segments.length > 0) {
        const headPos = playerData.segments[0].position;
        player.head.position.set(headPos.x, headPos.y, headPos.z);
        player.head.rotation.y = playerData.direction || 0;
    }
    
    // Update segments
    while (player.segmentsMeshes.length < player.segments.length) {
        addSegmentMesh(player, player.segmentsMeshes.length);
    }
    
    for (let i = 0; i < Math.min(player.segments.length, player.segmentsMeshes.length); i++) {
        const segment = player.segments[i];
        const mesh = player.segmentsMeshes[i];
        if (segment && mesh) {
            mesh.position.set(segment.position.x, segment.position.y, segment.position.z);
            if (i > 0) {
                const prevSegment = player.segments[i - 1];
                if (prevSegment) {
                    mesh.lookAt(prevSegment.position.x, prevSegment.position.y, prevSegment.position.z);
                }
            }
        }
    }
    
    // Hide extra segments if player shrinks
    for (let i = player.segments.length; i < player.segmentsMeshes.length; i++) {
        player.segmentsMeshes[i].visible = false;
    }
}

function removePlayer(playerId) {
    const player = players[playerId];
    if (!player) return;
    
    // Remove meshes from scene
    if (player.head) {
        scene.remove(player.head);
    }
    for (const segment of player.segmentsMeshes) {
        scene.remove(segment);
    }
    
    delete players[playerId];
    
    // If it was my player, clear it
    if (playerId === myPlayerId) {
        myPlayer = null;
    }
    
    console.log(`Removed player: ${playerId}`);
}

function updatePlayersList(playersData) {
    const playersListEl = document.getElementById('players-list');
    if (!playersListEl) return;
    
    const sortedPlayers = Object.values(playersData).sort((a, b) => b.score - a.score);
    
    let html = '';
    for (const player of sortedPlayers) {
        const color = new THREE.Color(player.color).getStyle();
        html += `
            <div class="player-item">
                <div class="player-color" style="background-color: ${color}"></div>
                <span>${player.name}: ${player.score}</span>
                ${!player.isAlive ? ' ❌' : ''}
            </div>
        `;
    }
    
    playersListEl.innerHTML = html;
}

// ============================================================================
// Food & Powerup Management
// ============================================================================

let foodMeshes = [];
let powerupMeshes = [];

function updateFoods() {
    // Clear existing food meshes
    for (const mesh of foodMeshes) {
        scene.remove(mesh);
    }
    foodMeshes = [];
    
    // Create new food meshes
    for (const food of foods) {
        const geo = new THREE.SphereGeometry(0.35, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ 
            color: 0xffeb3b, 
            emissive: 0xffeb3b, 
            emissiveIntensity: 0.6 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(food.position.x, food.position.y, food.position.z);
        scene.add(mesh);
        foodMeshes.push(mesh);
    }
}

function updatePowerups() {
    // Clear existing powerup meshes
    for (const mesh of powerupMeshes) {
        scene.remove(mesh);
    }
    powerupMeshes = [];
    
    // Create new powerup meshes
    for (const powerup of powerups) {
        let color = 0x00e5ff; // Default to speed
        if (powerup.type === 'multiplier') {
            color = 0xff4081;
        }
        
        const geo = new THREE.SphereGeometry(0.6, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ 
            color: color, 
            emissive: color, 
            emissiveIntensity: 0.6 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(powerup.position.x, powerup.position.y, powerup.position.z);
        scene.add(mesh);
        powerupMeshes.push(mesh);
    }
}

// ============================================================================
// Three.js Setup
// ============================================================================

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.Fog(0x0a0a12, 40, 120);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.camera.left = -WORLD_SIZE; sun.shadow.camera.right = WORLD_SIZE;
    sun.shadow.camera.top = WORLD_SIZE; sun.shadow.camera.bottom = -WORLD_SIZE;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10182b'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 4;
    for(let i=0; i<=512; i+=64) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(512,i); ctx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(canvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(WORLD_SIZE/10, WORLD_SIZE/10);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshPhongMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c') toggleCamera();
        handleKey(e.key, true);
    });
    window.addEventListener('keyup', (e) => handleKey(e.key, false));
    
    // Restart button
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.onclick = respawn;
    }
    
    // Mobile Touch Controls
    const tL = document.getElementById('touch-left');
    const tR = document.getElementById('touch-right');
    
    const handleTouch = (isLeft, active) => {
        if (isLeft) keys.left = active;
        else keys.right = active;
        
        // Send turn input to server
        if (myPlayerId) {
            const direction = isLeft ? -1 : 1;
            sendMessage({ type: 'turn', direction: active ? direction : 0 });
        }
    };

    const addTouchListeners = (el, isLeft) => {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(isLeft, true); }, {passive: false});
        el.addEventListener('touchend', (e) => { e.preventDefault(); handleTouch(isLeft, false); }, {passive: false});
        el.addEventListener('touchcancel', (e) => { e.preventDefault(); handleTouch(isLeft, false); }, {passive: false});
        el.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target !== el) handleTouch(isLeft, false);
        }, {passive: false});
    };

    addTouchListeners(tL, true);
    addTouchListeners(tR, false);
    
    animate();
}

function joinGame() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput ? nameInput.value.trim() || `Player-${Math.random().toString(36).substring(2, 6)}` : `Player`;
    
    // Hide name input
    document.getElementById('name-input').style.display = 'none';
    
    // Send profile update to set name (server expects 'update_profile')
    sendMessage({ type: 'update_profile', name });
}

function respawn() {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('winner-overlay').style.display = 'none';
    isGameOver = false;
    sendMessage({ type: 'respawn' });
}

function showWinner(winnerId, scores) {
    const winner = players[winnerId];
    const winnerName = winner ? winner.name : `Player ${winnerId.substring(0, 4)}`;
    const winnerOverlay = document.getElementById('winner-overlay');
    
    if (winnerOverlay) {
        winnerOverlay.style.display = 'block';
        winnerOverlay.innerText = `🏆 ${winnerName} WINS! 🏆`;
    }
    
    // Also show game over
    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) {
        gameOverEl.style.display = 'block';
        document.getElementById('final-score').innerText = (myPlayer ? myPlayer.score : 0);
    }
    
    isGameOver = true;
    
    // Hide after 5 seconds
    setTimeout(() => {
        if (winnerOverlay) winnerOverlay.style.display = 'none';
    }, 5000);
}

function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) {
        gameOverEl.style.display = 'block';
        document.getElementById('final-score').innerText = (myPlayer ? myPlayer.score : 0);
    }
}

function toggleCamera() {
    cameraMode = cameraMode === 'thirdPerson' ? 'topDown' : 'thirdPerson';
}

function handleKey(key, isDown) {
    key = key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') {
        keys.left = isDown;
        if (myPlayerId) {
            sendMessage({ type: 'turn', direction: isDown ? -1 : 0 });
        }
    }
    if (key === 'd' || key === 'arrowright') {
        keys.right = isDown;
        if (myPlayerId) {
            sendMessage({ type: 'turn', direction: isDown ? 1 : 0 });
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (!isGameOver && myPlayer && myPlayer.head) {
        // Update camera based on my player
        if (cameraMode === 'thirdPerson') {
            const camOffset = new THREE.Vector3(
                -Math.sin(myPlayer.direction) * 12, 
                7, 
                -Math.cos(myPlayer.direction) * 12
            );
            camera.position.lerp(myPlayer.head.position.clone().add(camOffset), 0.1);
            camera.lookAt(myPlayer.head.position);
        } else {
            camera.position.lerp(new THREE.Vector3(
                myPlayer.head.position.x, 
                40, 
                myPlayer.head.position.z
            ), 0.1);
            camera.lookAt(myPlayer.head.position);
        }
    }
    
    renderer.render(scene, camera);
}

// ============================================================================
// Initialize
// ============================================================================

// Connect to WebSocket first
connectWebSocket();

// Initialize Three.js
document.addEventListener('DOMContentLoaded', () => { init(); bindJoinButton(); bindLogButton(); });

// Bind join button after DOM is ready
function bindJoinButton(){
  const joinBtn=document.getElementById('join-btn');
  if(joinBtn){
    joinBtn.addEventListener('click',()=>{
      const nameEl=document.getElementById('player-name');
      const name=nameEl?.value.trim()||'Player-'+Math.random().toString(36).slice(2,6);
      sendMessage({type:'join',name});
      const nameDiv=document.getElementById('name-input');
      if(nameDiv) nameDiv.style.display='none';
    });
  }
}

// ---------------------------------------------------
// Log capture & UI toggle
let logBuffer = [];
function captureLog(level, ...args){
  const ts = new Date().toISOString();
  const msg = args.map(a=> typeof a==='object'?JSON.stringify(a):String(a)).join(' ');
  logBuffer.push(`[${ts}] ${level.toUpperCase()}: ${msg}`);
  // Keep buffer limited to last 200 lines
  if(logBuffer.length>200) logBuffer.shift();
  // Update UI if visible
  const out = document.getElementById('log-output');
  if(out && out.style.display!=='none') out.textContent = logBuffer.join('\n');
}
// Hijack console methods
const origLog = console.log;
const origError = console.error;
console.log = (...a)=>{ origLog.apply(console,a); captureLog('log',...a); };
console.error = (...a)=>{ origError.apply(console,a); captureLog('error',...a); };

function bindLogButton(){
  const btn = document.getElementById('log-btn');
  const copyBtn = document.getElementById('copy-log-btn');
  const out = document.getElementById('log-output');
  if(!btn||!out) return;
  btn.addEventListener('click',()=>{
    if(out.style.display==='none'){
      out.style.display='block';
      out.textContent = logBuffer.join('\n');
      btn.textContent = 'Hide Logs';
      if(copyBtn) copyBtn.style.display = 'inline-block';
    } else {
      out.style.display='none';
      btn.textContent = 'Show Logs';
      if(copyBtn) copyBtn.style.display = 'none';
    }
  });
  if(copyBtn){
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(logBuffer.join('\n'));
        const orig = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = orig, 1500);
      } catch (e) {
        console.error('Copy failed:', e);
      }
    });
  }
}


// Auto-focus name input
const nameInput = document.getElementById('player-name');
if (nameInput) {
    nameInput.focus();
}
