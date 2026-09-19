/* =========================================================
   肠肠大作战 · Deno Deploy 后端（含管理员功能）
   ========================================================= */

const kv = await Deno.openKv();
const enc = new TextEncoder();

// ★★★ 改这个密码 ★★★
const ADMIN_KEY = "admin888";

async function hashPass(pw, salt) {
  const data = enc.encode(pw + ":" + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function makeToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

function makeSalt() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, "0")).join("");
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const isValidQQ = (e) => /^[a-zA-Z0-9._-]+@qq\.com$/i.test(e);

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    }
  });
}

async function readJSON(req) {
  try { return await req.json(); } catch (_) { return {}; }
}

async function getUser(email) {
  const r = await kv.get(["user", email]);
  return r.value;
}

async function saveUser(user) {
  await kv.set(["user", user.email], user);
}

async function authUser(req) {
  const t = req.headers.get("x-token");
  if (!t) return null;
  const r = await kv.get(["token", t]);
  if (!r.value) return null;
  return await getUser(r.value.email);
}

function publicUser(u) {
  return {
    email: u.email,
    nickname: u.nickname,
    stats: u.stats,
    friends: u.friends || [],
    profile: u.profile
  };
}

const rooms = new Map();
function getRoom(code) { return rooms.get(code); }
function createRoom(hostEmail, hostName) {
  let code;
  do { code = makeRoomCode(); } while (rooms.has(code));
  rooms.set(code, { players: new Set(), host: hostEmail, hostName: hostName, createdAt: Date.now() });
  return code;
}

async function apiSendCode(req) {
  const body = await readJSON(req);
  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidQQ(email)) return jsonResp({ ok: false, msg: "请填写正确的 QQ 邮箱" });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await kv.set(["code", email], { code, sentAt: Date.now(), expires: Date.now() + 600000 });
  console.log("📧 验证码:", email, code, "万能码 888888");
  return jsonResp({ ok: true, msg: "验证码已生成，也可直接用万能码 888888" });
}

async function apiRegister(req) {
  const body = await readJSON(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const nickname = String(body.nickname || "").trim().slice(0, 12);
  const code = String(body.code || "").trim();

  if (!isValidQQ(email)) return jsonResp({ ok: false, msg: "请使用 QQ 邮箱注册" });
  if (password.length < 6) return jsonResp({ ok: false, msg: "密码至少 6 位" });
  if (!nickname) return jsonResp({ ok: false, msg: "请填写昵称" });
  if (await getUser(email)) return jsonResp({ ok: false, msg: "该邮箱已注册" });

  if (code !== "888888") {
    const codeRec = await kv.get(["code", email]);
    if (!codeRec.value) return jsonResp({ ok: false, msg: "请先获取验证码" });
    if (codeRec.value.code !== code) return jsonResp({ ok: false, msg: "验证码错误（也可填 888888）" });
    if (Date.now() > codeRec.value.expires) return jsonResp({ ok: false, msg: "验证码已过期" });
  }

  const salt = makeSalt();
  const user = {
    email, nickname, salt,
    passHash: await hashPass(password, salt),
    createdAt: Date.now(),
    stats: { games: 0, kills: 0, wins: 0, bestRank: 999 },
    friends: [],
    banned: false,
    profile: {
      skinColor: 0xff6b35, startWeapon: "pistol", startMap: "green",
      sensitivity: 1.2, aimAssist: 0.1, volume: 0.6, gyroEnabled: false
    }
  };
  await saveUser(user);
  await kv.delete(["code", email]);

  const token = makeToken();
  await kv.set(["token", token], { email, createdAt: Date.now() });
  return jsonResp({ ok: true, token, user: publicUser(user) });
}

async function apiLogin(req) {
  const body = await readJSON(req);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await getUser(email);
  if (!user) return jsonResp({ ok: false, msg: "账号不存在" });
  if (user.banned) return jsonResp({ ok: false, msg: "🚫 账号已被封禁\n原因：" + (user.banReason || "违反规则") });
  if (await hashPass(password, user.salt) !== user.passHash) return jsonResp({ ok: false, msg: "密码错误" });
  const token = makeToken();
  await kv.set(["token", token], { email, createdAt: Date.now() });
  return jsonResp({ ok: true, token, user: publicUser(user) });
}

async function apiProfile(req) {
  const user = await authUser(req);
  if (!user) return jsonResp({ ok: false, msg: "未登录" }, 401);
  if (user.banned) return jsonResp({ ok: false, msg: "账号已被封禁" }, 403);
  const body = await readJSON(req);
  Object.assign(user.profile, body.profile || {});
  await saveUser(user);
  return jsonResp({ ok: true, user: publicUser(user) });
}

async function apiResult(req) {
  const user = await authUser(req);
  if (!user) return jsonResp({ ok: false, msg: "未登录" }, 401);
  if (user.banned) return jsonResp({ ok: false, msg: "账号已被封禁" }, 403);
  const body = await readJSON(req);
  const { kills = 0, rank = 99, win = false } = body;
  const s = user.stats;
  s.games = (s.games || 0) + 1;
  s.kills = (s.kills || 0) + Number(kills);
  if (win) s.wins = (s.wins || 0) + 1;
  if (rank < (s.bestRank || 999)) s.bestRank = rank;
  await saveUser(user);
  return jsonResp({ ok: true, user: publicUser(user) });
}

async function apiPlayer(url) {
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return jsonResp({ ok: false, msg: "缺少 email 参数" });
  if (!isValidQQ(email)) return jsonResp({ ok: false, msg: "邮箱格式不正确" });
  const user = await getUser(email);
  if (!user) return jsonResp({ ok: false, msg: "玩家不存在" });
  const s = user.stats || {};
  return jsonResp({
    ok: true,
    email: user.email,
    nickname: user.nickname,
    games: s.games || 0,
    kills: s.kills || 0,
    wins: s.wins || 0,
    bestRank: s.bestRank || 999,
    banned: !!user.banned,
    banReason: user.banReason || ""
  });
}

async function apiLeaderboard() {
  const list = [];
  for await (const entry of kv.list({ prefix: ["user"] })) {
    const u = entry.value;
    if (u.banned) continue;
    list.push({
      email: u.email,
      nickname: u.nickname,
      kills: u.stats.kills || 0,
      wins: u.stats.wins || 0,
      games: u.stats.games || 0,
      bestRank: u.stats.bestRank || 999
    });
  }
  list.sort((a, b) => b.kills - a.kills || b.wins - a.wins);
  return jsonResp({ ok: true, list: list.slice(0, 100) });
}

async function apiLeaderboardText() {
  const list = [];
  for await (const entry of kv.list({ prefix: ["user"] })) {
    const u = entry.value;
    if (u.banned) continue;
    list.push({ nickname: u.nickname, kills: u.stats.kills || 0, wins: u.stats.wins || 0 });
  }
  list.sort((a, b) => b.kills - a.kills || b.wins - a.wins);
  const top = list.slice(0, 10);
  let out = "🏆 击杀排行榜（前 10）\n";
  out += "━━━━━━━━━━━━━━━\n";
  if (top.length === 0) out += "📭 暂无数据\n";
  else top.forEach((u, i) => { out += `第${i + 1}名 · ${u.nickname} · ${u.kills}杀 ${u.wins}鸡\n`; });
  out += "━━━━━━━━━━━━━━━";
  return new Response(out, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
  });
}

async function apiFriends(req) {
  const user = await authUser(req);
  if (!user) return jsonResp({ ok: false, msg: "未登录" }, 401);
  const list = [];
  for (const email of (user.friends || [])) {
    const f = await getUser(email);
    if (!f) continue;
    list.push({ email, nickname: f.nickname, kills: f.stats.kills || 0, online: false });
  }
  return jsonResp({ ok: true, list });
}

async function apiFriendAdd(req) {
  const user = await authUser(req);
  if (!user) return jsonResp({ ok: false, msg: "未登录" }, 401);
  const body = await readJSON(req);
  const target = String(body.email || "").trim().toLowerCase();
  if (target === user.email) return jsonResp({ ok: false, msg: "不能加自己" });
  const other = await getUser(target);
  if (!other) return jsonResp({ ok: false, msg: "对方账号不存在" });
  user.friends = user.friends || [];
  if (user.friends.includes(target)) return jsonResp({ ok: false, msg: "已经是好友" });
  user.friends.push(target);
  other.friends = other.friends || [];
  if (!other.friends.includes(user.email)) other.friends.push(user.email);
  await saveUser(user);
  await saveUser(other);
  return jsonResp({ ok: true, msg: "已添加好友" });
}

async function apiFriendRemove(req) {
  const user = await authUser(req);
  if (!user) return jsonResp({ ok: false, msg: "未登录" }, 401);
  const body = await readJSON(req);
  const target = String(body.email || "").trim().toLowerCase();
  user.friends = (user.friends || []).filter(e => e !== target);
  await saveUser(user);
  const other = await getUser(target);
  if (other) {
    other.friends = (other.friends || []).filter(e => e !== user.email);
    await saveUser(other);
  }
  return jsonResp({ ok: true });
}

/* =========================================================
   ★ 管理员接口
   ========================================================= */

function checkAdmin(url) {
  return url.searchParams.get("key") === ADMIN_KEY;
}

// 改数据： /api/admin/set?key=xx&email=xx&field=kills&value=999
async function apiAdminSet(url) {
  if (!checkAdmin(url)) return jsonResp({ ok: false, msg: "密钥错误" });
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const field = String(url.searchParams.get("field") || "").trim();
  const value = String(url.searchParams.get("value") || "");
  const user = await getUser(email);
  if (!user) return jsonResp({ ok: false, msg: "玩家不存在" });

  if (field === "nickname") {
    user.nickname = value.slice(0, 12);
  } else if (["kills", "wins", "games", "bestRank"].includes(field)) {
    user.stats[field] = Number(value) || 0;
  } else {
    return jsonResp({ ok: false, msg: "不支持的字段：" + field });
  }
  await saveUser(user);
  return jsonResp({ ok: true, msg: "修改成功", user: publicUser(user) });
}

// 封禁： /api/admin/ban?key=xx&email=xx&reason=xxx
async function apiAdminBan(url) {
  if (!checkAdmin(url)) return jsonResp({ ok: false, msg: "密钥错误" });
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const reason = String(url.searchParams.get("reason") || "违反规则");
  const user = await getUser(email);
  if (!user) return jsonResp({ ok: false, msg: "玩家不存在" });
  user.banned = true;
  user.banReason = reason;
  await saveUser(user);
  return jsonResp({ ok: true, msg: "已封禁" });
}

// 解封： /api/admin/unban?key=xx&email=xx
async function apiAdminUnban(url) {
  if (!checkAdmin(url)) return jsonResp({ ok: false, msg: "密钥错误" });
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const user = await getUser(email);
  if (!user) return jsonResp({ ok: false, msg: "玩家不存在" });
  user.banned = false;
  delete user.banReason;
  await saveUser(user);
  return jsonResp({ ok: true, msg: "已解封" });
}

// 封禁列表： /api/admin/banned?key=xx
async function apiAdminBanned(url) {
  if (!checkAdmin(url)) return jsonResp({ ok: false, msg: "密钥错误" });
  const list = [];
  for await (const entry of kv.list({ prefix: ["user"] })) {
    const u = entry.value;
    if (u.banned) list.push({ email: u.email, nickname: u.nickname, reason: u.banReason || "" });
  }
  return jsonResp({ ok: true, list });
}

/* =========================================================
   WebSocket
   ========================================================= */
function handleWebSocket(req) {
  const { socket, response } = Deno.upgradeWebSocket(req);
  let player = null;
  let roomCode = null;

  socket.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }

    if (!player) {
      if (msg.type !== "auth") return socket.close();
      const r = await kv.get(["token", msg.token]);
      if (!r.value) {
        socket.send(JSON.stringify({ type: "auth-fail", msg: "登录已失效" }));
        return socket.close();
      }
      const user = await getUser(r.value.email);
      if (!user) {
        socket.send(JSON.stringify({ type: "auth-fail", msg: "账号不存在" }));
        return socket.close();
      }
      if (user.banned) {
        socket.send(JSON.stringify({ type: "auth-fail", msg: "账号已被封禁" }));
        return socket.close();
      }
      player = {
        id: makeToken().slice(0, 8),
        email: user.email,
        nickname: user.nickname,
        skin: user.profile.skinColor,
        x: 0, z: 0, ang: 0, hp: 100, weapon: "pistol", alive: true,
        socket
      };
      socket.send(JSON.stringify({ type: "auth-ok", id: player.id, nickname: player.nickname }));
      return;
    }

    if (msg.type === "create-room") {
      if (roomCode) { socket.send(JSON.stringify({ type: "error", msg: "你已经在房间内" })); return; }
      roomCode = createRoom(player.email, player.nickname);
      const room = getRoom(roomCode);
      room.players.add(player);
      socket.send(JSON.stringify({
        type: "room-created", code: roomCode,
        players: [...room.players].map(p => ({ id: p.id, nickname: p.nickname, skin: p.skin }))
      }));
      return;
    }

    if (msg.type === "join-room") {
      if (roomCode) { socket.send(JSON.stringify({ type: "error", msg: "你已经在房间内" })); return; }
      const code = String(msg.code || "").toUpperCase().trim();
      const room = getRoom(code);
      if (!room) { socket.send(JSON.stringify({ type: "error", msg: "房间不存在" })); return; }
      if (room.players.size >= 20) { socket.send(JSON.stringify({ type: "error", msg: "房间已满" })); return; }
      roomCode = code;
      const otherPlayers = [...room.players].map(p => ({ id: p.id, nickname: p.nickname, skin: p.skin, x: p.x, z: p.z }));
      room.players.add(player);
      socket.send(JSON.stringify({ type: "room-joined", code: roomCode, players: otherPlayers }));
      broadcastToRoom(roomCode, { type: "player-join", id: player.id, nickname: player.nickname, skin: player.skin }, socket);
      return;
    }

    if (msg.type === "leave-room") {
      if (roomCode) {
        const room = getRoom(roomCode);
        if (room) {
          room.players.delete(player);
          broadcastToRoom(roomCode, { type: "player-leave", id: player.id }, socket);
          if (room.players.size === 0) rooms.delete(roomCode);
        }
        roomCode = null;
      }
      return;
    }

    if (msg.type === "state" && roomCode) {
      player.x = Number(msg.x) || 0;
      player.z = Number(msg.z) || 0;
      player.ang = Number(msg.ang) || 0;
      player.hp = Number(msg.hp) || 0;
      player.weapon = msg.weapon || "pistol";
      player.alive = !!msg.alive;
    }
    else if (msg.type === "shoot" && roomCode) {
      broadcastToRoom(roomCode, { type: "shoot", id: player.id, x: msg.x, z: msg.z, ang: msg.ang, weapon: msg.weapon }, socket);
    }
    else if (msg.type === "hit" && roomCode) {
      broadcastToRoom(roomCode, { type: "hit", shooter: player.id, target: msg.target, dmg: msg.dmg }, socket);
    }
    else if (msg.type === "die" && roomCode) {
      player.alive = false;
      broadcastToRoom(roomCode, { type: "die", id: player.id, killer: msg.killer }, socket);
    }
    else if (msg.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", t: msg.t }));
    }
  };

  socket.onclose = () => {
    if (player && roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        room.players.delete(player);
        broadcastToRoom(roomCode, { type: "player-leave", id: player.id }, socket);
        if (room.players.size === 0) rooms.delete(roomCode);
      }
    }
  };

  socket.onerror = () => {};
  return response;
}

function broadcastToRoom(code, msg, except) {
  const room = getRoom(code);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const p of room.players) {
    if (p === except) continue;
    if (p.socket.readyState === 1) {
      try { p.socket.send(data); } catch (_) {}
    }
  }
}

async function serveStatic(path) {
  if (path === "/" || path === "") path = "/index.html";
  try {
    const file = await Deno.readFile("./public" + path);
    const ext = path.split(".").pop().toLowerCase();
    const mime = {
      "html": "text/html; charset=utf-8",
      "css": "text/css; charset=utf-8",
      "js": "application/javascript; charset=utf-8",
      "png": "image/png", "jpg": "image/jpeg", "svg": "image/svg+xml", "ico": "image/x-icon"
    }[ext] || "application/octet-stream";
    return new Response(file, { headers: { "Content-Type": mime } });
  } catch (_) {
    return new Response("Not Found", { status: 404 });
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-token",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      }
    });
  }

  if (req.headers.get("upgrade") === "websocket") return handleWebSocket(req);

  if (path === "/api/send-code" && req.method === "POST") return await apiSendCode(req);
  if (path === "/api/register" && req.method === "POST") return await apiRegister(req);
  if (path === "/api/login" && req.method === "POST") return await apiLogin(req);
  if (path === "/api/profile" && req.method === "POST") return await apiProfile(req);
  if (path === "/api/result" && req.method === "POST") return await apiResult(req);
  if (path === "/api/player" && req.method === "GET") return await apiPlayer(url);
  if (path === "/api/leaderboard" && req.method === "GET") return await apiLeaderboard();
  if (path === "/api/leaderboard-text" && req.method === "GET") return await apiLeaderboardText();
  if (path === "/api/friends" && req.method === "GET") return await apiFriends(req);
  if (path === "/api/friend/add" && req.method === "POST") return await apiFriendAdd(req);
  if (path === "/api/friend/remove" && req.method === "POST") return await apiFriendRemove(req);

  // 管理员接口
  if (path === "/api/admin/set" && req.method === "GET") return await apiAdminSet(url);
  if (path === "/api/admin/ban" && req.method === "GET") return await apiAdminBan(url);
  if (path === "/api/admin/unban" && req.method === "GET") return await apiAdminUnban(url);
  if (path === "/api/admin/banned" && req.method === "GET") return await apiAdminBanned(url);

  return await serveStatic(path);
});
