// Wormzone 3D - Multiplayer Client (Fixed & Complete)

import * as THREE from 'three';

// ============ CONFIG ============
const WORLD_SIZE = 250;
const SNAKE_COLORS = [0x4CAF50,0x2196F3,0xFFC107,0xFF5722,0x9C27B0,0x00BCD4,0xE91E63,0xFF9800,0x009688,0x673AB7,0x3F51B5,0xF44336];

// ============ STATE ============
let scene, camera, renderer;
const players = {};
let myPlayerId = null, myPlayer = null;
const foods = [], powerups = [];
let cameraMode = 'thirdPerson';
const keys = {a:false,d:false,left:false,right:false};
let ws = null;
let isGameOver = false;
let lastInput = 0;
const THROTTLE = 50;
let chatOpen = false;
const chatMsgs = [];
let selectedColor = 0x4CAF50;
const scoreData = {};
let foodMeshes = [], pupMeshes = [];

// ============ WS ============
function connect() {
    const url = location.protocol==='https:'?`wss://${location.host}`:`ws://${location.host}`;
    console.log('WS:', url);
    setStatus('Connecting...', false);
    ws = new WebSocket(url);
    ws.onopen = () => { console.log('WS open'); setStatus('Connected ✓', true); };
    ws.onmessage = e => { try{handleMsg(JSON.parse(e.data))}catch(err){console.error(err)} };
    ws.onclose = () => { console.log('WS closed'); setStatus('Disconnected', false); setTimeout(connect, 3000); };
    ws.onerror = e => { console.error(e); setStatus('Error', false); };
}

function send(obj){ if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

function handleMsg(m){
    switch(m.type){
        case 'init': myPlayerId=m.playerId; console.log('My ID:',myPlayerId); if(m.chatHistory){chatMsgs.push(...m.chatHistory); renderChat();} break;
        case 'state': applyState(m.data); break;
        case 'player_joined': console.log('Joined:',m.data.playerId); break;
        case 'player_left': removePlayer(m.data.playerId); break;
        case 'player_updated': updProfile(m.data.playerId,m.data.name,m.data.color); break;
        case 'scoreboard': Object.assign(scoreData,m.data); renderScore(); break;
        case 'chat': chatMsgs.push(m.data); if(chatMsgs.length>100)chatMsgs.shift(); renderChat(); break;
        case 'game_over': showWinner(m.data.winner,m.data.scores); break;
    }
}

function setStatus(t,ok){ const s=document.getElementById('conn'); if(s){s.textContent=t;s.className=ok?'ok':'bad';} }

// ============ PLAYER ============
function addPlayer(id,d){
    if(players[id]) return;
    const p={id,name:d.name||'Player',color:d.color||0x4CAF50,dir:d.direction||0,segs:d.segments||[],score:d.score||0,alive:d.isAlive!==false,head:null,body:[],lbl:null,slbl:null};
    players[id]=p; buildMesh(p); buildLbl(p);
}

function buildMesh(p){
    const g=new THREE.SphereGeometry(0.5,32,32), mt=new THREE.MeshPhongMaterial({color:p.color});
    p.head=new THREE.Mesh(g,mt); p.head.castShadow=true; scene.add(p.head);
    const eg=new THREE.SphereGeometry(0.1,8,8), em=new THREE.MeshBasicMaterial({color:0xffffff});
    const el=new THREE.Mesh(eg,em); el.position.set(0.2,0.2,0.35); p.head.add(el);
    const er=el.clone(); er.position.x=-0.2; p.head.add(er);
    const hl=new THREE.PointLight(0xffffff,2,20); p.head.add(hl);
    p.body=[]; for(let i=0;i<p.segs.length;i++) addSeg(p,i);
}

function addSeg(p,i){
    const g=new THREE.SphereGeometry(0.45,16,16);
    const c=new THREE.Color(p.color).lerp(new THREE.Color(0xffffff),0.05*i/10);
    const m=new THREE.MeshPhongMaterial({color:c});
    const s=new THREE.Mesh(g,m); s.castShadow=true; scene.add(s); p.body.push(s);
}

function buildLbl(p){
    p.lbl=mkSprite(mkNameCvs(p.name,p.color));
    p.slbl=mkSprite(mkScoreCvs(p.score));
    scene.add(p.lbl); scene.add(p.slbl);
}

function mkSprite(tex){ return new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false})); }

function mkNameCvs(txt,col){
    const cvs=document.createElement('canvas'), ctx=cvs.getContext('2d');
    ctx.font='bold 28px Arial'; const tw=ctx.measureText(txt).width, pad=20, w=tw+pad*2, h=64;
    cvs.width=w; cvs.height=h;
    ctx.fillStyle='#'+col.toString(16).padStart(6,'0'); ctx.globalAlpha=0.9; ctx.fillRect(0,0,w,h); ctx.globalAlpha=1;
    ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.strokeRect(1.5,1.5,w-3,h-3);
    ctx.fillStyle='#fff'; ctx.font='bold 28px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,w/2,h/2);
    const t=new THREE.CanvasTexture(cvs); t.needsUpdate=true; return t;
}

function mkScoreCvs(sc){
    const cvs=document.createElement('canvas'), ctx=cvs.getContext('2d');
    const txt='Score: '+sc; ctx.font='bold 24px Arial'; const tw=ctx.measureText(txt).width, pad=15, w=tw+pad*2, h=48;
    cvs.width=w; cvs.height=h;
    ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#ffeb3b'; ctx.lineWidth=2; ctx.strokeRect(1,1,w-2,h-2);
    ctx.fillStyle='#ffeb3b'; ctx.font='bold 24px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,w/2,h/2);
    const t=new THREE.CanvasTexture(cvs); t.needsUpdate=true; return t;
}

function updProfile(id,n,c){
    const p=players[id]; if(!p) return;
    if(n!==undefined){p.name=n; updNameLbl(p);}
    if(c!==undefined){p.color=c; p.head.material.color.setHex(c); p.body.forEach((s,i)=>s.material.color.copy(new THREE.Color(c).lerp(new THREE.Color(0xffffff),0.05*i/10))); updNameLbl(p);}
}

function updNameLbl(p){
    if(!p.lbl) return; p.lbl.material.map.dispose(); p.lbl.material.map=mkNameCvs(p.name,p.color); p.lbl.material.needsUpdate=true;
    const c=document.createElement('canvas'),ctx=c.getContext('2d'); ctx.font='bold 28px Arial'; const tw=ctx.measureText(p.name).width; p.lbl.scale.set((tw+40)/100,64/100,1);
}

function applyState(st){
    for(const id in st.players){
        const d=st.players[id];
        if(!players[id]) addPlayer(id,d); else updPlayer(id,d);
        if(id===myPlayerId) myPlayer=players[id];
    }
    for(const id in players) if(!st.players[id]) removePlayer(id);
    foods.length=0; foods.push(...(st.foods||[])); updFoods();
    powerups.length=0; powerups.push(...(st.powerups||[])); updPups();
    if(myPlayer) document.getElementById('score').textContent='Score: '+myPlayer.score;
    if(myPlayer && !myPlayer.alive) gameOver();
}

function updPlayer(id,d){
    const p=players[id]; if(!p) return;
    p.name=d.name||p.name; p.color=d.color||p.color; p.dir=d.direction||p.dir; p.score=d.score||p.score; p.alive=d.isAlive!==false; p.segs=d.segments||p.segs;
    if(p.head && d.segments?.[0]){
        const hp=d.segments[0].position; p.head.position.set(hp.x,hp.y,hp.z); p.head.rotation.y=d.direction||0;
    }
    while(p.body.length<p.segs.length) addSeg(p,p.body.length);
    for(let i=0;i<Math.min(p.segs.length,p.body.length);i++){
        const s=p.segs[i], m=p.body[i]; if(s&&m){m.position.set(s.position.x,s.position.y,s.position.z); if(i>0){const ps=p.segs[i-1]; if(ps)m.lookAt(ps.position.x,ps.position.y,ps.position.z);}}
    }
    for(let i=p.segs.length;i<p.body.length;i++) p.body[i].visible=false;
    if(p.lbl) p.lbl.visible=p.alive; if(p.slbl) p.slbl.visible=p.alive;
}

function removePlayer(id){
    const p=players[id]; if(!p) return;
    scene.remove(p.head); p.body.forEach(s=>scene.remove(s)); scene.remove(p.lbl); scene.remove(p.slbl);
    delete players[id]; if(id===myPlayerId) myPlayer=null;
}

// ============ FOOD/PUP ============
function updFoods(){ foodMeshes.forEach(m=>scene.remove(m)); foodMeshes=[]; foods.forEach(f=>{const g=new THREE.SphereGeometry(0.35,16,16),mt=new THREE.MeshPhongMaterial({color:0xffeb3b,emissive:0xffeb3b,emissiveIntensity:0.6}),o=new THREE.Mesh(g,mt); o.position.set(f.position.x,f.position.y,f.position.z); scene.add(o); foodMeshes.push(o);}); }
function updPups(){ pupMeshes.forEach(m=>scene.remove(m)); pupMeshes=[]; powerups.forEach(p=>{const c=p.type==='multiplier'?0xff4081:0x00e5ff,g=new THREE.SphereGeometry(0.6,16,16),mt=new THREE.MeshPhongMaterial({color:c,emissive:c,emissiveIntensity:0.6}),o=new THREE.Mesh(g,mt); o.position.set(p.position.x,p.position.y,p.position.z); scene.add(o); pupMeshes.push(o);}); }

// ============ SCOREBOARD ============
function renderScore(){
    const el=document.getElementById('scoreboard'); if(!el) return;
    const arr=Object.entries(scoreData).sort((a,b)=>b[1].score-a[1].score);
    let h=''; arr.forEach(([id,d],i)=>{const me=id===myPlayerId,c=new THREE.Color(d.color).getStyle();h+=`<div class="sb-row ${me?'me':''}"><span class="rk">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1+'.'}</span><div class="pi"><span class="pc" style="background:${c}"></span><span class="pn">${d.name}${me?' (YOU)':''}${d.isAlive?'':' 💀'}</span></div><span class="ps">${d.score}</span></div>`;});
    el.innerHTML=h||'<div style="color:#666;text-align:center;padding:10px">Waiting for players...</div>';
}

// ============ CHAT ============
function renderChat(){
    const el=document.getElementById('chatlog'); if(!el) return;
    el.innerHTML=chatMsgs.map(m=>{const t=new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),c=new THREE.Color(m.color).getStyle(),me=m.playerId===myPlayerId;return `<div class="cm ${me?'me':''}"><span class="ct">[${t}]</span><span class="cn" style="color:${c}">${m.name}</span><span class="ctxt">${esc(m.message)}</span></div>`;}).join('');
    el.scrollTop=el.scrollHeight;
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}

function toggleChat(){
    chatOpen=!chatOpen;
    const p=document.getElementById('chatpanel'),b=document.getElementById('chatbtn'),i=document.getElementById('chatinput');
    if(chatOpen){p.style.display='flex';i.focus();b.textContent='💬 Close';b.classList.add('on');}
    else{p.style.display='none';b.textContent='💬 Chat';b.classList.remove('on');}
}

function sendChatMsg(){
    const i=document.getElementById('chatinput');
    if(i?.value.trim() && ws?.readyState===WebSocket.OPEN){send({type:'chat',message:i.value.trim()});i.value='';}
}

function handleChatKey(e){if(e.key==='Enter')sendChatMsg();else if(e.key==='Escape')toggleChat();}

// ============ JOIN MODAL ============
function buildColorPicker(){
    const c=document.getElementById('colorPicker'); if(!c) return;
    c.innerHTML=SNAKE_COLORS.map(col=>{const h=col.toString(16).padStart(6,'0');const sel=col===selectedColor;return `<div class="co ${sel?'sel':''}" style="background:#${h}" data-c="${col}" onclick="pickColor(this,${col})"></div>`;}).join('');
}

function pickColor(el,col){selectedColor=col;document.querySelectorAll('.co').forEach(x=>x.classList.remove('sel'));el.classList.add('sel');}

function doJoin(){
    const n=document.getElementById('pname');
    const name=n?.value.trim()||'Player-'+Math.random().toString(36).slice(2,6);
    document.getElementById('joinModal').style.display='none';
    send({type:'join',name,color:selectedColor});
    document.getElementById('gamewrap').style.display='block';
}

function showJoinModal(){
    document.getElementById('joinModal').style.display='flex';
    buildColorPicker();
    const n=document.getElementById('pname'); if(n) n.focus();
}

// ============ GAME OVER / WINNER ============
function showWinner(wid,scores){
    const w=players[wid]; const wn=w?w.name:'Player';
    const ov=document.getElementById('winov');
    if(ov){ov.style.display='block';ov.textContent='🏆 '+wn+' WINS! 🏆';}
    const go=document.getElementById('go');
    if(go){go.style.display='block';document.getElementById('fscore').textContent=myPlayer?.score||0;}
    isGameOver=true;
    setTimeout(()=>{if(ov)ov.style.display='none';},5000);
}

function gameOver(){
    if(isGameOver) return;
    isGameOver=true;
    const go=document.getElementById('go');
    if(go){go.style.display='block';document.getElementById('fscore').textContent=myPlayer?.score||0;}
}

function respawn(){
    document.getElementById('go').style.display='none';
    document.getElementById('winov').style.display='none';
    isGameOver=false;
    send({type:'respawn'});
}

// ============ CONTROLS ============
function handleKey(k,down){
    if(chatOpen) return;
    k=k.toLowerCase();
    if(k==='a'||k==='arrowleft'){keys.left=down;sendTurn(down,-1);}
    if(k==='d'||k==='arrowright'){keys.right=down;sendTurn(down,1);}
    if(k==='c')toggleCamera();
    if(k==='enter'&&!chatOpen)toggleChat();
}

function sendTurn(down,dir){
    const now=Date.now();
    if(now-lastInput>THROTTLE && myPlayerId){send({type:'turn',direction:down?dir:0});lastInput=now;}
}

function toggleCamera(){cameraMode=cameraMode==='thirdPerson'?'topDown':'thirdPerson';}

function toggleChat(){
    chatOpen=!chatOpen;
    const p=document.getElementById('chatpanel'),b=document.getElementById('chatbtn'),i=document.getElementById('chatinput');
    if(chatOpen){p.style.display='flex';i.focus();b.textContent='💬 Close';b.classList.add('on');}
    else{p.style.display='none';b.textContent='💬 Chat';b.classList.remove('on');}
}

// ============ TOUCH ============
function setupTouch(){
    const L=document.getElementById('tl'),R=document.getElementById('tr');
    const touch=(left,active)=>{if(left)keys.left=active;else keys.right=active;const now=Date.now();if(now-lastInput>THROTTLE&&myPlayerId){send({type:'turn',direction:active?(left?-1:1):0});lastInput=now;}};
    const add=(el,left)=>{el.addEventListener('touchstart',e=>{e.preventDefault();touch(left,true);},{passive:false});el.addEventListener('touchend',e=>{e.preventDefault();touch(left,false);},{passive:false});el.addEventListener('touchcancel',e=>{e.preventDefault();touch(left,false);},{passive:false});el.addEventListener('touchmove',e=>{e.preventDefault();const t=e.touches[0];const tgt=document.elementFromPoint(t.clientX,t.clientY);if(tgt!==el)touch(left,false);},{passive:false});};
    add(L,true);add(R,false);
}

// ============ THREE ============
function initThree(){
    scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0a12);scene.fog=new THREE.Fog(0x0a0a12,40,120);
    camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,0.1,1000);
    renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;document.getElementById('gamewrap').appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff,0.3));
    const sun=new THREE.DirectionalLight(0xffffff,1.2);sun.position.set(100,200,100);sun.castShadow=true;
    sun.shadow.camera.left=-WORLD_SIZE;sun.shadow.camera.right=WORLD_SIZE;sun.shadow.camera.top=WORLD_SIZE;sun.shadow.camera.bottom=-WORLD_SIZE;
    sun.shadow.mapSize.width=2048;sun.shadow.mapSize.height=2048;scene.add(sun);
    // Floor
    const fg=new THREE.PlaneGeometry(WORLD_SIZE,WORLD_SIZE),c=document.createElement('canvas');c.width=512;c.height=512;
    const ctx=c.getContext('2d');ctx.fillStyle='#10182b';ctx.fillRect(0,0,512,512);ctx.strokeStyle='#1e293b';ctx.lineWidth=4;
    for(let i=0;i<=512;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
    const ft=new THREE.CanvasTexture(c);ft.wrapS=ft.wrapT=THREE.RepeatWrapping;ft.repeat.set(WORLD_SIZE/10,WORLD_SIZE/10);
    const fl=new THREE.Mesh(fg,new THREE.MeshPhongMaterial({map:ft}));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;scene.add(fl);
    window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
    setupTouch();
    animate();
}

// ============ ANIMATION ============
function animate(){
    requestAnimationFrame(animate);
    if(!isGameOver && myPlayer?.head){
        if(cameraMode==='thirdPerson'){
            const off=new THREE.Vector3(-Math.sin(myPlayer.dir)*12,7,-Math.cos(myPlayer.dir)*12);
            camera.position.lerp(myPlayer.head.position.clone().add(off),0.1);camera.lookAt(myPlayer.head.position);
        }else{camera.position.lerp(new THREE.Vector3(myPlayer.head.position.x,40,myPlayer.head.position.z),0.1);camera.lookAt(myPlayer.head.position);}
    }
    updLabels();
    const t=Date.now()*0.005;foodMeshes.forEach(m=>{m.position.y=0.4+Math.sin(t+m.position.x*0.1)*0.15;m.rotation.y+=0.03;});pupMeshes.forEach(m=>{m.position.y=0.4+Math.sin(t+m.position.x*0.1)*0.15;m.rotation.y+=0.03;});
    renderer.render(scene,camera);
}

function updLabels(){
    for(const p of Object.values(players)){
        if(p.head && p.lbl && p.slbl){
            p.lbl.position.set(p.head.position.x,p.head.position.y+2.5,p.head.position.z);
            p.slbl.position.set(p.head.position.x,p.head.position.y+1.2,p.head.position.z);
            p.lbl.lookAt(camera.position);p.slbl.lookAt(camera.position);
        }
    }
}

// ============ INIT ============
connect();
document.addEventListener('DOMContentLoaded',()=>{
    initThree();
    showJoinModal();
});

// Globals for HTML onclick
window.pickColor=pickColor;
window.doJoin=doJoin;
window.respawn=respawn;
window.toggleChat=toggleChat;
window.sendChatMsg=sendChatMsg;