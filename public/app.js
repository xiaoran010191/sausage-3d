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
