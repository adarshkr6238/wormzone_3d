import * as THREE from 'three';

// --- Configuration ---
const WORLD_SIZE = 250; 
const SNAKE_SPEED_BASE = 0.15;
const ROTATION_SPEED = 0.05;
const SEGMENT_DISTANCE = 0.4;
const INITIAL_SEGMENTS = 10;
const ENEMY_COUNT = 8; 

// --- Game State ---
let scene, camera, renderer;
let player, enemies = [], foods = [], powerups = [];
let score = 0;
let isGameOver = false;
let cameraMode = 'thirdPerson'; 
let keys = { a: false, d: false, left: false, right: false };

// --- Base Worm Class ---
class Worm {
    constructor(isPlayer = false, startPos = new THREE.Vector3(0, 0.5, 0), color = 0x4CAF50, initialLength = INITIAL_SEGMENTS) {
        this.isPlayer = isPlayer;
        this.segments = [];
        this.path = [];
        this.direction = Math.random() * Math.PI * 2;
        this.speed = SNAKE_SPEED_BASE;
        this.scoreMultiplier = 1;
        this.speedTimer = 0;
        this.multTimer = 0;
        this.aiTurn = (Math.random() - 0.5) * 0.1;
        
        // Create Head
        const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const headMat = new THREE.MeshPhongMaterial({ color: color });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.copy(startPos);
        this.head.castShadow = true;
        scene.add(this.head);
        this.segments.push(this.head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(0.2, 0.2, 0.35);
        this.head.add(eyeL);
        const eyeR = eyeL.clone();
        eyeR.position.x = -0.2;
        this.head.add(eyeR);

        // Add dynamic light source to the head
        const headLight = new THREE.PointLight(0xffffff, 2, 20);
        this.head.add(headLight);

        // Path history
        for (let i = 0; i < 2000; i++) {
            this.path.push(this.head.position.clone());
        }

        // Add initial segments
        for (let i = 0; i < initialLength; i++) {
            this.addSegment();
        }
    }

    update() {
        if (this.speedTimer > 0) {
            this.speedTimer--;
            if (this.speedTimer <= 0) this.speed = SNAKE_SPEED_BASE;
        }
        if (this.multTimer > 0) {
            this.multTimer--;
            if (this.multTimer <= 0) this.scoreMultiplier = 1;
        }

        if (this.isPlayer) {
            if (keys.a || keys.left) this.direction += ROTATION_SPEED;
            if (keys.d || keys.right) this.direction -= ROTATION_SPEED;
        } else {
            if (Math.random() < 0.02) this.aiTurn = (Math.random() - 0.5) * 0.1;
            this.direction += this.aiTurn;
            const distCenter = this.head.position.length();
            if (distCenter > (WORLD_SIZE / 2) - 15) {
                this.direction += 0.15;
            }
        }

        const vx = Math.sin(this.direction) * this.speed;
        const vz = Math.cos(this.direction) * this.speed;
        this.head.position.x += vx;
        this.head.position.z += vz;
        this.head.rotation.y = this.direction;

        if (this.isPlayer) {
            if (Math.abs(this.head.position.x) > WORLD_SIZE / 2 || Math.abs(this.head.position.z) > WORLD_SIZE / 2) {
                gameOver();
            }
        }

        this.path.unshift(this.head.position.clone());
        if (this.path.length > 2000) this.path.pop();

        for (let i = 1; i < this.segments.length; i++) {
            const index = Math.floor(i * (SEGMENT_DISTANCE / SNAKE_SPEED_BASE));
            const targetPos = this.path[index] || this.path[this.path.length - 1];
            this.segments[i].position.lerp(targetPos, 0.2);
            const prev = this.segments[i-1];
            this.segments[i].lookAt(prev.position);

            if (this.isPlayer && i > 30) {
                const dist = this.head.position.distanceTo(this.segments[i].position);
                if (dist < 0.6) gameOver();
            }
        }
    }

    addSegment() {
        const segGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const color = new THREE.Color(this.segments[0].material.color);
        color.lerp(new THREE.Color(0xffffff), 0.05);
        const segMat = new THREE.MeshPhongMaterial({ color: color });
        const segment = new THREE.Mesh(segGeo, segMat);
        const lastSeg = this.segments[this.segments.length - 1];
        segment.position.copy(lastSeg.position);
        segment.castShadow = true;
        scene.add(segment);
        this.segments.push(segment);
    }

    applyPowerup(type) {
        if (type === 'speed') {
            this.speed = SNAKE_SPEED_BASE * 2.2;
            this.speedTimer = 400; 
        } else if (type === 'multiplier') {
            this.scoreMultiplier = 2;
            this.multTimer = 800;
        }
    }
}

function createParticles(position, color) {
    const particleCount = 10;
    const particles = new THREE.Group();
    for (let i = 0; i < particleCount; i++) {
        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({ color: color })
        );
        p.position.copy(position);
        p.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        particles.add(p);
    }
    scene.add(particles);
    let life = 20;
    const animateParticles = () => {
        if (life-- > 0) {
            particles.children.forEach(p => p.position.add(p.velocity));
            requestAnimationFrame(animateParticles);
        } else {
            scene.remove(particles);
        }
    };
    animateParticles();
}

class Collectible {
    constructor(type = 'food') {
        this.type = type;
        const geo = new THREE.SphereGeometry(type === 'food' ? 0.35 : 0.6, 16, 16);
        let color = 0xffeb3b;
        if (type === 'speed') color = 0x00e5ff;
        if (type === 'multiplier') color = 0xff4081;
        this.color = color;
        const mat = new THREE.MeshPhongMaterial({ color: color, emissive: color, emissiveIntensity: 0.6 });
        this.mesh = new THREE.Mesh(geo, mat);
        this.spawn();
        scene.add(this.mesh);
    }
    spawn() {
        this.mesh.position.set((Math.random() - 0.5) * (WORLD_SIZE - 20), 0.4, (Math.random() - 0.5) * (WORLD_SIZE - 20));
    }
    update() {
        this.mesh.position.y = 0.4 + Math.sin(Date.now() * 0.005) * 0.15;
        this.mesh.rotation.y += 0.03;
        const dist = player.head.position.distanceTo(this.mesh.position);
        if (dist < 1.1) {
            if (this.type === 'food') {
                createParticles(this.mesh.position, this.color);
                player.addSegment();
                updateScore(10 * player.scoreMultiplier);
                this.spawn();
            } else {
                player.applyPowerup(this.type);
                scene.remove(this.mesh);
                powerups = powerups.filter(p => p !== this);
                setTimeout(() => spawnPowerup(), 7000);
            }
        }
    }
}

function spawnPowerup() {
    const type = Math.random() > 0.5 ? 'speed' : 'multiplier';
    powerups.push(new Collectible(type));
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    scene.fog = new THREE.Fog(0x0a0a12, 40, 120);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.camera.left = -WORLD_SIZE; sun.shadow.camera.right = WORLD_SIZE;
    sun.shadow.camera.top = WORLD_SIZE; sun.shadow.camera.bottom = -WORLD_SIZE;
    sun.shadow.mapSize.width = 2048; sun.shadow.mapSize.height = 2048;
    scene.add(sun);

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

    player = new Worm(true, new THREE.Vector3(0, 0.5, 0), 0x4CAF50);
    for(let i=0; i<ENEMY_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 80;
        const pos = new THREE.Vector3(Math.cos(angle)*dist, 0.5, Math.sin(angle)*dist);
        const randomLength = 10 + Math.floor(Math.random() * 30); 
        const randomColor = new THREE.Color().setHSL(Math.random(), 0.7, 0.6).getHex();
        enemies.push(new Worm(false, pos, randomColor, randomLength));
    }

    for(let i=0; i<80; i++) foods.push(new Collectible('food'));
    for(let i=0; i<4; i++) spawnPowerup();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'c') toggleCamera();
        handleKey(e.key, true);
    });
    window.addEventListener('keyup', (e) => handleKey(e.key, false));
    
    // Explicitly attach restart button logic (though inline is also there now)
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.onclick = () => window.location.reload();
    }

    const camBtn = document.getElementById('cam-btn');
    if (camBtn) camBtn.onclick = toggleCamera;

    // Mobile Touch Controls
    const tL = document.getElementById('touch-left');
    const tR = document.getElementById('touch-right');
    
    const handleTouch = (isLeft, active) => {
        if (isLeft) keys.left = active;
        else keys.right = active;
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

function toggleCamera() {
    cameraMode = cameraMode === 'thirdPerson' ? 'topDown' : 'thirdPerson';
}
function handleKey(key, isDown) {
    key = key.toLowerCase();
    if (key === 'a' || key === 'arrowleft') keys.left = isDown;
    if (key === 'd' || key === 'arrowright') keys.right = isDown;
}
function updateScore(pts) {
    score += pts;
    document.getElementById('score-board').innerText = `Score: ${score}`;
}
function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').innerText = score;
}
function animate() {
    requestAnimationFrame(animate);
    if (!isGameOver) {
        player.update();
        enemies.forEach(e => e.update());
        foods.forEach(f => f.update());
        powerups.forEach(p => p.update());
        if (cameraMode === 'thirdPerson') {
            const camOffset = new THREE.Vector3(-Math.sin(player.direction) * 12, 7, -Math.cos(player.direction) * 12);
            camera.position.lerp(player.head.position.clone().add(camOffset), 0.1);
            camera.lookAt(player.head.position);
        } else {
            camera.position.lerp(new THREE.Vector3(player.head.position.x, 40, player.head.position.z), 0.1);
            camera.lookAt(player.head.position);
        }
        enemies.forEach(enemy => {
            enemy.segments.forEach(seg => {
                if (player.head.position.distanceTo(seg.position) < 0.75) gameOver();
            });
        });
    }
    renderer.render(scene, camera);
}
init();
