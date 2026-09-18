/* =========================================================
   香肠派对 3D · 联机版前端
   ========================================================= */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const TAU=Math.PI*2;

const WORLD_HALF = 200;
const TOTAL_ENEMIES = 18;
const PLAYER_SPEED = 10;
const CAM_DIST = 7.5;
const CAM_HEIGHT = 2.8;
const MAX_PARTICLES = 140;
const MAX_BULLETS = 70;
const SYNC_INTERVAL = 0.08;

const MAPS = {
  green:  { key:'green', name:'绿野仙踪', emoji:'🌳',
    sky:0x8fc7e8, ground:0x4d7c3c, patch1:0x5b8d47, patch2:0x437034,
    treeCount:90, rockCount:35, houseCount:14, obstacleColor:0x6b4b2a },
  desert: { key:'desert', name:'黄沙戈壁', emoji:'🏜️',
    sky:0xf0c890, ground:0xc9a866, patch1:0xd4b479, patch2:0xb8995a,
    treeCount:25, rockCount:70, houseCount:12, obstacleColor:0x8a6b3a },
  snow:   { key:'snow', name:'冰封雪原', emoji:'❄️',
    sky:0xcfd9e6, ground:0xdde6ee, patch1:0xedf3f8, patch2:0xbcc8d6,
    treeCount:55, rockCount:40, houseCount:13, obstacleColor:0x4a5b3a }
};

const WEAPONS = {
  pistol:  {key:'pistol', name:'手枪',    dmg:26, rate:0.26, speed:100, spread:0.012, pellets:1, color:0xFFD23F, desc:'单发 · 中伤害'},
  smg:     {key:'smg',    name:'冲锋枪',  dmg:14, rate:0.075,speed:110, spread:0.030, pellets:1, color:0x7CFFB2, desc:'连发 · 极快射速'},
  shotgun: {key:'shotgun',name:'霰弹枪',  dmg:13, rate:0.70, speed:90,  spread:0.10,  pellets:7, color:0xFF8FA3, desc:'7 弹丸 · 近战秒杀'},
  rifle:   {key:'rifle',  name:'突击步枪',dmg:34, rate:0.19, speed:130, spread:0.008, pellets:1, color:0x8FD8FF, desc:'单发 · 高伤害'},
  sniper:  {key:'sniper', name:'狙击枪',  dmg:95, rate:1.4,  speed:220, spread:0.001, pellets:1, color:0xFF6B35, desc:'一枪爆头 · 极慢射速'}
};

const SKIN_COLORS = [
  {c:0xff6b35,name:'经典橙'},{c:0x7C4DFF,name:'神秘紫'},{c:0xE91E63,name:'活力粉'},
  {c:0x43A047,name:'森林绿'},{c:0x1E88E5,name:'天空蓝'},{c:0x00ACC1,name:'冰霜青'},
  {c:0xFB8C00,name:'熔岩金'},{c:0x9C27B0,name:'梦幻紫红'}
];

const MEDICINES = {
  bandage:{key:'bandage',name:'绷带',emoji:'🩹',heal:25,useTime:1.2,max:5},
  medkit: {key:'medkit', name:'医疗箱',emoji:'💊',heal:75,useTime:2.5,max:2},
  energy: {key:'energy', name:'能量饮料',emoji:'🥤',heal:15,useTime:0.8,max:3}
};

const API = {
  token: localStorage.getItem('sd3d_token') || '',
  user: null,
  async post(url, data){
    const r = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-token':API.token},
      body: JSON.stringify(data)
    });
    return r.json();
  },
  async get(url){
    const r = await fetch(url, { headers:{'x-token':API.token} });
    return r.json();
  }
};

function toast(msg, ms=2200){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('show'), ms);
}

const authScreen = document.getElementById('authScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

document.getElementById('toRegister').onclick = ()=>{
  loginForm.style.display='none';
  registerForm.style.display='flex';
  document.getElementById('authSub').textContent='用 QQ 邮箱注册';
};
document.getElementById('toLogin').onclick = ()=>{
  loginForm.style.display='flex';
  registerForm.style.display='none';
  document.getElementById('authSub').textContent='用 QQ 邮箱登录';
};

let codeTimer = null;
document.getElementById('sendCodeBtn').onclick = async function(){
  const email = document.getElementById('regEmail').value.trim();
  if(!email) return toast('请先填 QQ 邮箱');
  if(!/^[a-zA-Z0-9._-]+@qq\.com$/i.test(email)) return toast('请填正确的 QQ 邮箱');
  this.disabled = true;
  this.textContent = '发送中...';
  const r = await API.post('/api/send-code', { email });
  if(!r.ok){
    toast(r.msg);
    this.disabled = false;
    this.textContent = '获取验证码';
    return;
  }
  toast(r.msg);
  let left = 60;
  this.textContent = left + 's';
  codeTimer = setInterval(()=>{
    left--;
    if(left <= 0){
      clearInterval(codeTimer);
      this.disabled = false;
      this.textContent = '获取验证码';
    } else {
      this.textContent = left + 's';
    }
  }, 1000);
};

document.getElementById('regBtn').onclick = async ()=>{
  const email = document.getElementById('regEmail').value.trim();
  const code = document.getElementById('regCode').value.trim();
  const nickname = document.getElementById('regNick').value.trim();
  const password = document.getElementById('regPass').value;
  const p2 = document.getElementById('regPass2').value;
  if(password !== p2) return toast('两次密码不一致');
  if(password.length < 6) return toast('密码至少 6 位');
  const r = await API.post('/api/register', { email, code, nickname, password });
  if(!r.ok) return toast(r.msg);
  API.token = r.token; API.user = r.user;
  localStorage.setItem('sd3d_token', r.token);
  localStorage.setItem('sd3d_user', JSON.stringify(r.user));
  enterLobby();
};

document.getElementById('loginBtn').onclick = async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;
  if(!email || !password) return toast('请填写邮箱和密码');
  const r = await API.post('/api/login', { email, password });
  if(!r.ok) return toast(r.msg);
  API.token = r.token; API.user = r.user;
  localStorage.setItem('sd3d_token', r.token);
  localStorage.setItem('sd3d_user', JSON.stringify(r.user));
  enterLobby();
};

async function tryAutoLogin(){
  const saved = localStorage.getItem('sd3d_user');
  if(API.token && saved){
    try {
      API.user = JSON.parse(saved);
      const r = await API.get('/api/friends');
      if(r.ok){ enterLobby(); return; }
    } catch(e){}
  }
  authScreen.classList.remove('hidden');
}

const lobbyScreen = document.getElementById('lobbyScreen');
let profile = {
  skinColor:0xff6b35, startWeapon:'pistol', startMap:'green',
  sensitivity:1.0, aimAssist:0.1, volume:0.6
};
let currentMode = 'single';

function enterLobby(){
  authScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  profile = Object.assign(profile, API.user.profile || {});
  initAudio(); resumeAudio();
  renderLobby();
  startLobbyAnimation();
  refreshFriends();
}

function getLevel(kills){
  if(kills<10)return{lv:1,title:'新兵入伍'};
  if(kills<30)return{lv:2,title:'初露锋芒'};
  if(kills<60)return{lv:3,title:'连战连捷'};
  if(kills<100)return{lv:4,title:'沙场老手'};
  if(kills<200)return{lv:5,title:'百战精锐'};
  if(kills<400)return{lv:6,title:'战场传说'};
  return{lv:7,title:'香肠之神'};
}

function renderLobby(){
  const u = API.user;
  document.getElementById('lobbyNick').textContent = u.nickname;
  document.getElementById('previewName').textContent = u.nickname;
  const lvl = getLevel(u.stats.kills || 0);
  document.getElementById('lobbyLevel').textContent = 'Lv.' + lvl.lv;
  document.getElementById('previewLevel').textContent = `Lv.${lvl.lv} · ${lvl.title}`;

  const mg = document.getElementById('mapGrid');
  mg.innerHTML = '';
  for(const k in MAPS){
    const m = MAPS[k];
    const b = document.createElement('button');
    b.className = 'map-card' + (profile.startMap === k ? ' active' : '');
    b.innerHTML = `<span class="emoji">${m.emoji}</span>${m.name}`;
    b.onclick = ()=>{ sfxClick(); profile.startMap=k; saveProfile(); renderLobby(); };
    mg.appendChild(b);
  }

  const wg = document.getElementById('weaponGrid');
  wg.innerHTML = '';
  for(const k in WEAPONS){
    const w = WEAPONS[k];
    const b = document.createElement('button');
    b.className = 'weapon-card' + (profile.startWeapon === k ? ' active' : '');
    b.innerHTML = `<div class="wc-name">${w.name}</div><div class="wc-tag">${w.desc}</div>`;
    b.onclick = ()=>{ sfxClick(); profile.startWeapon=k; saveProfile(); renderLobby(); };
    wg.appendChild(b);
  }

  const cg = document.getElementById('colorGrid');
  cg.innerHTML = '';
  for(const sc of SKIN_COLORS){
    const d = document.createElement('button');
    d.className = 'color-dot' + (profile.skinColor === sc.c ? ' active' : '');
    d.style.background = '#' + sc.c.toString(16).padStart(6,'0');
    d.onclick = ()=>{
      sfxClick(); profile.skinColor = sc.c; saveProfile(); renderLobby();
      if(player && player.bodyMat) player.bodyMat.color.setHex(sc.c);
    };
    cg.appendChild(d);
  }

  document.getElementById('volumeSlider').value = profile.volume;
  document.getElementById('volumeValue').textContent = profile.volume.toFixed(2);
  document.getElementById('sensSlider').value = profile.sensitivity;
  document.getElementById('sensValue').textContent = profile.sensitivity.toFixed(1);
  document.getElementById('aimAssistSlider').value = profile.aimAssist;
  document.getElementById('aimAssistValue').textContent = profile.aimAssist.toFixed(2);
}

async function saveProfile(){
  try { await API.post('/api/profile', { profile }); } catch(e){}
}

document.querySelectorAll('.mode-card').forEach(b=>{
  b.onclick = ()=>{
    sfxClick();
    document.querySelectorAll('.mode-card').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    currentMode = b.dataset.mode;
  };
});

document.querySelectorAll('.tab').forEach(t=>{
  t.onclick = ()=>{
    sfxClick();
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.querySelectorAll('.lobby-panel').forEach(p=>p.classList.add('hidden'));
    document.getElementById('panel-' + tab).classList.remove('hidden');
    if(tab === 'rank') loadLeaderboard();
    if(tab === 'friends') refreshFriends();
  };
});

async function loadLeaderboard(){
  const el = document.getElementById('rankList');
  el.innerHTML = '加载中...';
  const r = await API.get('/api/leaderboard');
  if(!r.ok){ el.innerHTML = '加载失败'; return; }
  el.innerHTML = '';
  r.list.forEach((u, i)=>{
    const d = document.createElement('div');
    d.className = 'rank-row' + (i===0?' top1':i===1?' top2':i===2?' top3':'');
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
    d.innerHTML = `
      <span class="rank-pos">${medal}</span>
      <span class="rank-name">${u.nickname}</span>
      <span class="rank-stat">击杀 ${u.kills} · 吃鸡 ${u.wins}</span>`;
    el.appendChild(d);
  });
  if(!r.list.length) el.innerHTML = '<div style="color:#888;text-align:center;padding:20px">暂无数据</div>';
}

async function refreshFriends(){
  const el = document.getElementById('friendList');
  el.innerHTML = '加载中...';
  const r = await API.get('/api/friends');
  if(!r.ok){ el.innerHTML = '加载失败'; return; }
  el.innerHTML = '';
  if(!r.list.length){
    el.innerHTML = '<div style="color:#888;text-align:center;padding:20px">还没有好友，去添加一个吧</div>';
    return;
  }
  r.list.forEach(f=>{
    const d = document.createElement('div');
    d.className = 'friend-row';
    d.innerHTML = `
      <span class="rank-name">${f.nickname}</span>
      <span class="${f.online?'friend-online':'friend-offline'}">${f.online?'● 在线':'○ 离线'}</span>
      <span class="rank-stat">击杀 ${f.kills}</span>
      <button class="friend-del" data-email="${f.email}">✕</button>`;
    d.querySelector('.friend-del').onclick = async ()=>{
      const r2 = await API.post('/api/friend/remove', { email: f.email });
      if(r2.ok) refreshFriends();
    };
    el.appendChild(d);
  });
}

document.getElementById('addFriendBtn').onclick = async ()=>{
  const email = document.getElementById('friendEmail').value.trim();
  if(!email) return toast('请输入好友邮箱');
  const r = await API.post('/api/friend/add', { email });
  toast(r.msg);
  if(r.ok){
    document.getElementById('friendEmail').value = '';
    refreshFriends();
  }
};

document.getElementById('logoutBtn').onclick = ()=>{
  if(!confirm('退出登录？')) return;
  localStorage.removeItem('sd3d_token');
  localStorage.removeItem('sd3d_user');
  API.token = ''; API.user = null;
  if(ws){ try{ ws.close(); }catch(e){} ws = null; }
  lobbyScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
};

let audioCtx = null, masterGain = null;
let enemyShotCD = 0, hurtCD = 0, zoneCD = 0;

function initAudio(){
  if(audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = profile.volume;
    masterGain.connect(audioCtx.destination);
  } catch(e){}
}
function resumeAudio(){ if(audioCtx && audioCtx.state==='suspended') audioCtx.resume().catch(()=>{}); }
function setVolume(v){ profile.volume = v; if(masterGain) masterGain.gain.value = v; saveProfile(); }

function playNoise(dur,f1,f2,vol){
  if(!audioCtx) return;
  const t = audioCtx.currentTime;
  const sz = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buf = audioCtx.createBuffer(1, sz, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<sz;i++) d[i] = (Math.random()*2-1) * (1-i/sz);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const flt = audioCtx.createBiquadFilter(); flt.type = 'lowpass';
  flt.frequency.setValueAtTime(f1, t);
  flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(masterGain);
  src.start(t); src.stop(t + dur + 0.02);
}
function playTone(f1,f2,dur,vol,type){
  if(!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f1, t);
  if(f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function sfxShoot(k){
  if(!audioCtx) return;
  const cfg = {
    pistol: ()=>{ playNoise(0.09,2200,200,0.5); playTone(180,60,0.09,0.35,'square'); },
    smg:    ()=>{ playNoise(0.05,2600,400,0.35); playTone(220,100,0.05,0.22,'square'); },
    shotgun:()=>{ playNoise(0.18,1400,80,0.7); playTone(120,40,0.18,0.5,'sawtooth'); },
    rifle:  ()=>{ playNoise(0.08,3000,300,0.55); playTone(260,80,0.09,0.4,'square'); },
    sniper: ()=>{ playNoise(0.28,1200,60,0.8); playTone(90,30,0.28,0.6,'sawtooth'); }
  };
  (cfg[k] || cfg.pistol)();
}
function sfxHit(){ if(audioCtx){ playTone(900,700,0.05,0.35,'triangle'); playTone(1400,1000,0.04,0.15,'square'); } }
function sfxHurt(){
  if(!audioCtx || hurtCD>0) return; hurtCD = 0.15;
  playTone(320,90,0.2,0.42,'triangle'); playNoise(0.12,800,200,0.3);
}
function sfxPickup(h){
  if(!audioCtx) return;
  if(h){ playTone(500,900,0.12,0.35); setTimeout(()=>playTone(900,1300,0.12,0.3),80); }
  else { playTone(400,700,0.1,0.35,'square'); setTimeout(()=>playTone(700,1100,0.13,0.3,'square'),90); }
}
function sfxKill(){ if(audioCtx) [523,659,784].forEach((n,i)=>setTimeout(()=>playTone(n,n,0.12,0.35), i*90)); }
function sfxZone(){ if(!audioCtx||zoneCD>0) return; zoneCD=0.9; playTone(200,140,0.28,0.18,'sawtooth'); }
function sfxClick(){ if(audioCtx){ resumeAudio(); playTone(900,700,0.04,0.22,'square'); } }
function sfxWin(){ if(audioCtx) [523,659,784,1047].forEach((n,i)=>setTimeout(()=>playTone(n,n,0.25,0.4), i*130)); }
function sfxLose(){ if(audioCtx){ playTone(400,200,0.32,0.42,'triangle'); setTimeout(()=>playTone(280,130,0.42,0.42,'triangle'),220); } }
function sfxDoor(){ if(audioCtx){ playNoise(0.15,600,200,0.35); playTone(180,120,0.15,0.25,'sawtooth'); } }


/* ================= 大厅角色预览 ================= */
const lobbyCanvas = document.getElementById('lobbyCanvas');
const lobbyCtx = lobbyCanvas.getContext('2d');
let lobbyActive = false, lobbyRAF = null;

function resizeLobbyCanvas(){
  const rect = lobbyCanvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  lobbyCanvas.width = Math.floor(rect.width * dpr);
  lobbyCanvas.height = Math.floor(rect.height * dpr);
  lobbyCtx.setTransform(dpr,0,0,dpr,0,0);
}
function drawLobbySausage(t){
  const rect = lobbyCanvas.getBoundingClientRect();
  const w = rect.width || lobbyCanvas.width;
  const h = rect.height || lobbyCanvas.height;
  lobbyCtx.clearRect(0,0,w,h);
  const cx = w/2, cy = h/2;
  const scale = Math.min(w,h)/280;
  const bob = Math.sin(t*0.0022)*5, tilt = Math.sin(t*0.0016)*0.045;

  const halo = lobbyCtx.createRadialGradient(cx,cy+10,20,cx,cy+10,Math.min(w,h)*0.55);
  halo.addColorStop(0,'rgba(255,107,53,0.22)');
  halo.addColorStop(1,'rgba(255,107,53,0)');
  lobbyCtx.fillStyle = halo; lobbyCtx.fillRect(0,0,w,h);

  lobbyCtx.save();
  lobbyCtx.translate(cx, cy+bob);
  lobbyCtx.scale(scale, scale);
  lobbyCtx.rotate(tilt);

  lobbyCtx.beginPath();
  lobbyCtx.ellipse(0,110,72,16,0,0,TAU);
  lobbyCtx.fillStyle = 'rgba(0,0,0,0.35)'; lobbyCtx.fill();

  const bc = profile.skinColor;
  const r = (bc>>16)&255, g = (bc>>8)&255, b = bc&255;
  const grd = lobbyCtx.createRadialGradient(-25,-45,10,0,0,115);
  grd.addColorStop(0, `rgba(${Math.min(255,r+80)},${Math.min(255,g+80)},${Math.min(255,b+80)},1)`);
  grd.addColorStop(0.5, `rgb(${r},${g},${b})`);
  grd.addColorStop(1, `rgba(${Math.max(0,r-60)},${Math.max(0,g-60)},${Math.max(0,b-60)},1)`);

  lobbyCtx.beginPath();
  lobbyCtx.ellipse(0,0,75,95,0,0,TAU);
  lobbyCtx.fillStyle = grd; lobbyCtx.fill();
  lobbyCtx.lineWidth = 4; lobbyCtx.strokeStyle = 'rgba(0,0,0,0.28)'; lobbyCtx.stroke();

  lobbyCtx.beginPath();
  lobbyCtx.ellipse(-26,-42,26,18,-0.5,0,TAU);
  lobbyCtx.fillStyle = 'rgba(255,255,255,0.32)'; lobbyCtx.fill();

  const bp = (t*0.0009)%1;
  const bl = bp>0.94 ? Math.max(0, 1-(bp-0.94)/0.06*2) : 1;
  for(const sx of [-1,1]){
    lobbyCtx.beginPath();
    lobbyCtx.ellipse(sx*28,-18,17,17*bl,0,0,TAU);
    lobbyCtx.fillStyle = '#fff'; lobbyCtx.fill();
    if(bl>0.3){
      const look = Math.sin(t*0.0009)*2.5;
      lobbyCtx.beginPath();
      lobbyCtx.arc(sx*28+look,-18,9*bl,0,TAU);
      lobbyCtx.fillStyle = '#1B2A4A'; lobbyCtx.fill();
      lobbyCtx.beginPath();
      lobbyCtx.arc(sx*28+look-2.5,-21.5,3*bl,0,TAU);
      lobbyCtx.fillStyle = '#fff'; lobbyCtx.fill();
    }
  }
  for(const sx of [-1,1]){
    lobbyCtx.beginPath();
    lobbyCtx.ellipse(sx*48,12,15,8.5,0,0,TAU);
    lobbyCtx.fillStyle = 'rgba(255,140,160,0.55)'; lobbyCtx.fill();
  }
  lobbyCtx.beginPath();
  lobbyCtx.arc(0,18,17,0.15*Math.PI,0.85*Math.PI);
  lobbyCtx.lineWidth = 4.5; lobbyCtx.strokeStyle = '#fff';
  lobbyCtx.lineCap = 'round'; lobbyCtx.stroke();

  lobbyCtx.save();
  lobbyCtx.translate(72,0); lobbyCtx.rotate(-0.08);
  lobbyCtx.fillStyle = '#2a3038'; lobbyCtx.fillRect(-8,-11,72,22);
  lobbyCtx.fillStyle = '#454d56'; lobbyCtx.fillRect(-8,-11,26,22);
  lobbyCtx.fillStyle = '#555c66'; lobbyCtx.fillRect(64,-7,18,14);
  lobbyCtx.restore();

  lobbyCtx.restore();
}
function lobbyLoop(t){
  if(!lobbyActive) return;
  drawLobbySausage(t);
  lobbyRAF = requestAnimationFrame(lobbyLoop);
}
function startLobbyAnimation(){
  lobbyActive = true; resizeLobbyCanvas();
  if(lobbyRAF) cancelAnimationFrame(lobbyRAF);
  lobbyRAF = requestAnimationFrame(lobbyLoop);
}
function stopLobbyAnimation(){
  lobbyActive = false;
  if(lobbyRAF){ cancelAnimationFrame(lobbyRAF); lobbyRAF = null; }
}

/* ================= 3D 游戏核心 ================= */
let state = 'auth';
let scene, camera, renderer;
let playerGroup, playerMuzzle;
let player = {
  hp:100, maxHp:100, weapon:WEAPONS.pistol, cool:0, dead:false, bodyMat:null,
  meds:{bandage:2, medkit:1, energy:1}, usingMed:null, useTimer:0
};
let enemies=[], bullets=[], particles=[], pickups=[], obstacles=[], houses=[];
let remotePlayers = {};
let camYaw=0, camPitch=0.18;
let mouseDown=false;
const keys={};
let gameTime=0, kills=0, winFlag=false;
let zone = { radius:WORLD_HALF*1.35, targetRadius:WORLD_HALF*0.55, timer:16 };
let zoneMesh, zoneRing;
let isLocked=false, isOnMobile='ontouchstart' in window;
let lastTime = performance.now();
let mtMove=null, mtAim=null;
let currentMap='green';
let nearDoorHouse=null;
let isOnlineMode=false;

const SG = {
  bodyCyl:new THREE.CylinderGeometry(0.42,0.42,0.78,12),
  bodySph:new THREE.SphereGeometry(0.42,12,8),
  eyeW:new THREE.SphereGeometry(0.125,8,6),
  eyeB:new THREE.SphereGeometry(0.062,6,6),
  blush:new THREE.CircleGeometry(0.1,10),
  gunB:new THREE.BoxGeometry(0.16,0.19,0.78),
  gunT:new THREE.BoxGeometry(0.09,0.09,0.22),
  bullet:new THREE.SphereGeometry(0.13,5,5),
  particle:new THREE.SphereGeometry(0.13,5,5),
  pickup:new THREE.TorusGeometry(0.42,0.14,6,12),
  rock:new THREE.DodecahedronGeometry(1,0),
  treeLeaf:new THREE.SphereGeometry(1,8,6),
  treeTrunk:new THREE.CylinderGeometry(0.35,0.5,1,7),
  houseBox:new THREE.BoxGeometry(1,1,1)
};

const matCache = new Map();
function getBasicMat(color){
  let m = matCache.get(color);
  if(!m){ m = new THREE.MeshBasicMaterial({color}); matCache.set(color, m); }
  return m;
}

function initThree(){
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 700);
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  document.body.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x556b44, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(80, 140, 60);
  scene.add(sun);
}

function disposeScene(){
  if(!scene) return;
  for(let i=scene.children.length-1;i>=0;i--){
    const c = scene.children[i];
    if(c.isLight) continue;
    scene.remove(c);
  }
}

function buildWorld(mapKey){
  currentMap = mapKey;
  const M = MAPS[mapKey] || MAPS.green;
  scene.background = new THREE.Color(M.sky);
  scene.fog = new THREE.Fog(M.sky, 120, 340);

  const groundMat = new THREE.MeshLambertMaterial({ color:M.ground });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF*2, WORLD_HALF*2), groundMat);
  ground.rotation.x = -Math.PI/2;
  scene.add(ground);

  const patch1 = new THREE.MeshLambertMaterial({ color:M.patch1 });
  const patch2 = new THREE.MeshLambertMaterial({ color:M.patch2 });
  for(let i=0;i<70;i++){
    const s = rand(8, 24);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s,s), Math.random()<0.5?patch1:patch2);
    m.rotation.x = -Math.PI/2;
    m.position.set(rand(-WORLD_HALF,WORLD_HALF), 0.01, rand(-WORLD_HALF,WORLD_HALF));
    scene.add(m);
  }

  const poleMat = new THREE.MeshLambertMaterial({ color:0xcc3333 });
  for(let i=-WORLD_HALF;i<=WORLD_HALF;i+=16){
    for(const [x,z] of [[i,-WORLD_HALF],[i,WORLD_HALF],[-WORLD_HALF,i],[WORLD_HALF,i]]){
      const p = new THREE.Mesh(SG.treeTrunk, poleMat);
      p.scale.y = 4; p.position.set(x, 2, z); scene.add(p);
    }
  }

  obstacles = [];
  const trunkMat = new THREE.MeshLambertMaterial({ color:M.obstacleColor });
  const leafMats = [
    new THREE.MeshLambertMaterial({ color: mapKey==='snow'?0x2a4a3a:0x3d7a2e }),
    new THREE.MeshLambertMaterial({ color: mapKey==='snow'?0x3a5a4a:0x4f8c3a }),
    new THREE.MeshLambertMaterial({ color: mapKey==='snow'?0x1a3a2a:0x2f6324 })
  ];
  const rockMat = new THREE.MeshLambertMaterial({
    color: mapKey==='desert'?0xb8995a:mapKey==='snow'?0xa8b8c8:0x8a8f94,
    flatShading:true
  });

  for(let i=0;i<M.treeCount;i++){
    const x = rand(-WORLD_HALF+10, WORLD_HALF-10);
    const z = rand(-WORLD_HALF+10, WORLD_HALF-10);
    if(Math.hypot(x,z) < 15) continue;
    const th = rand(3,6);
    const trunk = new THREE.Mesh(SG.treeTrunk, trunkMat);
    trunk.scale.y = th; trunk.position.set(x, th/2, z); scene.add(trunk);
    const lr = rand(1.7,2.8);
    const leaves = new THREE.Mesh(SG.treeLeaf, pick(leafMats));
    leaves.scale.setScalar(lr);
    leaves.position.set(x, th + lr*0.55, z); scene.add(leaves);
    obstacles.push({ x, z, r:0.9 });
  }
  for(let i=0;i<M.rockCount;i++){
    const x = rand(-WORLD_HALF+10, WORLD_HALF-10);
    const z = rand(-WORLD_HALF+10, WORLD_HALF-10);
    if(Math.hypot(x,z) < 15) continue;
    const r = rand(0.9, 2.4);
    const rock = new THREE.Mesh(SG.rock, rockMat);
    rock.scale.setScalar(r); rock.position.set(x, r*0.6, z);
    rock.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    scene.add(rock);
    obstacles.push({ x, z, r:r*0.85 });
  }

  houses = [];
  const wallMat = new THREE.MeshLambertMaterial({
    color: mapKey==='desert'?0xd4b479:mapKey==='snow'?0xedf3f8:0xe8d8b8
  });
  const roofMat = new THREE.MeshLambertMaterial({
    color: mapKey==='desert'?0xa86b3a:mapKey==='snow'?0x8a4a4a:0x8a4a3a
  });
  const doorMat = new THREE.MeshLambertMaterial({ color:0x8a5a2a });
  const doorMatOpen = new THREE.MeshLambertMaterial({
    color:0x8a5a2a, transparent:true, opacity:0.28
  });

  for(let i=0;i<M.houseCount;i++){
    let hx, hz, tries = 0;
    do {
      hx = rand(-WORLD_HALF+30, WORLD_HALF-30);
      hz = rand(-WORLD_HALF+30, WORLD_HALF-30);
      tries++;
    } while(Math.hypot(hx,hz) < 30 && tries < 25);

    const W = rand(9,14), D = rand(9,14), H = rand(4.5,6);
    const g = new THREE.Group();
    g.position.set(hx, 0, hz);
    g.rotation.y = rand(0, TAU);
    const rot = g.rotation.y;

    const wallThick = 0.4, wallH = H;

    const wBack = new THREE.Mesh(SG.houseBox, wallMat);
    wBack.scale.set(W, wallH, wallThick);
    wBack.position.set(0, wallH/2, -D/2); g.add(wBack);

    const wLeft = new THREE.Mesh(SG.houseBox, wallMat);
    wLeft.scale.set(wallThick, wallH, D);
    wLeft.position.set(-W/2, wallH/2, 0); g.add(wLeft);

    const wRight = new THREE.Mesh(SG.houseBox, wallMat);
    wRight.scale.set(wallThick, wallH, D);
    wRight.position.set(W/2, wallH/2, 0); g.add(wRight);

    const doorW = 3.2;
    const sideW = (W - doorW) / 2;
    const wFrontL = new THREE.Mesh(SG.houseBox, wallMat);
    wFrontL.scale.set(sideW, wallH, wallThick);
    wFrontL.position.set(-(doorW/2 + sideW/2), wallH/2, D/2); g.add(wFrontL);

    const wFrontR = new THREE.Mesh(SG.houseBox, wallMat);
    wFrontR.scale.set(sideW, wallH, wallThick);
    wFrontR.position.set(doorW/2 + sideW/2, wallH/2, D/2); g.add(wFrontR);

    const wTop = new THREE.Mesh(SG.houseBox, wallMat);
    wTop.scale.set(doorW, wallH*0.28, wallThick);
    wTop.position.set(0, wallH - wallH*0.28/2, D/2); g.add(wTop);

    const roof = new THREE.Mesh(SG.houseBox, roofMat);
    roof.scale.set(W + 1, 0.5, D + 1);
    roof.position.set(0, wallH + 0.25, 0); g.add(roof);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-doorW/2, 0, D/2);
    const doorMesh = new THREE.Mesh(SG.houseBox, doorMat);
    doorMesh.scale.set(doorW - 0.2, wallH * 0.7, 0.18);
    doorMesh.position.set((doorW-0.2)/2, wallH * 0.35, 0);
    doorPivot.add(doorMesh);
    g.add(doorPivot);

    scene.add(g);

    houses.push({
      x: hx, z: hz, W, D, H, rot,
      doorPivot, doorMesh, doorMat, doorMatOpen,
      isOpen: false, doorW,
      worldWalls: [
        { lx:0, lz:-D/2, sw:W, sh:0.4 },
        { lx:-W/2, lz:0, sw:0.4, sh:D },
        { lx:W/2, lz:0, sw:0.4, sh:D },
        { lx:-(doorW/2 + sideW/2), lz:D/2, sw:sideW, sh:0.4 },
        { lx:doorW/2 + sideW/2, lz:D/2, sw:sideW, sh:0.4 }
      ]
    });
  }

  const zoneMat = new THREE.MeshBasicMaterial({
    color:0xff3388, transparent:true, opacity:0.16,
    side:THREE.DoubleSide, depthWrite:false
  });
  zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1,1,30,48,1,true), zoneMat);
  zoneMesh.position.y = 15; scene.add(zoneMesh);

  const zoneMat2 = new THREE.MeshBasicMaterial({
    color:0xff5599, transparent:true, opacity:0.55,
    side:THREE.DoubleSide, depthWrite:false, wireframe:true
  });
  zoneRing = new THREE.Mesh(new THREE.CylinderGeometry(1.01,1.01,30,48,1,true), zoneMat2);
  zoneRing.position.y = 15; scene.add(zoneRing);
  updateZoneVisual();
}

function createSausage(color){
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  g.add(new THREE.Mesh(SG.bodyCyl, bodyMat));
  const top = new THREE.Mesh(SG.bodySph, bodyMat); top.position.y = 0.39; g.add(top);
  const bot = new THREE.Mesh(SG.bodySph, bodyMat); bot.position.y = -0.39; g.add(bot);

  const eyeW = new THREE.MeshBasicMaterial({ color:0xffffff });
  const eyeB = new THREE.MeshBasicMaterial({ color:0x1a2440 });
  const blush = new THREE.MeshBasicMaterial({
    color:0xff8fa3, transparent:true, opacity:0.55, side:THREE.DoubleSide
  });

  for(const sx of [-1,1]){
    const w = new THREE.Mesh(SG.eyeW, eyeW);
    w.position.set(sx*0.175, 0.19, 0.34); g.add(w);
    const b = new THREE.Mesh(SG.eyeB, eyeB);
    b.position.set(sx*0.175, 0.19, 0.44); g.add(b);
  }
  for(const sx of [-1,1]){
    const b = new THREE.Mesh(SG.blush, blush);
    b.position.set(sx*0.33, 0, 0.32);
    b.rotation.y = sx*0.65; g.add(b);
  }
  const gun = new THREE.Group();
  const gunBody = new THREE.MeshLambertMaterial({ color:0x2a3038 });
  const gunTip = new THREE.MeshLambertMaterial({ color:0x555c66 });
  const gb = new THREE.Mesh(SG.gunB, gunBody); gb.position.z = 0.30; gun.add(gb);
  const gt = new THREE.Mesh(SG.gunT, gunTip); gt.position.z = 0.79; gun.add(gt);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 0.95; gun.add(muzzle);
  gun.position.set(0.52, 0.02, 0.24); g.add(gun);

  return { group:g, gun, muzzle, bodyMat };
}

function createPlayer(){
  const p = createSausage(profile.skinColor);
  playerGroup = p.group;
  playerMuzzle = p.muzzle;
  player.bodyMat = p.bodyMat;
  playerGroup.position.set(0, 0.8, 0);
  scene.add(playerGroup);
}

function createEnemy(x, z){
  const color = pick([0x7C4DFF,0xE91E63,0x43A047,0x1E88E5,0xFB8C00,0x00ACC1,0x9C27B0]);
  const p = createSausage(color);
  p.group.position.set(x, 0.8, z);
  scene.add(p.group);

  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 10;
  const tex = new THREE.CanvasTexture(cv);
  const spMat = new THREE.SpriteMaterial({ map:tex, depthTest:false, transparent:true });
  const sprite = new THREE.Sprite(spMat);
  sprite.scale.set(1.5, 0.24, 1);
  sprite.position.y = 1.85;
  sprite.visible = false;
  p.group.add(sprite);

  enemies.push({
    group:p.group, gun:p.gun, muzzle:p.muzzle, bodyMat:p.bodyMat,
    baseColor:new THREE.Color(color),
    hp:68, maxHp:68, speed:rand(3.5, 5.5),
    cool:rand(0.5,1.5), fireRate:rand(1.1,2.0), damage:rand(6,11),
    color, dead:false, hitFlash:0,
    target:null, retargetTimer:rand(0.5,2),
    hpCtx:cv.getContext('2d'), hpTexture:tex, hpSprite:sprite
  });
}

function updateEnemyHpBar(e){
  const c = e.hpCtx;
  c.clearRect(0,0,64,10);
  c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(0,2,64,6);
  const pct = clamp(e.hp/e.maxHp, 0, 1);
  c.fillStyle = pct > 0.4 ? '#4ECB71' : '#FF5252';
  c.fillRect(1, 3, 62*pct, 4);
  e.hpTexture.needsUpdate = true;
  e.hpSprite.visible = e.hp < e.maxHp;
}

function clearGameObjects(){
  for(const e of enemies) scene.remove(e.group);
  enemies = [];
  for(const b of bullets) scene.remove(b.mesh);
  bullets = [];
  for(const p of particles) scene.remove(p.mesh);
  particles = [];
  for(const p of pickups) scene.remove(p.mesh);
  pickups = [];
  for(const id in remotePlayers){
    scene.remove(remotePlayers[id].group);
  }
  remotePlayers = {};
}

function resetGame(){
  clearGameObjects();

  player.hp = player.maxHp;
  player.weapon = WEAPONS[profile.startWeapon] || WEAPONS.pistol;
  player.cool = 0; player.dead = false;
  player.meds = { bandage:2, medkit:1, energy:1 };
  player.usingMed = null; player.useTimer = 0;
  playerGroup.position.set(0, 0.8, 0);
  playerGroup.visible = true;
  player.bodyMat.color.setHex(profile.skinColor);

  camYaw = 0; camPitch = 0.18;

  if(!isOnlineMode){
    for(let i=0;i<TOTAL_ENEMIES;i++){
      const a = Math.random()*TAU;
      const d = rand(30, 130);
      let ex, ez, tries = 0;
      do {
        ex = clamp(Math.cos(a)*d, -WORLD_HALF+8, WORLD_HALF-8);
        ez = clamp(Math.sin(a)*d, -WORLD_HALF+8, WORLD_HALF-8);
        tries++;
      } while(pointInAnyHouse(ex, ez) && tries < 20);
      createEnemy(ex, ez);
    }
  }

  zone.radius = WORLD_HALF * 1.35;
  zone.targetRadius = WORLD_HALF * 0.55;
  zone.timer = 16;
  updateZoneVisual();

  gameTime = 0; kills = 0; winFlag = false;
  renderMedsBar();
  updateHUD(true);
}

function pointInAnyHouse(x,z){
  for(const h of houses){
    const dx = x - h.x, dz = z - h.z;
    const c = Math.cos(-h.rot), s = Math.sin(-h.rot);
    const lx = dx*c - dz*s, lz = dx*s + dz*c;
    if(Math.abs(lx) < h.W/2 + 0.5 && Math.abs(lz) < h.D/2 + 0.5) return true;
  }
  return false;
}

function resolveCollision(nx, nz, radius){
  for(const o of obstacles){
    const dx = nx - o.x, dz = nz - o.z;
    const d = Math.hypot(dx, dz);
    const minD = o.r + radius;
    if(d < minD && d > 0.001){
      nx = o.x + (dx/d)*minD;
      nz = o.z + (dz/d)*minD;
    }
  }
  for(const h of houses){
    const dx = nx - h.x, dz = nz - h.z;
    const c = Math.cos(-h.rot), s = Math.sin(-h.rot);
    let lx = dx*c - dz*s, lz = dx*s + dz*c;
    let hit = false;
    for(const w of h.worldWalls){
      const wx = w.lx, wz = w.lz, sw = w.sw, sh = w.sh;
      const closestX = clamp(lx, wx-sw/2, wx+sw/2);
      const closestZ = clamp(lz, wz-sh/2, wz+sh/2);
      const ddx = lx - closestX, ddz = lz - closestZ;
      const dd = Math.hypot(ddx, ddz);
      if(dd < radius && dd > 0.001){
        lx = closestX + (ddx/dd)*radius;
        lz = closestZ + (ddz/dd)*radius;
        hit = true;
      }
    }
    if(!h.isOpen){
      const doorW = h.doorW;
      const wx = 0, wz = h.D/2;
      const closestX = clamp(lx, -doorW/2, doorW/2);
      const closestZ = clamp(lz, wz-0.2, wz+0.2);
      const ddx = lx - closestX, ddz = lz - closestZ;
      const dd = Math.hypot(ddx, ddz);
      if(dd < radius && dd > 0.001){
        lx = closestX + (ddx/dd)*radius;
        lz = closestZ + (ddz/dd)*radius;
        hit = true;
      }
    }
    if(hit){
      const cc = Math.cos(h.rot), ss = Math.sin(h.rot);
      nx = h.x + lx*cc - lz*ss;
      nz = h.z + lx*ss + lz*cc;
    }
  }
  return { nx, nz };
}

function checkNearDoor(){
  nearDoorHouse = null;
  if(!playerGroup) return;
  const px = playerGroup.position.x;
  const pz = playerGroup.position.z;
  for(const h of houses){
    const doorLocalX = 0;
    const doorLocalZ = h.D/2;
    const cc = Math.cos(h.rot), ss = Math.sin(h.rot);
    const doorX = h.x + doorLocalX*cc - doorLocalZ*ss;
    const doorZ = h.z + doorLocalX*ss + doorLocalZ*cc;
    const d = Math.hypot(px - doorX, pz - doorZ);
    if(d < 2.8){
      nearDoorHouse = h;
      return;
    }
  }
}

function toggleDoor(){
  if(!nearDoorHouse) return;
  const h = nearDoorHouse;
  h.isOpen = !h.isOpen;
  h.doorMesh.material = h.isOpen ? h.doorMatOpen : h.doorMat;
  const targetRot = h.isOpen ? -Math.PI/2 : 0;
  h._doorTargetRot = targetRot;
  sfxDoor();
  showPop(h.isOpen ? '门已打开' : '门已关闭');
}

function applyAimAssist(dir, startPos){
  const strength = profile.aimAssist;
  if(strength <= 0) return dir;
  let best = null, bestDot = 0.92, bestDist = 80*80;
  for(const e of enemies){
    if(e.dead) continue;
    const dx = e.group.position.x - startPos.x;
    const dy = (e.group.position.y + 0.2) - startPos.y;
    const dz = e.group.position.z - startPos.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    if(d2 > bestDist) continue;
    const len = Math.sqrt(d2) || 1;
    const ndx = dx/len, ndy = dy/len, ndz = dz/len;
    const dot = ndx*dir.x + ndy*dir.y + ndz*dir.z;
    if(dot < bestDot) continue;
    bestDot = dot; bestDist = d2;
    best = { x:ndx, y:ndy, z:ndz };
  }
  if(best){
    dir.x += (best.x - dir.x) * strength;
    dir.y += (best.y - dir.y) * strength;
    dir.z += (best.z - dir.z) * strength;
    dir.normalize();
  }
  return dir;
}

function firePlayerWeapon(){
  const w = player.weapon;
  player.cool = w.rate;
  sfxShoot(w.key);

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const startPos = camera.position.clone().addScaledVector(camDir, CAM_DIST*0.85);

  for(let i=0;i<w.pellets;i++){
    const dir = camDir.clone();
    dir.x += rand(-w.spread, w.spread);
    dir.y += rand(-w.spread, w.spread);
    dir.z += rand(-w.spread, w.spread);
    dir.normalize();
    applyAimAssist(dir, startPos);
    spawnBullet(startPos.clone(), dir, w.speed, w.dmg, w.color, 'player', null);
  }
  const mp = new THREE.Vector3();
  playerMuzzle.getWorldPosition(mp);
  spawnParticles(mp, w.color, 3, 4);

  if(isOnlineMode && ws && ws.readyState === 1){
    ws.send(JSON.stringify({
      type:'shoot',
      x: playerGroup.position.x,
      z: playerGroup.position.z,
      ang: camYaw,
      weapon: w.key
    }));
  }
}

function spawnBullet(pos, dir, speed, dmg, color, owner, shooter){
  if(bullets.length >= MAX_BULLETS) return;
  const mesh = new THREE.Mesh(SG.bullet, getBasicMat(color));
  mesh.position.copy(pos);
  scene.add(mesh);
  bullets.push({ mesh, dir:dir.clone(), speed, dmg, owner, shooter, life:1.6 });
}

function enemyFire(e){
  const mp = new THREE.Vector3();
  e.muzzle.getWorldPosition(mp);
  const tp = e.target.obj.position.clone();
  tp.y += 0.8; tp.x += rand(-1.2,1.2); tp.z += rand(-1.2,1.2);
  const dir = tp.sub(mp).normalize();
  dir.x += rand(-0.04,0.04); dir.y += rand(-0.04,0.04); dir.z += rand(-0.04,0.04);
  dir.normalize();
  spawnBullet(mp, dir, 75, e.damage, 0xff5252, 'enemy', e);
}

function spawnParticles(pos, color, count, speed){
  if(particles.length >= MAX_PARTICLES) return;
  const mat = getBasicMat(color);
  for(let i=0;i<count;i++){
    if(particles.length >= MAX_PARTICLES) break;
    const m = new THREE.Mesh(SG.particle, mat);
    m.position.copy(pos);
    scene.add(m);
    const a = Math.random()*TAU;
    const el = Math.random()*Math.PI - Math.PI/2;
    const sp = speed * rand(0.4, 1.2);
    particles.push({
      mesh:m,
      vel:new THREE.Vector3(
        Math.cos(a)*Math.cos(el)*sp,
        Math.sin(el)*sp + rand(1,3),
        Math.sin(a)*Math.cos(el)*sp
      ),
      life:rand(0.25, 0.5), maxLife:0.5
    });
  }
}

function spawnPickup(x, z, forcedType, forcedData){
  const isMed = forcedType === 'med' || (!forcedType && Math.random() < 0.4);
  const isHealth = forcedType === 'health' || (!forcedType && !isMed && Math.random() < 0.5);

  let color, type, data;
  if(isMed){
    const mk = forcedData || pick(['bandage','medkit','energy']);
    color = mk==='medkit'?0x4ECB71:mk==='energy'?0x00ACC1:0xFFD23F;
    type = 'med'; data = mk;
  } else if(isHealth){
    color = 0x4ECB71; type = 'health';
  } else {
    const wk = forcedData || pick(['smg','shotgun','rifle','sniper','pistol']);
    const w = WEAPONS[wk];
    color = w.color; type = 'weapon'; data = wk;
  }

  const mat = new THREE.MeshLambertMaterial({ color, emissive:color, emissiveIntensity:0.4 });
  const m = new THREE.Mesh(SG.pickup, mat);
  m.position.set(x, 0.7, z); m.rotation.x = Math.PI/2;
  scene.add(m);
  pickups.push({ mesh:m, x, z, type, data, bob:Math.random()*TAU });
}

let hurtCooldown = 0;
function damagePlayer(amount, flash){
  if(state !== 'playing' || player.dead) return;
  player.hp -= amount;
  if(flash){
    if(hurtCooldown <= 0){ hurtCooldown = 0.18; flashHurt(); }
    sfxHurt();
  }
  if(player.hp <= 0){
    player.hp = 0;
    player.dead = true;
    playerGroup.visible = false;
    if(isOnlineMode && ws && ws.readyState === 1){
      ws.send(JSON.stringify({ type:'die' }));
    }
    endGame(false);
  }
}

function damageEnemy(e, amount, byPlayer){
  if(e.dead) return;
  e.hp -= amount;
  e.hitFlash = 0.1;
  updateEnemyHpBar(e);
  if(byPlayer) sfxHit();
  if(e.hp <= 0) killEnemy(e, byPlayer);
}

function killEnemy(e, byPlayer){
  if(e.dead) return;
  e.dead = true;
  spawnParticles(e.group.position.clone().setY(0.9), e.color, 10, 6);
  spawnParticles(e.group.position.clone().setY(0.9), 0xffffff, 5, 4);
  if(byPlayer){ kills++; showPop('淘汰！'); hitMarker(); sfxKill(); }
  if(Math.random() < 0.85){
    if(Math.random() < 0.55) spawnPickup(e.group.position.x, e.group.position.z, 'med');
    else spawnPickup(e.group.position.x, e.group.position.z, 'weapon');
  }
  scene.remove(e.group);
}

function renderMedsBar(){
  const bar = document.getElementById('medsBar');
  bar.innerHTML = '';
  const keys2 = ['bandage','medkit','energy'];
  const hints = { bandage:'1', medkit:'2', energy:'3' };
  keys2.forEach(k=>{
    const md = MEDICINES[k];
    const cnt = player.meds[k] || 0;
    const div = document.createElement('div');
    div.className = 'med-slot';
    if(cnt <= 0) div.style.opacity = '0.35';
    div.innerHTML = `<span class="icon">${md.emoji}</span><span class="cnt">${cnt}</span>
      <span class="k">${hints[k]}</span>`;
    div.onclick = ()=>useMedicine(k);
    bar.appendChild(div);
  });
}
function useMedicine(k){
  if(state !== 'playing' || player.dead) return;
  if(player.usingMed){ showPop('正在使用中'); return; }
  const cnt = player.meds[k] || 0;
  if(cnt <= 0){ showPop('没有' + MEDICINES[k].name); return; }
  if(player.hp >= player.maxHp){ showPop('血量已满'); return; }
  player.meds[k]--;
  const md = MEDICINES[k];
  player.usingMed = k; player.useTimer = md.useTime;
  showPop('使用' + md.name);
}
function finishMedicine(){
  const k = player.usingMed;
  if(!k) return;
  const md = MEDICINES[k];
  player.hp = Math.min(player.maxHp, player.hp + md.heal);
  player.usingMed = null;
  renderMedsBar();
  showPop('+' + md.heal + ' HP');
}

function updatePlayer(dt){
  if(player.dead) return;
  const speedMult = player.usingMed ? 0.45 : 1;

  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let ix = 0, iz = 0;
  if(keys['w']||keys['arrowup']){ ix += fx; iz += fz; }
  if(keys['s']||keys['arrowdown']){ ix -= fx; iz -= fz; }
  if(keys['d']||keys['arrowright']){ ix += rx; iz += rz; }
  if(keys['a']||keys['arrowleft']){ ix -= rx; iz -= rz; }

  if(mtMove){
    const dx = mtMove.cx - mtMove.sx, dy = mtMove.cy - mtMove.sy;
    const len = Math.hypot(dx,dy);
    if(len > 8){
      const m = Math.min(1, len/55);
      const nx = (dx/len)*m, ny = (dy/len)*m;
      ix += rx*nx + fx*(-ny);
      iz += rz*nx + fz*(-ny);
    }
  }
  const len = Math.hypot(ix, iz);
  if(len > 1){ ix /= len; iz /= len; }

  let speed = PLAYER_SPEED * speedMult;
  if(keys['shift']) speed *= 1.55;

  if(len > 0.02){
    let nx = playerGroup.position.x + ix*speed*dt;
    let nz = playerGroup.position.z + iz*speed*dt;
    const r = resolveCollision(nx, nz, 0.6);
    nx = clamp(r.nx, -WORLD_HALF+2, WORLD_HALF-2);
    nz = clamp(r.nz, -WORLD_HALF+2, WORLD_HALF-2);
    playerGroup.position.x = nx;
    playerGroup.position.z = nz;
  }
  playerGroup.rotation.y = camYaw;

  if(player.usingMed){
    player.useTimer -= dt;
    if(player.useTimer <= 0) finishMedicine();
  }

  checkNearDoor();
  const doorTip = document.getElementById('doorTip');
  if(nearDoorHouse){
    doorTip.textContent = nearDoorHouse.isOpen ? '按 E 关门' : '按 E 开门';
    doorTip.style.color = '#FFD23F';
  } else {
    doorTip.textContent = '按住左键开火';
    doorTip.style.color = '';
  }

  if(profile.aimAssist > 0 && !player.dead && !player.usingMed){
    const strength = profile.aimAssist;
    const px = playerGroup.position.x, pz = playerGroup.position.z;
    let bestYaw = null, bestDiff = 0.18;
    const allTargets = [...enemies.filter(e=>!e.dead).map(e=>({ x:e.group.position.x, z:e.group.position.z }))];
    for(const id in remotePlayers){
      const rp = remotePlayers[id];
      if(rp.alive) allTargets.push({ x: rp.group.position.x, z: rp.group.position.z });
    }
    for(const t of allTargets){
      const dx = t.x - px, dz = t.z - pz;
      const d2 = dx*dx + dz*dz;
      if(d2 > 60*60) continue;
      const tYaw = Math.atan2(dx, dz);
      let diff = tYaw - camYaw;
      while(diff > Math.PI) diff -= TAU;
      while(diff < -Math.PI) diff += TAU;
      if(Math.abs(diff) < bestDiff){ bestDiff = Math.abs(diff); bestYaw = tYaw; }
    }
    if(bestYaw !== null){
      let diff = bestYaw - camYaw;
      while(diff > Math.PI) diff -= TAU;
      while(diff < -Math.PI) diff += TAU;
      camYaw += diff * strength * 0.18;
    }
  }

  if(len > 0.05) playerGroup.position.y = 0.8 + Math.sin(performance.now()*0.012)*0.04;
  else playerGroup.position.y = 0.8;
}

function updateCamera(){
  if(!playerGroup) return;
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const cp = clamp(camPitch, -0.55, 1.05);
  const hd = CAM_DIST * Math.cos(cp);
  const vo = CAM_DIST * Math.sin(cp);
  const px = playerGroup.position.x, py = playerGroup.position.y, pz = playerGroup.position.z;
  camera.position.set(px - fx*hd, py + CAM_HEIGHT + vo, pz - fz*hd);
  if(camera.position.y < 0.6) camera.position.y = 0.6;
  camera.lookAt(px + fx*15, py + 1.0 - cp*5.5, pz + fz*15);
}

function segmentHitsWall(x1,z1,x2,z2,radius){
  for(const o of obstacles){
    const minD = o.r + radius;
    const dx = x2-x1, dz = z2-z1;
    const len2 = dx*dx + dz*dz;
    let t = len2 > 0 ? ((o.x-x1)*dx + (o.z-z1)*dz)/len2 : 0;
    t = clamp(t, 0, 1);
    const px = x1 + dx*t, pz = z1 + dz*t;
    const d = Math.hypot(px - o.x, pz - o.z);
    if(d < minD) return { x:px, z:pz };
  }
  for(const h of houses){
    const c = Math.cos(-h.rot), s = Math.sin(-h.rot);
    const lx1 = (x1-h.x)*c - (z1-h.z)*s;
    const lz1 = (x1-h.x)*s + (z1-h.z)*c;
    const lx2 = (x2-h.x)*c - (z2-h.z)*s;
    const lz2 = (x2-h.x)*s + (z2-h.z)*c;
    for(const w of h.worldWalls){
      const wx = w.lx, wz = w.lz, sw = w.sw, sh = w.sh;
      const minX = wx - sw/2 - radius, maxX = wx + sw/2 + radius;
      const minZ = wz - sh/2 - radius, maxZ = wz + sh/2 + radius;
      const steps = 5;
      for(let i=0;i<=steps;i++){
        const t = i/steps;
        const px = lx1 + (lx2-lx1)*t;
        const pz = lz1 + (lz2-lz1)*t;
        if(px >= minX && px <= maxX && pz >= minZ && pz <= maxZ){
          const cc = Math.cos(h.rot), ss = Math.sin(h.rot);
          return { x: h.x + px*cc - pz*ss, z: h.z + px*ss + pz*cc };
        }
      }
    }
    if(!h.isOpen){
      const doorW = h.doorW;
      const wx = 0, wz = h.D/2;
      const minX = wx - doorW/2 - radius, maxX = wx + doorW/2 + radius;
      const minZ = wz - 0.2 - radius, maxZ = wz + 0.2 + radius;
      const steps = 4;
      for(let i=0;i<=steps;i++){
        const t = i/steps;
        const px = lx1 + (lx2-lx1)*t;
        const pz = lz1 + (lz2-lz1)*t;
        if(px >= minX && px <= maxX && pz >= minZ && pz <= maxZ){
          const cc = Math.cos(h.rot), ss = Math.sin(h.rot);
          return { x: h.x + px*cc - pz*ss, z: h.z + px*ss + pz*cc };
        }
      }
    }
  }
  return null;
}

function updateBullets(dt){
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.life -= dt;
    const totalDist = b.speed * dt;
    const steps = Math.max(1, Math.ceil(totalDist/0.5));
    const stepDist = totalDist / steps;
    let remove = false;

    for(let s=0;s<steps;s++){
      const oldX = b.mesh.position.x, oldZ = b.mesh.position.z;
      b.mesh.position.addScaledVector(b.dir, stepDist);
      const p = b.mesh.position;

      if(b.life <= 0 || p.y < 0.05 || Math.abs(p.x) > WORLD_HALF || Math.abs(p.z) > WORLD_HALF){
        remove = true; break;
      }

      const wallHit = segmentHitsWall(oldX, oldZ, p.x, p.z, 0.15);
      if(wallHit){
        spawnParticles(new THREE.Vector3(wallHit.x, p.y, wallHit.z), 0xffffff, 4, 4);
        remove = true; break;
      }

      if(b.owner === 'player'){
        let hit = false;
        for(const e of enemies){
          if(e.dead) continue;
          const dx = p.x - e.group.position.x;
          const dy = p.y - (e.group.position.y + 0.2);
          const dz = p.z - e.group.position.z;
          if(dx*dx + dy*dy + dz*dz < 1.05*1.05){
            damageEnemy(e, b.dmg, true);
            spawnParticles(p.clone(), 0xff6b35, 4, 5);
            hitMarker();
            hit = true; break;
          }
        }
        if(!hit && isOnlineMode){
          for(const id in remotePlayers){
            const rp = remotePlayers[id];
            if(!rp.alive) continue;
            const dx = p.x - rp.group.position.x;
            const dy = p.y - (rp.group.position.y + 0.2);
            const dz = p.z - rp.group.position.z;
            if(dx*dx + dy*dy + dz*dz < 1.05*1.05){
              spawnParticles(p.clone(), 0xff6b35, 6, 5);
              hitMarker();
              showPop('命中玩家！');
              if(ws && ws.readyState === 1){
                ws.send(JSON.stringify({ type:'hit', target: id, dmg: b.dmg }));
              }
              hit = true; break;
            }
          }
        }
        if(hit) remove = true;
      } else {
        if(!player.dead){
          const dx = p.x - playerGroup.position.x;
          const dy = p.y - (playerGroup.position.y + 0.2);
          const dz = p.z - playerGroup.position.z;
          if(dx*dx + dy*dy + dz*dz < 1.05*1.05){
            damagePlayer(b.dmg, true);
            spawnParticles(p.clone(), 0xff8fa3, 4, 5);
            remove = true;
          }
        }
        if(!remove){
          for(const e of enemies){
            if(e.dead || e === b.shooter) continue;
            const dx = p.x - e.group.position.x;
            const dy = p.y - (e.group.position.y + 0.2);
            const dz = p.z - e.group.position.z;
            if(dx*dx + dy*dy + dz*dz < 1.05*1.05){
              damageEnemy(e, b.dmg, false);
              spawnParticles(p.clone(), 0xffd23f, 4, 5);
              remove = true; break;
            }
          }
        }
      }
      if(remove) break;
    }
    if(remove){ scene.remove(b.mesh); bullets.splice(i,1); }
  }
}

function updateEnemies(dt){
  for(const e of enemies){
    if(e.dead) continue;
    if(e.hitFlash > 0){
      e.hitFlash -= dt;
      if(e.hitFlash > 0) e.bodyMat.color.setHex(0xffffff);
      else e.bodyMat.color.copy(e.baseColor);
    }

    e.retargetTimer -= dt;
    const curTgt = e.target;
    const tgtValid = curTgt && !curTgt.isDead();
    if(e.retargetTimer <= 0 || !tgtValid){
      e.retargetTimer = rand(2.8, 5.5);
      let best = null, bestScore = Infinity;
      if(!player.dead){
        const dx = e.group.position.x - playerGroup.position.x;
        const dz = e.group.position.z - playerGroup.position.z;
        bestScore = (dx*dx + dz*dz) * 0.7;
        best = { obj: playerGroup, isDead: ()=>player.dead };
      }
      for(const o of enemies){
        if(o === e || o.dead) continue;
        const dx = e.group.position.x - o.group.position.x;
        const dz = e.group.position.z - o.group.position.z;
        const d2 = dx*dx + dz*dz;
        if(d2 < bestScore){ bestScore = d2; best = { obj:o.group, isDead:()=>o.dead }; }
      }
      e.target = best;
    }
    if(!e.target || !e.target.obj) continue;
    const tp = e.target.obj.position;
    const dx = tp.x - e.group.position.x;
    const dz = tp.z - e.group.position.z;
    const dist = Math.hypot(dx,dz) || 0.001;

    const tAngle = Math.atan2(dx, dz);
    let diff = tAngle - e.group.rotation.y;
    while(diff > Math.PI) diff -= TAU;
    while(diff < -Math.PI) diff += TAU;
    e.group.rotation.y += diff * Math.min(1, dt*5);

    let moveDir = 0;
    if(dist > 18) moveDir = 1;
    else if(dist < 10) moveDir = -1;

    if(moveDir !== 0){
      const nx = dx/dist, nz = dz/dist;
      let newX = e.group.position.x + nx*moveDir*e.speed*dt;
      let newZ = e.group.position.z + nz*moveDir*e.speed*dt;
      const r = resolveCollision(newX, newZ, 0.6);
      newX = clamp(r.nx, -WORLD_HALF+2, WORLD_HALF-2);
      newZ = clamp(r.nz, -WORLD_HALF+2, WORLD_HALF-2);
      e.group.position.x = newX;
      e.group.position.z = newZ;
    }

    for(const o of enemies){
      if(o === e || o.dead) continue;
      const ddx = e.group.position.x - o.group.position.x;
      const ddz = e.group.position.z - o.group.position.z;
      const dd = ddx*ddx + ddz*ddz;
      if(dd < 4 && dd > 0.001){
        const dl = Math.sqrt(dd);
        e.group.position.x += (ddx/dl)*dt*3;
        e.group.position.z += (ddz/dl)*dt*3;
      }
    }
    e.cool -= dt;
    if(dist < 35 && e.cool <= 0){ e.cool = e.fireRate; enemyFire(e); }
  }
}

function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    p.bob += dt*3;
    p.mesh.rotation.z += dt*1.5;
    p.mesh.position.y = 0.7 + Math.sin(p.bob)*0.15;
    if(player.dead) continue;
    const dx = p.mesh.position.x - playerGroup.position.x;
    const dz = p.mesh.position.z - playerGroup.position.z;
    if(dx*dx + dz*dz < 1.8*1.8){
      if(p.type === 'health'){
        player.hp = Math.min(player.maxHp, player.hp + 45);
        spawnParticles(p.mesh.position.clone(), 0x4ECB71, 10, 5);
        showPop('+45 HP');
      } else if(p.type === 'weapon'){
        player.weapon = WEAPONS[p.data];
        spawnParticles(p.mesh.position.clone(), 0xFFD23F, 10, 5);
        showPop(WEAPONS[p.data].name);
      } else if(p.type === 'med'){
        const md = MEDICINES[p.data];
        player.meds[p.data] = Math.min(md.max, (player.meds[p.data]||0)+1);
        spawnParticles(p.mesh.position.clone(), 0x00ACC1, 10, 5);
        showPop(md.name + ' +1');
        renderMedsBar();
      }
      sfxPickup(p.type !== 'weapon');
      scene.remove(p.mesh);
      pickups.splice(i,1);
    }
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 22*dt;
    p.life -= dt;
    const s = Math.max(0.01, p.life/p.maxLife);
    p.mesh.scale.setScalar(s);
    if(p.life <= 0){ scene.remove(p.mesh); particles.splice(i,1); }
  }
}

function updateZone(dt){
  if(zone.radius <= zone.targetRadius + 0.4){
    zone.timer -= dt;
    if(zone.timer <= 0){
      zone.targetRadius = Math.max(30, zone.radius*0.72);
      zone.timer = 18;
    }
  } else {
    zone.radius -= 3.5*dt;
    if(zone.radius < zone.targetRadius) zone.radius = zone.targetRadius;
  }
  updateZoneVisual();
  if(!player.dead){
    const d = Math.hypot(playerGroup.position.x, playerGroup.position.z);
    if(d > zone.radius){ damagePlayer(10*dt, false); sfxZone(); }
  }
}
function updateZoneVisual(){
  if(zoneMesh) zoneMesh.scale.set(zone.radius, 1, zone.radius);
  if(zoneRing) zoneRing.scale.set(zone.radius, 1, zone.radius);
}

function checkWin(){
  if(winFlag) return;
  if(!isOnlineMode && enemies.every(e => e.dead)){
    winFlag = true;
    endGame(true);
  }
}

function update(dt){
  gameTime += dt;
  if(hurtCooldown > 0) hurtCooldown -= dt;
  if(enemyShotCD > 0) enemyShotCD -= dt;
  if(hurtCD > 0) hurtCD -= dt;
  if(zoneCD > 0) zoneCD -= dt;

  updatePlayer(dt);
  updateCamera();
  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateZone(dt);
  updateDoors(dt);
  updateRemotePlayers(dt);
  checkWin();

  if(!player.dead && !player.usingMed){
    player.cool -= dt;
    if((mouseDown || mtAim) && player.cool <= 0) firePlayerWeapon();
  }

  if(isOnlineMode && ws && ws.readyState === 1){
    syncTimer -= dt;
    if(syncTimer <= 0){
      syncTimer = SYNC_INTERVAL;
      ws.send(JSON.stringify({
        type:'state',
        x: playerGroup.position.x,
        z: playerGroup.position.z,
        ang: camYaw,
        hp: player.hp,
        weapon: player.weapon.key,
        alive: !player.dead
      }));
    }
  }

  updateHUD(false);
}

function updateDoors(dt){
  for(const h of houses){
    if(h._doorTargetRot !== undefined){
      const cur = h.doorPivot.rotation.y;
      const diff = h._doorTargetRot - cur;
      if(Math.abs(diff) < 0.02){
        h.doorPivot.rotation.y = h._doorTargetRot;
      } else {
        h.doorPivot.rotation.y += diff * Math.min(1, dt*8);
      }
    }
  }
}

function updateRemotePlayers(dt){
  const lerpFactor = Math.min(1, dt * 12);
  for(const id in remotePlayers){
    const rp = remotePlayers[id];
    if(!rp.targetPos) continue;
    rp.group.position.x += (rp.targetPos.x - rp.group.position.x) * lerpFactor;
    rp.group.position.z += (rp.targetPos.z - rp.group.position.z) * lerpFactor;
    rp.group.rotation.y += (rp.targetAng - rp.group.rotation.y) * lerpFactor * 0.7;
  }
}

let ws = null;
let syncTimer = 0;
let netPing = 0;
let pingTimer = null;

function connectWS(){
  if(ws && ws.readyState <= 1) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host);

  ws.onopen = ()=>{
    ws.send(JSON.stringify({ type:'auth', token: API.token }));
  };

  ws.onmessage = ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if(msg.type === 'auth-ok'){
      console.log('联机成功，房间:', msg.roomId);
      toast(`✅ 已进入房间 ${msg.roomId}，当前 ${msg.players.length + 1} 人`);
      for(const id in remotePlayers) scene.remove(remotePlayers[id].group);
      remotePlayers = {};
      msg.players.forEach(p => addRemotePlayer(p));
      clearInterval(pingTimer);
      pingTimer = setInterval(()=>{
        if(ws && ws.readyState === 1){
          ws.send(JSON.stringify({ type:'ping', t: Date.now() }));
        }
      }, 3000);
    }
    else if(msg.type === 'auth-fail'){
      toast('⚠️ 登录已失效，请重新登录');
      ws.close();
    }
    else if(msg.type === 'player-join'){
      addRemotePlayer(msg);
      showPop(msg.nickname + ' 加入了房间');
    }
    else if(msg.type === 'player-leave'){
      if(remotePlayers[msg.id]){
        scene.remove(remotePlayers[msg.id].group);
        delete remotePlayers[msg.id];
      }
    }
    else if(msg.type === 'state'){
      if(remotePlayers[msg.id]){
        const rp = remotePlayers[msg.id];
        rp.targetPos = { x: msg.x, z: msg.z };
        rp.targetAng = msg.ang || 0;
        rp.hp = msg.hp;
        rp.weapon = msg.weapon;
        rp.alive = msg.alive !== false;
        rp.group.visible = rp.alive;
      }
    }
    else if(msg.type === 'shoot'){
      if(remotePlayers[msg.id]){
        const rp = remotePlayers[msg.id];
        const d = Math.hypot(
          rp.group.position.x - playerGroup.position.x,
          rp.group.position.z - playerGroup.position.z
        );
        if(d < 60){
          playNoise(0.06, 1600, 250, clamp(1 - d/60, 0.05, 0.5) * 0.6);
        }
        const mp = new THREE.Vector3(
          rp.group.position.x + Math.sin(msg.ang) * 0.5,
          rp.group.position.y,
          rp.group.position.z + Math.cos(msg.ang) * 0.5
        );
        spawnParticles(mp, 0xFFD23F, 3, 4);
      }
    }
    else if(msg.type === 'hit'){
      if(msg.target === player.id){
        damagePlayer(msg.dmg, true);
      }
    }
    else if(msg.type === 'die'){
      if(remotePlayers[msg.id]){
        const rp = remotePlayers[msg.id];
        rp.alive = false;
        rp.group.visible = false;
        spawnParticles(rp.group.position.clone().setY(0.9), 0xff6b35, 15, 7);
        if(msg.killer === player.id){
          kills++;
          showPop('淘汰 ' + rp.nickname + '！');
          sfxKill();
        }
      }
    }
    else if(msg.type === 'pong'){
      netPing = Date.now() - msg.t;
    }
  };

  ws.onclose = ()=>{
    console.log('WebSocket 断开');
    clearInterval(pingTimer);
    if(state === 'playing' && isOnlineMode){
      toast('⚠️ 与服务器断开连接');
    }
  };
  ws.onerror = ()=>{};
}

function addRemotePlayer(data){
  if(remotePlayers[data.id]) return;
  const p = createSausage(data.skin || 0xff6b35);
  p.group.position.set(data.x || 0, 0.8, data.z || 0);
  scene.add(p.group);

  remotePlayers[data.id] = {
    id: data.id,
    group: p.group,
    nickname: data.nickname || '玩家',
    skin: data.skin || 0xff6b35,
    hp: data.hp || 100,
    alive: true,
    targetPos: { x: data.x || 0, z: data.z || 0 },
    targetAng: 0
  };
}

const el = {
  hud: document.getElementById('hud'),
  aliveNum: document.getElementById('aliveNum'),
  zoneMsg: document.getElementById('zoneMsg'),
  hpFill: document.getElementById('hpFill'),
  hpText: document.getElementById('hpText'),
  weaponName: document.getElementById('weaponName'),
  killPop: document.getElementById('killPop'),
  crosshair: document.getElementById('crosshair'),
  hurtFlash: document.getElementById('hurtFlash'),
  netBox: document.getElementById('netBox')
};
let lastAlive = -1, lastHp = -1, lastWeapon = '', lastZone = '', lastNet = '';

function updateHUD(force){
  if(player.dead){
    if(force || lastHp !== 0){
      el.hpFill.style.width = '0%';
      el.hpText.textContent = '0 / 100';
      lastHp = 0;
    }
    return;
  }
  const alive = enemies.filter(e => !e.dead).length + 1;
  if(alive !== lastAlive){ el.aliveNum.textContent = alive; lastAlive = alive; }

  const hp = Math.ceil(player.hp);
  if(hp !== lastHp){
    const pct = clamp(player.hp / player.maxHp, 0, 1);
    el.hpFill.style.width = (pct * 100) + '%';
    el.hpFill.classList.toggle('low', pct < 0.35);
    el.hpText.textContent = hp + ' / ' + player.maxHp;
    lastHp = hp;
  }
  if(player.weapon.name !== lastWeapon){
    el.weaponName.textContent = player.weapon.name;
    lastWeapon = player.weapon.name;
  }
  if(!playerGroup) return;
  const d = Math.hypot(playerGroup.position.x, playerGroup.position.z);
  let zs;
  if(d > zone.radius) zs = 'out';
  else if(zone.radius > zone.targetRadius + 0.5) zs = 'shrink';
  else zs = 'stable';
  if(zs !== lastZone){
    if(zs === 'out'){ el.zoneMsg.textContent = '⚠️ 你在毒圈外！'; el.zoneMsg.style.color = '#FF5252'; }
    else if(zs === 'shrink'){ el.zoneMsg.textContent = '🔻 安全区缩小中'; el.zoneMsg.style.color = '#FF8FA3'; }
    else { el.zoneMsg.textContent = '安全区稳定'; el.zoneMsg.style.color = '#7CFFB2'; }
    lastZone = zs;
  }

  let ns;
  if(!isOnlineMode) ns = '单机模式';
  else if(!ws || ws.readyState !== 1) ns = '📶 未连接';
  else ns = '📶 ' + netPing + 'ms';
  if(ns !== lastNet){ el.netBox.textContent = ns; lastNet = ns; }
}

let popTimer = null;
function showPop(text){
  el.killPop.textContent = text;
  el.killPop.style.transition = 'none';
  el.killPop.style.opacity = '1';
  el.killPop.style.transform = 'translate(-50%,-50%) scale(1.2)';
  clearTimeout(popTimer);
  popTimer = setTimeout(()=>{
    el.killPop.style.transition = 'opacity .5s, transform .5s';
    el.killPop.style.opacity = '0';
    el.killPop.style.transform = 'translate(-50%,-95%) scale(1)';
  }, 240);
}
let markerTimer = null;
function hitMarker(){
  el.crosshair.classList.add('hit');
  clearTimeout(markerTimer);
  markerTimer = setTimeout(()=>el.crosshair.classList.remove('hit'), 110);
}
let hurtTimer = null;
function flashHurt(){
  el.hurtFlash.style.opacity = '1';
  clearTimeout(hurtTimer);
  hurtTimer = setTimeout(()=>el.hurtFlash.style.opacity = '0', 100);
}

const endScreen = document.getElementById('endScreen');
const loadOverlay = document.getElementById('loadOverlay');
const loadFill = document.getElementById('loadFill');
const loadPct = document.getElementById('loadPct');
const loadMsg = document.getElementById('loadMsg');

function showLoadingThenStart(){
  loadOverlay.classList.remove('hidden');
  loadFill.style.width = '0%';
  loadPct.textContent = '0%';
  const steps = [
    { p:12, t:120, msg:'正在扫描地形...' },
    { p:28, t:150, msg:'正在生成房子...' },
    { p:48, t:170, msg:'正在部署敌人...' },
    { p:68, t:150, msg:'正在分配武器...' },
    { p:85, t:130, msg:'正在连接服务器...' },
    { p:96, t:120, msg:'正在校准弹道...' },
    { p:100,t:200, msg:'准备就绪！' }
  ];
  let idx = 0;
  function next(){
    if(idx >= steps.length){
      setTimeout(()=>{ loadOverlay.classList.add('hidden'); startGameActual(); }, 220);
      return;
    }
    const s = steps[idx++];
    loadFill.style.width = s.p + '%';
    loadPct.textContent = s.p + '%';
    loadMsg.textContent = s.msg;
    setTimeout(next, s.t);
  }
  next();
}

function startGameActual(){
  stopLobbyAnimation();
  disposeScene();
  buildWorld(profile.startMap || 'green');
  createPlayer();
  resetGame();

  if(isOnlineMode){
    connectWS();
  }

  state = 'playing';
  lobbyScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  loadOverlay.classList.add('hidden');
  el.hud.classList.add('show');
  lastAlive = -1; lastHp = -1; lastWeapon = ''; lastZone = ''; lastNet = '';

  if(renderer && renderer.domElement.requestPointerLock && !isOnMobile){
    try { renderer.domElement.requestPointerLock(); } catch(e){}
  }
}

async function endGame(win){
  if(state === 'over') return;
  state = 'over';
  if(document.pointerLockElement) document.exitPointerLock();
  if(win) sfxWin(); else sfxLose();

  const rank = win ? 1 : (enemies.filter(e => !e.dead).length + 2);

  try {
    const r = await API.post('/api/result', { kills, rank, win });
    if(r.ok) API.user = r.user;
  } catch(e){}

  document.getElementById('statKills').textContent = kills;
  document.getElementById('statTime').textContent = Math.floor(gameTime) + 's';
  document.getElementById('statRank').textContent = '#' + rank;

  const title = document.getElementById('endTitle');
  const sub = document.getElementById('endSub');
  const icon = document.getElementById('endIcon');

  if(win){
    title.textContent = '大吉大利';
    title.className = 'result-title win';
    sub.textContent = '今晚吃肠！ 🌭';
    icon.textContent = '🏆';
  } else {
    title.textContent = '你被淘汰了';
    title.className = 'result-title lose';
    sub.textContent = `最终排名 #${rank} · 淘汰 ${kills} 人`;
    icon.textContent = '💀';
  }
  setTimeout(()=>{ endScreen.classList.remove('hidden'); el.hud.classList.remove('show'); }, 800);
}

document.getElementById('playBtn').onclick = ()=>{
  initAudio(); resumeAudio(); sfxClick();
  isOnlineMode = (currentMode === 'online');
  if(isOnlineMode && (!ws || ws.readyState > 1)){
    connectWS();
  }
  showLoadingThenStart();
};
document.getElementById('againBtn').onclick = ()=>{
  initAudio(); resumeAudio(); sfxClick();
  endScreen.classList.add('hidden');
  showLoadingThenStart();
};
document.getElementById('backToLobbyBtn').onclick = ()=>{
  sfxClick();
  endScreen.classList.add('hidden');
  state = 'menu';
  if(ws) { try { ws.close(); } catch(e){} ws = null; }
  clearInterval(pingTimer);
  lobbyScreen.classList.remove('hidden');
  renderLobby();
  startLobbyAnimation();
};

window.addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  keys[k] = true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
  if(state === 'playing'){
    if(k === '1') useMedicine('bandage');
    if(k === '2') useMedicine('medkit');
    if(k === '3') useMedicine('energy');
    if(k === 'e') toggleDoor();
  }
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

document.addEventListener('pointerlockchange', ()=>{
  isLocked = document.pointerLockElement === renderer.domElement;
});

function bindMouseEvents(){
  renderer.domElement.addEventListener('mousedown', e=>{ if(e.button === 0) mouseDown = true; });
  window.addEventListener('mouseup', e=>{ if(e.button === 0) mouseDown = false; });
  renderer.domElement.addEventListener('click', ()=>{
    if(state === 'playing' && !isLocked && !isOnMobile){
      try { renderer.domElement.requestPointerLock(); } catch(e){}
    }
  });
  document.addEventListener('mousemove', e=>{
    if(!isLocked || state !== 'playing') return;
    const sens = profile.sensitivity;
    camYaw -= e.movementX * 0.0022 * sens;
    camPitch = clamp(camPitch + e.movementY * 0.0018 * sens, -0.55, 1.05);
  });
}

function bindTouchEvents(){
  const dom = renderer.domElement;
  dom.addEventListener('touchstart', e=>{
    if(state !== 'playing') return;
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.clientX < innerWidth*0.5){
        if(!mtMove) mtMove = { id:t.identifier, sx:t.clientX, sy:t.clientY, cx:t.clientX, cy:t.clientY };
      } else {
        if(!mtAim) mtAim = { id:t.identifier, px:t.clientX, py:t.clientY };
      }
    }
  }, { passive:false });
  dom.addEventListener('touchmove', e=>{
    if(state !== 'playing') return;
    e.preventDefault();
    for(const t of e.changedTouches){
      if(mtMove && t.identifier === mtMove.id){
        mtMove.cx = t.clientX; mtMove.cy = t.clientY;
      }
      if(mtAim && t.identifier === mtAim.id){
        const dx = t.clientX - mtAim.px, dy = t.clientY - mtAim.py;
        const sens = profile.sensitivity;
        camYaw -= dx * 0.006 * sens;
        camPitch = clamp(camPitch + dy * 0.005 * sens, -0.55, 1.05);
        mtAim.px = t.clientX; mtAim.py = t.clientY;
      }
    }
  }, { passive:false });
  function endTouch(e){
    for(const t of e.changedTouches){
      if(mtMove && t.identifier === mtMove.id) mtMove = null;
      if(mtAim && t.identifier === mtAim.id) mtAim = null;
    }
  }
  dom.addEventListener('touchend', endTouch);
  dom.addEventListener('touchcancel', endTouch);
}

window.addEventListener('resize', ()=>{
  if(camera){
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  if(lobbyActive) resizeLobbyCanvas();
});

const stickCanvas = document.createElement('canvas');
stickCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:11';
document.body.appendChild(stickCanvas);
const stickCtx = stickCanvas.getContext('2d');
function resizeStickCanvas(){
  const dpr = Math.min(devicePixelRatio, 2);
  stickCanvas.width = Math.floor(innerWidth*dpr);
  stickCanvas.height = Math.floor(innerHeight*dpr);
  stickCanvas.style.width = innerWidth + 'px';
  stickCanvas.style.height = innerHeight + 'px';
  stickCtx.setTransform(dpr,0,0,dpr,0,0);
}
resizeStickCanvas();
window.addEventListener('resize', resizeStickCanvas);

function paintSticks(){
  stickCtx.clearRect(0,0,innerWidth,innerHeight);
  if(state !== 'playing' || !isOnMobile) return;
  const m = Math.min(innerWidth, innerHeight);
  const mr = m*0.13, ar = m*0.13;
  const mcx = innerWidth*0.15, mcy = innerHeight*0.72;
  const acx = innerWidth*0.85, acy = innerHeight*0.72;

  if(!mtMove){
    stickCtx.beginPath(); stickCtx.arc(mcx, mcy, mr, 0, TAU);
    stickCtx.strokeStyle = 'rgba(255,210,63,0.22)'; stickCtx.lineWidth = 2.5; stickCtx.stroke();
    stickCtx.fillStyle = 'rgba(255,210,63,0.05)'; stickCtx.fill();
    stickCtx.font = 'bold 12px system-ui'; stickCtx.fillStyle = 'rgba(255,210,63,0.45)';
    stickCtx.textAlign = 'center'; stickCtx.textBaseline = 'middle';
    stickCtx.fillText('移动', mcx, mcy);
  }
  if(!mtAim){
    stickCtx.beginPath(); stickCtx.arc(acx, acy, ar, 0, TAU);
    stickCtx.strokeStyle = 'rgba(255,107,53,0.22)'; stickCtx.lineWidth = 2.5; stickCtx.stroke();
    stickCtx.fillStyle = 'rgba(255,107,53,0.05)'; stickCtx.fill();
    stickCtx.font = 'bold 12px system-ui'; stickCtx.fillStyle = 'rgba(255,107,53,0.45)';
    stickCtx.textAlign = 'center'; stickCtx.textBaseline = 'middle';
    stickCtx.fillText('射击', acx, acy);
  }
  function drawStick(sx, sy, cx, cy, r, rgb){
    stickCtx.beginPath(); stickCtx.arc(sx, sy, r, 0, TAU);
    stickCtx.strokeStyle = `rgba(${rgb},0.45)`; stickCtx.lineWidth = 3; stickCtx.stroke();
    stickCtx.fillStyle = `rgba(${rgb},0.1)`; stickCtx.fill();
    let dx = cx-sx, dy = cy-sy;
    const len = Math.hypot(dx, dy);
    if(len > r){ dx = dx/len*r; dy = dy/len*r; }
    stickCtx.beginPath(); stickCtx.arc(sx+dx, sy+dy, r*0.42, 0, TAU);
    stickCtx.fillStyle = `rgba(${rgb},0.8)`; stickCtx.fill();
  }
  if(mtMove) drawStick(mtMove.sx, mtMove.sy, mtMove.cx, mtMove.cy, mr, '255,210,63');
  if(mtAim) drawStick(mtAim.sx, mtAim.sy, mtAim.cx, mtAim.cy, ar, '255,107,53');
}
(function stickLoop(){ paintSticks(); requestAnimationFrame(stickLoop); })();

function loop(now){
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if(dt > 0.05) dt = 0.05;

  if(state === 'playing'){
    update(dt);
  } else {
    updateParticles(dt);
    if(playerGroup && camera) updateCamera();
  }
  if(renderer && scene && camera) renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function boot(){
  initThree();
  bindMouseEvents();
  bindTouchEvents();
  requestAnimationFrame(loop);
  tryAutoLogin();
}

if(window.THREE) boot();
else window.addEventListener('load', boot);
