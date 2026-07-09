// Wormzone 3D - Enhanced Multiplayer Game Client for Deno Deploy
// Features: Name/Color selection, Live Scoreboard, Player Names above snakes, Chat

import * as THREE from 'three';

// ============================================================================
// Configuration
// ============================================================================

const WORLD_SIZE = 250;
const ROTATION_SPEED = 0.05;

// Available snake colors
const SNAKE_COLORS = [
    0x4CAF50, 0x2196F3, 0xFFC107, 0xFF5722,
    0x9C27B0, 0x00BCD4, 0xE91E63, 0xFF9800,
    0x009688, 0x673AB7, 0x3F51B5, 0xF44336,
];

// ============================================================================
// Game State
// ============================================================================

let scene, camera, renderer;
let players = {};
let myPlayerId = null;
let myPlayer = null;
let foods = [];
let powerups = [];
let cameraMode = 'thirdPerson';
let keys = { a: false, d: false, left: false, right: false };
let ws = null;
let isGameOver = false;
let gameStartTime = Date.now();
let lastInputTime = 0;
let inputThrottle = 50;

// Chat state
let chatOpen = false;
let chatMessages = [];
let chatHistory = [];

// Scoreboard
let scoreboardData = {};

// Selected color (default green)
let selectedColor = 0x4CAF50;

// ============================================================================
// WebSocket Connection
// ============================================================================

function connectWebSocket() {
    let wsUrl;
    
    if (window.location.protocol === 'https:') {
        wsUrl = `wss://${window.location.host}`;
    } else {
        wsUrl = `ws://${window.location.host}`;
    }
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    updateConnectionStatus('⭐ Connecting...', false);
    
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
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            updateConnectionStatus('❌ Disconnected', false);
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
            
            if (message.chatHistory) {
                chatHistory = message.chatHistory;
                updateChatDisplay();
            }
            break;
            
        case 'state':
            updateGameState(message.data);
            break;
            
        case 'player_joined':
            console.log(`Player joined: ${message.data.playerId}`);
            break;
            
        case 'player_left':
            console.log(`Player left: ${message.data.playerId}`);
            removePlayer(message.data.playerId);
            break;
            
        case 'player_updated':
            updatePlayerProfile(message.data.playerId, message.data.name, message.data.color);
            break;
            
        case 'scoreboard':
            scoreboardData = message.data;
            updateScoreboard(message.data);
            break;
            
        case 'chat':
            addChatMessage(message.data);
            break;
            
        case 'game_over':
            showWinner(message.data.winner, message.data.scores);
            break;
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
    if (players[playerId]) return;
    
    const player = {
        id: playerId,
        name: playerData.name || `Player-${playerId.substring(0, 4)}`,
        color: playerData.color || 0x4CAF50,
        direction: playerData.direction || 0,
        segments: playerData.segments || [],
        score: playerData.score || 0,
        isAlive: playerData.isAlive !== false,
        head: null,
        segmentsMeshes: [],
        nameLabel: null,
        scoreLabel: null,
    };
    
    players[playerId] = player;
    createPlayerMesh(player);
    createNameLabels(player);
    
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

function createNameLabels(player) {
    // Name label (above head)
    const nameCanvas = createLabelCanvas(player.name, `#${player.color.toString(16).padStart(6, '0')}`);
    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    nameTexture.needsUpdate = true;
    const nameMaterial = new THREE.SpriteMaterial({ 
        map: nameTexture, 
        transparent: true,
        depthTest: false,
    });
    player.nameLabel = new THREE.Sprite(nameMaterial);
    player.nameLabel.scale.set(nameCanvas.width / 100, nameCanvas.height / 100, 1);
    scene.add(player.nameLabel);
    
    // Score label (below name)
    const scoreCanvas = createScoreLabelCanvas(player.score);
    const scoreTexture = new THREE.CanvasTexture(scoreCanvas);
    scoreTexture.needsUpdate = true;
    const scoreMaterial = new THREE.SpriteMaterial({ 
        map: scoreTexture, 
        transparent: true,
        depthTest: false,
    });
    player.scoreLabel = new THREE.Sprite(scoreMaterial);
    player.scoreLabel.scale.set(scoreCanvas.width / 100, scoreCanvas.height / 100, 1);
    scene.add(player.scoreLabel);
}

function createLabelCanvas(text, bgColor, textColor = '#ffffff') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    ctx.font = 'bold 28px Arial';
    const textWidth = ctx.measureText(text).width;
    const padding = 20;
    const width = textWidth + padding * 2;
    canvas.width = width;
    
    // Background
    ctx.fillStyle = bgColor;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, width, 64);
    ctx.globalAlpha = 1;
    
    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, width - 3, 61);
    
    // Text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, 32);
    
    return canvas;
}

function createScoreLabelCanvas(score, textColor = '#ffeb3b') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const text = `Score: ${score}`;
    ctx.font = 'bold 24px Arial';
    const textWidth = ctx.measureText(text).width;
    const padding = 15;
    const width = textWidth + padding * 2;
    const height = 56;
    canvas.width = width;
    canvas.height = height;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    
    // Text
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    
    return canvas;
}

function updatePlayerProfile(playerId, name, color) {
    const player = players[playerId];
    if (!player) return;
    
    if (name !== undefined) {
        player.name = name;
        if (player.nameLabel) {
            updateNameLabel(player);
        }
    }
    if (color !== undefined) {
        player.color = color;
        // Update head color
        if (player.head) {
            player.head.material.color.setHex(color);
        }
        // Update segment colors
        for (let i = 0; i < player.segmentsMeshes.length; i++) {
            const segment = player.segmentsMeshes[i];
            const segColor = new THREE.Color(color);
            segColor.lerp(new THREE.Color(0xffffff), 0.05 * (i / 10));
            segment.material.color.copy(segColor);
        }
        if (player.nameLabel) {
            updateNameLabel(player);
        }
    }
}

function updateNameLabel(player) {
    if (!player.nameLabel) return;
    
    const canvas = createLabelCanvas(player.name, `#${player.color.toString(16).padStart(6, '0')}`);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    player.nameLabel.material.map = texture;
    player.nameLabel.material.needsUpdate = true;
    player.nameLabel.scale.set(canvas.width / 100, canvas.height / 100, 1);
}

function updateScoreLabel(player) {
    if (!player.scoreLabel) return;
    
    const score = scoreboardData[player.id]?.score || player.score || 0;
    
    const canvas = createScoreLabelCanvas(score);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    player.scoreLabel.material.map = texture;
    player.scoreLabel.material.needsUpdate = true;
    player.scoreLabel.scale.set(canvas.width / 100, canvas.height / 100, 1);
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
    
    // Hide extra segments
    for (let i = player.segments.length; i < player.segmentsMeshes.length; i++) {
        player.segmentsMeshes[i].visible = false;
    }
    
    // Update name/score labels
    updateNameLabel(player);
    updateScoreLabel(player);
    
    // Update label visibility based on alive status
    if (player.nameLabel) player.nameLabel.visible = player.isAlive;
    if (player.scoreLabel) player.scoreLabel.visible = player.isAlive;
    
    if (playerId === myPlayerId) {
        myPlayer = player;
    }
}

function removePlayer(playerId) {
    const player = players[playerId];
    if (!player) return;
    
    // Remove meshes
    if (player.head) scene.remove(player.head);
    for (const mesh of player.segmentsMeshes) scene.remove(mesh);
    if (player.nameLabel) scene.remove(player.nameLabel);
    if (player.scoreLabel) scene.remove(player.scoreLabel);
    
    // Dispose textures
    if (player.nameLabel?.material?.map) player.nameLabel.material.map.dispose();
    if (player.scoreLabel?.material?.map) player.scoreLabel.material.map.dispose();
    
    delete players[playerId];
    
    if (playerId === myPlayerId) {
        myPlayer = null;
    }
    
    console.log(`Removed player: ${playerId}`);
}

// ============================================================================
// Scoreboard
// ============================================================================

function updateScoreboard(scoreboard) {
    scoreboardData = scoreboard;
    const scoreboardEl = document.getElementById('scoreboard');
    if (!scoreboardEl) return;
    
    const sortedPlayers = Object.entries(scoreboard)
        .sort((a, b) => b[1].score - a[1].score);
    
    let html = '';
    for (let i = 0; i < sortedPlayers.length; i++) {
        const [id, data] = sortedPlayers[i];
        const isMe = id === myPlayerId;
        const color = new THREE.Color(data.color).getStyle();
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const aliveIcon = data.isAlive ? '' : ' 💀';
        const meIndicator = isMe ? ' <span style="color: #00e5ff;">(YOU)</span>' : '';
        
        html += `
            <div class="scoreboard-entry ${isMe ? 'me' : ''}">
                <span class="rank">${medal}</span>
                <div class="player-info">
                    <span class="player-color" style="background-color: ${color}"></span>
                    <span class="player-name">${data.name}${meIndicator}${aliveIcon}</span>
                </div>
                <span class="player-score">${data.score}</span>
            </div>
        `;
    }
    
    scoreboardEl.innerHTML = html;
}

// ============================================================================
// Chat System
// ============================================================================

function addChatMessage(message) {
    chatMessages.push(message);
    chatHistory.push(message);
    
    if (chatMessages.length > 50) {
        chatMessages.shift();
    }
    
    updateChatDisplay();
}

function updateChatDisplay() {
    const chatEl = document.getElementById('chat-log');
    if (!chatEl) return;
    
    let html = '';
    for (const msg of chatMessages.slice(-50)) {
        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isMe = msg.playerId === myPlayerId;
        const color = new THREE.Color(msg.color).getStyle();
        
        html += `
            <div class="chat-message ${isMe ? 'own' : ''}">
                <span class="chat-time">[${time}]</span>
                <span class="chat-name" style="color: ${color}">${msg.name}</span>
                <span class="chat-text">${escapeHtml(msg.message)}</span>
            </div>
        `;
    }
    
    chatEl.innerHTML = html;
    chatEl.scrollTop = chatEl.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleChat() {
    chatOpen = !chatOpen;
    const chatPanel = document.getElementById('chat-panel');
    const chatInput = document.getElementById('chat-input');
    const chatBtn = document.getElementById('chat-btn');
    
    if (chatPanel) {
        chatPanel.style.display = chatOpen ? 'flex' : 'none';
        if (chatOpen && chatInput) {
            chatInput.focus();
        }
        if (chatBtn) {
            chatBtn.innerText = chatOpen ? '💬 Close Chat' : '💬 Chat';
            chatBtn.classList.toggle('active', chatOpen);
        }
    }
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (message) {
        sendMessage({ type: 'chat', message });
        chatInput.value = '';
    }
}

function handleChatInput(e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    } else if (e.key === 'Escape') {
        toggleChat();
    }
}

// ============================================================================
// Name/Color Selection
// ============================================================================

function initColorPicker() {
    const container = document.getElementById('color-options');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < SNAKE_COLORS.length; i++) {
        const color = SNAKE_COLORS[i];
        const option = document.createElement('div');
        option.className = 'color-option' + (color === selectedColor ? ' selected' : '');
        option.style.background = `#${color.toString(16).padStart(6, '0')}`;
        option.dataset.color = color;
        option.onclick = () => selectColor(color, option);
        container.appendChild(option);
    }
}

function selectColor(color, element) {
    selectedColor = color;
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function showNameColorDialog() {
    const dialog = document.getElementById('name-color-modal');
    if (dialog) {
        dialog.style.display = 'flex';
        const nameInput = document.getElementById('player-name');
        if (nameInput) nameInput.focus();
    }
}

function joinGame() {
    const nameInput = document.getElementById('player-name');
    let name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        name = `Player-${Math.random().toString(36).substring(2, 6)}`;
    }
    
    // Hide dialog
    const dialog = document.getElementById('name-color-modal');
    if (dialog) dialog.style.display = 'none';
    
    // Send join message with name and color
    sendMessage({ 
        type: 'join', 
        name, 
        color: selectedColor 
    });
    
    // Update local player
    if (myPlayerId && players[myPlayerId]) {
        players[myPlayerId].name = name;
        players[myPlayerId].color = selectedColor;
        updateNameLabel(players[myPlayerId]);
    }
}

// ============================================================================
// Food & Powerup Management
// ============================================================================

let foodMeshes = [];
let powerupMeshes = [];

function updateFoods() {
    for (const mesh of foodMeshes) scene.remove(mesh);
    foodMeshes = [];
    
    for (const food of foods) {
        const geo = new THREE.SphereGeometry(0.35, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ 
            color: 0xffeb3b, 
            emissive: 0xffeb3b, 
            emissiveIntensity: 0.6 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(food.position.x, food.position.y + Math.sin(Date.now() * 0.005) * 0.15, food.position.z);
        scene.add(mesh);
        foodMeshes.push(mesh);
    }
}

function updatePowerups() {
    for (const mesh of powerupMeshes) scene.remove(mesh);
    powerupMeshes = [];
    
    for (const powerup of powerups) {
        let color = 0x00e5ff;
        if (powerup.type === 'multiplier') color = 0xff4081;
        
        const geo = new THREE.SphereGeometry(0.6, 16, 16);
        const mat = new THREE.MeshPhongMaterial({ 
            color: color, 
            emissive: color, 
            emissiveIntensity: 0.6 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(powerup.position.x, powerup.position.y + Math.sin(Date.now() * 0.005) * 0.15, powerup.position.z);
        scene.add(mesh);
        powerupMeshes.push(mesh);
    }
}

// ============================================================================
// Update Labels Position
// ============================================================================

function updateLabels() {
    for (const playerId in players) {
        const player = players[playerId];
        if (player.head && player.nameLabel && player.scoreLabel) {
            // Position name label above head
            player.nameLabel.position.set(
                player.head.position.x,
                player.head.position.y + 2.5,
                player.head.position.z
            );
            
            // Position score label below name
            player.scoreLabel.position.set(
                player.head.position.x,
                player.head.position.y + 1.2,
                player.head.position.z
            );
            
            // Always face camera
            player.nameLabel.lookAt(camera.position);
            player.scoreLabel.lookAt(camera.position);
        }
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
        if (chatOpen) return;
        
        if (e.key.toLowerCase() === 'c') toggleCamera();
        if (e.key === 'Enter' && !chatOpen) {
            toggleChat();
        }
        handleKey(e.key, true);
    });
    window.addEventListener('keyup', (e) => {
        if (!chatOpen) handleKey(e.key, false);
    });
    
    // Chat input
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', handleChatInput);
    }
    
    // Chat toggle button
    const chatToggle = document.getElementById('chat-btn');
    if (chatToggle) {
        chatToggle.onclick = toggleChat;
    }
    
    // Chat send button
    const chatSend = document.getElementById('chat-send');
    if (chatSend) {
        chatSend.onclick = sendChatMessage;
    }
    
    // Join button
    const joinBtn = document.getElementById('join-btn');
    if (joinBtn) {
        joinBtn.onclick = joinGame;
    }
    
    // Restart button
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.onclick = respawn;
    }
    
    // Player name input - enter to join
    const nameInput = document.getElementById('player-name');
    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') joinGame();
        });
    }
    
    // Chat input
    const chatInputEl = document.getElementById('chat-input');
    if (chatInputEl) {
        chatInputEl.addEventListener('keydown', handleChatInput);
    }
    
    // Mobile Touch Controls
    const tL = document.getElementById('touch-left');
    const tR = document.getElementById('touch-right');
    
    const handleTouch = (isLeft, active) => {
        if (isLeft) keys.left = active;
        else keys.right = active;
        
        const now = Date.now();
        if (now - lastInputTime > inputThrottle && myPlayerId) {
            const direction = isLeft ? -1 : 1;
            sendMessage({ type: 'turn', direction: active ? direction : 0 });
            lastInputTime = now;
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

    addTouchListeners(document.getElementById('touch-left'), true);
    addTouchListeners(document.getElementById('touch-right'), false);
    
    // Initialize color picker
    initColorPicker();
    
    // Show name/color dialog
    showNameColorDialog();
    
    animate();
}

// ============================================================================
// Game Functions
// ============================================================================

function handleKey(key, isDown) {
    key = key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') {
        keys.left = isDown;
        if (myPlayerId) {
            const now = Date.now();
            if (now - lastInputTime > inputThrottle) {
                sendMessage({ type: 'turn', direction: isDown ? -1 : 0 });
                lastInputTime = now;
            }
        }
    }
    if (key === 'd' || key === 'arrowright') {
        keys.right = isDown;
        if (myPlayerId) {
            const now = Date.now();
            if (now - lastInputTime > inputThrottle) {
                sendMessage({ type: 'turn', direction: isDown ? 1 : 0 });
                lastInputTime = now;
            }
        }
    }
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
    
    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) {
        gameOverEl.style.display = 'block';
        document.getElementById('final-score').innerText = (myPlayer ? myPlayer.score : 0);
    }
    
    isGameOver = true;
    
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

function updateGameState(state) {
    // Update players
    for (const playerId in state.players) {
        const playerData = state.players[playerId];
        
        if (!players[playerId]) {
            addPlayer(playerId, playerData);
        } else {
            updatePlayer(playerId, playerData);
        }
        
        if (playerId === myPlayerId) {
            myPlayer = players[playerId];
        }
    }
    
    // Remove players no longer in state
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
    
    if (state.startTime) {
        gameStartTime = state.startTime;
    }
    
    if (myPlayer) {
        document.getElementById('score-board').innerText = `Score: ${myPlayer.score}`;
    }
    
    if (myPlayer && !myPlayer.isAlive) {
        gameOver();
    }
}

// ============================================================================
// Animation Loop
// ============================================================================

function animate() {
    requestAnimationFrame(animate);
    
    if (!isGameOver && myPlayer && myPlayer.head) {
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
    
    // Update label positions
    updateLabels();
    
    // Animate food/powerup floating
    const time = Date.now() * 0.005;
    for (const mesh of foodMeshes) {
        mesh.position.y = 0.4 + Math.sin(time + mesh.position.x * 0.1) * 0.15;
        mesh.rotation.y += 0.03;
    }
    for (const mesh of powerupMeshes) {
        mesh.position.y = 0.4 + Math.sin(time + mesh.position.x * 0.1) * 0.15;
        mesh.rotation.y += 0.03;
    }
    
    renderer.render(scene, camera);
}

// ============================================================================
// Initialize
// ============================================================================

// Connect to WebSocket first
connectWebSocket();

// Initialize Three.js when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Auto-focus name input when modal shows
const nameInput = document.getElementById('player-name');
if (nameInput) {
    nameInput.focus();
}