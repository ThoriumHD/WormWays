import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

const TICK_RATE = 60; // Hz
const WORLD_SIZE = 5000; // world is -2500..2500 in x/y
const START_LENGTH = 20;
const FOOD_COUNT = 500;

type Vec2 = { x: number; y: number };

type Snake = {
  id: string;
  name: string;
  color: string;
  segments: Vec2[]; // head at index 0
  direction: number; // radians
  speed: number; // units per second
  length: number; // desired length in segments
  alive: boolean;
  lastInputSeq: number;
};

type Player = {
  id: string;
  ws: WebSocket;
  snakeId: string;
};

type Food = { id: string; pos: Vec2; value: number };

const players = new Map<string, Player>();
const snakes = new Map<string, Snake>();
const foods = new Map<string, Food>();

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function spawnFood(n: number) {
  for (let i = 0; i < n; i++) {
    const id = randomUUID();
    foods.set(id, {
      id,
      pos: { x: rand(-WORLD_SIZE / 2, WORLD_SIZE / 2), y: rand(-WORLD_SIZE / 2, WORLD_SIZE / 2) },
      value: 1,
    });
  }
}

function spawnSnake(name: string, color: string): Snake {
  const id = randomUUID();
  const head: Vec2 = { x: rand(-500, 500), y: rand(-500, 500) };
  const direction = rand(0, Math.PI * 2);
  const segments: Vec2[] = [head];
  for (let i = 1; i < START_LENGTH; i++) {
    segments.push({ x: head.x - i * Math.cos(direction) * 8, y: head.y - i * Math.sin(direction) * 8 });
  }
  const snake: Snake = {
    id,
    name,
    color,
    segments,
    direction,
    speed: 140,
    length: START_LENGTH,
    alive: true,
    lastInputSeq: 0,
  };
  snakes.set(id, snake);
  return snake;
}

function distance(a: Vec2, b: Vec2) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function update(dt: number) {
  // move snakes
  for (const snake of snakes.values()) {
    if (!snake.alive) continue;
    const step = (snake.speed * dt) / 1000;
    const head = { ...snake.segments[0] };
    head.x += Math.cos(snake.direction) * step;
    head.y += Math.sin(snake.direction) * step;
    head.x = clamp(head.x, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    head.y = clamp(head.y, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    snake.segments.unshift(head);
    while (snake.segments.length > snake.length) snake.segments.pop();

    // self and others collision (simple circle vs segments)
    const headRadius = 8;
    for (const other of snakes.values()) {
      if (!other.alive) continue;
      const startIdx = other.id === snake.id ? 10 : 0; // ignore first few own segments
      for (let i = startIdx; i < other.segments.length; i++) {
        if (distance(head, other.segments[i]) < headRadius) {
          snake.alive = false;
          // drop food on death
          for (let j = 0; j < Math.min(30, snake.segments.length); j++) {
            const fid = randomUUID();
            foods.set(fid, { id: fid, pos: { ...snake.segments[j] }, value: 2 });
          }
          break;
        }
      }
      if (!snake.alive) break;
    }

    // eat food
    for (const f of Array.from(foods.values())) {
      if (distance(head, f.pos) < 10) {
        foods.delete(f.id);
        snake.length += f.value;
      }
    }
  }

  // keep food population
  if (foods.size < FOOD_COUNT) spawnFood(FOOD_COUNT - foods.size);
}

type ClientMessage =
  | { t: 'hello'; name?: string; color?: string }
  | { t: 'input'; seq: number; direction: number };

type ServerMessage =
  | { t: 'welcome'; playerId: string; snakeId: string }
  | { t: 'state'; now: number; snakes: any[]; foods: any[] };

const wss = new WebSocketServer({ port: 8081 });
console.log('[server] ws listening on 8081');

wss.on('connection', (ws: WebSocket) => {
  const playerId = randomUUID();
  let snake = spawnSnake('Player', `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`);
  const player: Player = { id: playerId, ws, snakeId: snake.id };
  players.set(playerId, player);
  const welcome: ServerMessage = { t: 'welcome', playerId, snakeId: snake.id };
  ws.send(JSON.stringify(welcome));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;
      if (msg.t === 'hello') {
        if (msg.name) snake.name = msg.name.slice(0, 16);
        if (msg.color) snake.color = msg.color;
      } else if (msg.t === 'input') {
        const s = snakes.get(player.snakeId);
        if (s && s.alive && msg.seq > s.lastInputSeq) {
          s.direction = msg.direction;
          s.lastInputSeq = msg.seq;
        }
      }
    } catch {}
  });

  ws.on('close', () => {
    players.delete(playerId);
    snakes.delete(player.snakeId);
  });
});

let last = Date.now();
spawnFood(FOOD_COUNT);
setInterval(() => {
  const now = Date.now();
  const dt = now - last;
  last = now;
  update(dt);

  // broadcast state snapshot (lightweight)
  const snapshot: ServerMessage = {
    t: 'state',
    now,
    snakes: Array.from(snakes.values()).map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      alive: s.alive,
      segments: s.segments.filter((_, i) => i % 2 === 0), // subsample for bandwidth
    })),
    foods: Array.from(foods.values()).map((f) => ({ id: f.id, x: f.pos.x, y: f.pos.y })),
  };

  const data = JSON.stringify(snapshot);
  for (const p of players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}, 1000 / TICK_RATE);


