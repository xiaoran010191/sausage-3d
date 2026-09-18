function auth(req, res, next) {
  const t = req.headers['x-token'] || req.query.token;
  const rec = tokens[t];
  if (!rec) return res.status(401).json({ ok: false, msg: '未登录' });
  const u = users[rec.email];
  if (!u) return res.status(401).json({ ok: false, msg: '账号不存在' });
  req.user = u;
  next();
}

app.post('/api/profile', auth, (req, res) => {
  const p = req.body.profile || {};
  Object.assign(req.user.profile, p);
  saveUsers();
  res.json({ ok: true, user: pubUser(req.user.email) });
});

app.post('/api/result', auth, (req, res) => {
  const { kills = 0, rank = 99, win = false } = req.body;
  const s = req.user.stats;
  s.games = (s.games || 0) + 1;
  s.kills = (s.kills || 0) + Number(kills);
  if (win) s.wins = (s.wins || 0) + 1;
  if (rank < (s.bestRank || 999)) s.bestRank = rank;
  saveUsers();
  res.json({ ok: true, user: pubUser(req.user.email) });
});

app.get('/api/leaderboard', (req, res) => {
  const list = Object.values(users).map(u => ({
    nickname: u.nickname,
    kills: u.stats.kills || 0,
    wins: u.stats.wins || 0,
    games: u.stats.games || 0,
    bestRank: u.stats.bestRank || 999
  }));
  list.sort((a, b) => b.kills - a.kills || b.wins - a.wins);
  res.json({ ok: true, list: list.slice(0, 100) });
});

app.get('/api/friends', auth, (req, res) => {
  const list = (req.user.friends || []).map(email => {
    const f = users[email];
    if (!f) return null;
    return { email, nickname: f.nickname, kills: f.stats.kills || 0, online: isOnline(email) };
  }).filter(Boolean);
  res.json({ ok: true, list });
});

app.post('/api/friend/add', auth, (req, res) => {
  const target = String(req.body.email || '').trim().toLowerCase();
  if (target === req.user.email) return res.json({ ok: false, msg: '不能加自己' });
  if (!users[target]) return res.json({ ok: false, msg: '对方账号不存在' });
  req.user.friends = req.user.friends || [];
  if (req.user.friends.includes(target)) return res.json({ ok: false, msg: '已经是好友' });
  if (req.user.friends.length >= 50) return res.json({ ok: false, msg: '好友已达上限（50）' });
  req.user.friends.push(target);
  users[target].friends = users[target].friends || [];
  if (!users[target].friends.includes(req.user.email)) {
    users[target].friends.push(req.user.email);
  }
  saveUsers();
  res.json({ ok: true, msg: '已添加好友' });
});

app.post('/api/friend/remove', auth, (req, res) => {
  const target = String(req.body.email || '').trim().toLowerCase();
  req.user.friends = (req.user.friends || []).filter(e => e !== target);
  if (users[target]) {
    users[target].friends = (users[target].friends || []).filter(e => e !== req.user.email);
  }
  saveUsers();
  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const MAX_PER_ROOM = 20;
const rooms = new Map();
const onlineUsers = new Set();

function isOnline(email) { return onlineUsers.has(email); }

function getRoom() {
  for (const [id, room] of rooms) {
    if (room.size < MAX_PER_ROOM) return { id, room };
  }
  const id = 'room-' + (rooms.size + 1);
  const room = new Set();
  rooms.set(id, room);
  return { id, room };
}

function broadcast(room, msg, except = null) {
  const data = JSON.stringify(msg);
  for (const p of room) {
    if (p === except) continue;
    if (p.ws.readyState === 1) p.ws.send(data);
  }
}

wss.on('connection', (ws, req) => {
  let player = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (!player) {
      if (msg.type !== 'auth') return ws.close();
      const rec = tokens[msg.token];
      if (!rec || !users[rec.email]) {
        ws.send(JSON.stringify({ type: 'auth-fail', msg: '登录已失效' }));
        return ws.close();
      }
      const u = users[rec.email];
      const { id, room } = getRoom();
      player = {
        id: crypto.randomBytes(4).toString('hex'),
        ws, user: u, room, roomId: id,
        x: 0, z: 0, ang: 0, hp: 100, weapon: 'pistol',
        alive: true, nickname: u.nickname, skin: u.profile.skinColor
      };
      room.add(player);
      onlineUsers.add(u.email);

      ws.send(JSON.stringify({
        type: 'auth-ok',
        id: player.id,
        roomId: id,
        players: [...room].filter(p => p !== player).map(p => ({
          id: p.id, nickname: p.nickname, skin: p.skin, x: p.x, z: p.z, hp: p.hp
        }))
      }));
      broadcast(room, {
        type: 'player-join',
        id: player.id, nickname: player.nickname, skin: player.skin
      }, player);
      console.log(`[房间 ${id}] ${u.nickname} 加入，当前 ${room.size} 人`);
      return;
    }

    if (msg.type === 'state') {
      player.x = Number(msg.x) || 0;
      player.z = Number(msg.z) || 0;
      player.ang = Number(msg.ang) || 0;
      player.hp = Number(msg.hp) || 0;
      player.weapon = msg.weapon || 'pistol';
      player.alive = !!msg.alive;
    }
    else if (msg.type === 'shoot') {
      broadcast(player.room, {
        type: 'shoot',
        id: player.id,
        x: msg.x, z: msg.z, ang: msg.ang,
        weapon: msg.weapon
      }, player);
    }
    else if (msg.type === 'hit') {
      broadcast(player.room, {
        type: 'hit',
        shooter: player.id,
        target: msg.target,
        dmg: msg.dmg
      }, player);
    }
    else if (msg.type === 'die') {
      player.alive = false;
      broadcast(player.room, {
        type: 'die', id: player.id, killer: msg.killer
      }, player);
    }
    else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
    }
  });

  ws.on('close', () => {
    if (!player) return;
    player.room.delete(player);
    onlineUsers.delete(player.user.email);
    broadcast(player.room, { type: 'player-leave', id: player.id });
    if (player.room.size === 0) rooms.delete(player.roomId);
    console.log(`[房间 ${player.roomId}] ${player.user.nickname} 离开`);
  });
});

server.listen(PORT, () => {
  console.log(`🌭 香肠派对 3D 服务器运行在 http://localhost:${PORT}`);
});
