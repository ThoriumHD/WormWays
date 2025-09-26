import { WebSocketServer, WebSocket } from 'ws';
import { MsgType, decodeJoin, decodeInput, decodeRespawn, decodePing, encodeWelcome, encodeState, encodePong } from '@packages/proto';
import type { Vec2 } from '@packages/proto';

const TICK_HZ = 30;
const WORLD_SIZE = 3000; // 3000 x 3000 centered at (0,0)
const FOOD_TARGET = 800;
const HEAD_RADIUS = 8;

type Player = {
  id: number;
  name: string;
  color: number;
  alive: boolean;
  score: number; // length
  heading: number; // radians
  boost: boolean;
  body: Vec2[]; // head at index 0
  ws: WebSocket;
  lastInputAt: number;
  lastInputSeq: number;
};

type Food = { x: number; y: number };

const players = new Map<WebSocket, Player>();
let nextId = 1;
let foods: Food[] = [];

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function distance(a: Vec2, b: Vec2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

function spawnFood(n: number) {
  for (let i = 0; i < n; i++) {
    foods.push({ x: rand(-WORLD_SIZE/2, WORLD_SIZE/2), y: rand(-WORLD_SIZE/2, WORLD_SIZE/2) });
  }
}

function spawnPlayer(ws: WebSocket, name: string) {
  const id = nextId++;
  const color = Math.floor(rand(0, 1023));
  const head: Vec2 = { x: rand(-500, 500), y: rand(-500, 500) };
  const heading = rand(0, Math.PI * 2);
  const body: Vec2[] = [head];
  const length = 20;
  for (let i = 1; i < length; i++) body.push({ x: head.x - Math.cos(heading) * i * 8, y: head.y - Math.sin(heading) * i * 8 });
  const p: Player = {
    id, name, color, alive: true, score: length, heading, boost: false, body, ws, lastInputAt: 0, lastInputSeq: 0,
  };
  players.set(ws, p);
  return p;
}

const wss = new WebSocketServer({ port: 8080 });
console.log('[game-server] listening on 8080');

wss.on('connection', (ws: WebSocket) => {
  const player = spawnPlayer(ws, 'Player');
  ws.send(encodeWelcome(player.id, WORLD_SIZE));
  console.log(`[join] id=${player.id}`);

  ws.on('message', (data) => {
    const buf = new Uint8Array(data as Buffer);
    if (buf.length === 0) return;
    const type = buf[0] & 0x7f; // first varint byte is enough for small ids
    try {
      switch (type) {
        case MsgType.C2S_Join: {
          const m = decodeJoin(buf);
          player.name = m.name.slice(0, 16);
          break;
        }
        case MsgType.C2S_Input: {
          const now = Date.now();
          if (now - player.lastInputAt < 1000 / 60) return; // 60/s
          const m = decodeInput(buf);
          if (m.seq <= player.lastInputSeq) return;
          player.lastInputSeq = m.seq;
          player.heading = m.angle;
          player.boost = m.boost;
          player.lastInputAt = now;
          break;
        }
        case MsgType.C2S_Respawn: {
          const m = decodeRespawn(buf);
          if (!player.alive) {
            const p = spawnPlayer(ws, player.name);
            players.set(ws, p);
          }
          break;
        }
        case MsgType.C2S_Ping: {
          const m = decodePing(buf);
          ws.send(encodePong(m.t));
          break;
        }
      }
    } catch (e) {
      // malformed message ignored
    }
  });

  ws.on('close', () => {
    players.delete(ws);
    console.log(`[leave] id=${player.id}`);
  });
});

function tick(dtMs: number) {
  const tStart = performance.now();
  // movement
  for (const p of players.values()) {
    if (!p.alive) continue;
    const speed = p.boost ? 180 : 140; // units/s
    const step = (speed * dtMs) / 1000;
    const head = { ...p.body[0] };
    head.x += Math.cos(p.heading) * step;
    head.y += Math.sin(p.heading) * step;
    head.x = clamp(head.x, -WORLD_SIZE/2, WORLD_SIZE/2);
    head.y = clamp(head.y, -WORLD_SIZE/2, WORLD_SIZE/2);
    // maintain even spacing ~8px by inserting head and pruning by distance
    const spacing = 8;
    const prev = p.body[0];
    const dist = Math.hypot(head.x - prev.x, head.y - prev.y);
    if (dist >= 1) p.body.unshift(head);
    let acc = 0;
    const filtered: Vec2[] = [];
    for (let i = 0; i < p.body.length - 1; i++) {
      filtered.push(p.body[i]);
      const d = Math.hypot(p.body[i].x - p.body[i + 1].x, p.body[i].y - p.body[i + 1].y);
      acc += d;
      if (acc >= spacing) acc = 0; else p.body.splice(i + 1, 1);
      if (filtered.length >= p.score) break;
    }
    p.body = filtered;
  }

  // collisions + food
  for (const p of players.values()) {
    if (!p.alive) continue;
    const head = p.body[0];
    // eat food
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      if (Math.hypot(head.x - f.x, head.y - f.y) < 10) {
        p.score += 1;
        foods.splice(i, 1);
      }
    }
    // collide
    for (const q of players.values()) {
      if (!q.alive) continue;
      const start = q === p ? 10 : 0;
      for (let i = start; i < q.body.length; i++) {
        if (distance(head, q.body[i]) < HEAD_RADIUS) {
          p.alive = false;
          // drop pellets
          const drop = Math.min(30, p.body.length);
          for (let j = 0; j < drop; j++) foods.push({ x: p.body[j].x, y: p.body[j].y });
          break;
        }
      }
      if (!p.alive) break;
    }
  }

  // maintain food
  if (foods.length < FOOD_TARGET) spawnFood(FOOD_TARGET - foods.length);

  // send state snapshots, culling to 1200px around each player
  for (const p of players.values()) {
    const cam = p.body[0] ?? { x: 0, y: 0 };
    const nearPlayers = Array.from(players.values()).filter((q) => q.body[0] && Math.hypot(q.body[0].x - cam.x, q.body[0].y - cam.y) <= 1200);
    const nearFoods = foods.filter((f) => Math.hypot(f.x - cam.x, f.y - cam.y) <= 1200);
    const payloadPlayers = nearPlayers.map((q) => ({ id: q.id, len: q.score, headX: q.body[0].x, headY: q.body[0].y, color: q.color, alive: q.alive }));
    const state = encodeState(Date.now() >>> 0, payloadPlayers, nearFoods);
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(state);
  }
  const tEnd = performance.now();
  const dur = tEnd - tStart;
  // simple log every second
  accumTime += dur; accumTicks++;
}

let last = Date.now();
let accumTime = 0; let accumTicks = 0; let lastLog = Date.now();
spawnFood(FOOD_TARGET);
setInterval(() => {
  const now = Date.now();
  const dt = now - last; last = now;
  tick(dt);
  if (now - lastLog >= 1000) {
    const avg = (accumTime / Math.max(1, accumTicks)).toFixed(2);
    console.log(`[tick] ${accumTicks} ticks, avg ${avg} ms, players=${players.size}, food=${foods.length}`);
    accumTime = 0; accumTicks = 0; lastLog = now;
  }
}, 1000 / TICK_HZ);


