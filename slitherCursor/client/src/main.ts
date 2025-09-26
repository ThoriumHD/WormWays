import { Application, Graphics } from 'pixi.js';

type ServerSnake = { id: string; name: string; color: string; alive: boolean; segments: { x: number; y: number }[] };
type ServerFood = { id: string; x: number; y: number };
type ServerMessage = { t: 'welcome'; playerId: string; snakeId: string } | { t: 'state'; now: number; snakes: ServerSnake[]; foods: ServerFood[] };

const app = new Application();
await app.init({ background: '#0b0f1a', antialias: true, resizeTo: window });
document.getElementById('app')!.appendChild(app.canvas);

let playerId = '';
let mySnakeId = '';
let lastSeq = 0;
let direction = 0; // radians

const ws = new WebSocket(`ws://${location.hostname}:8081`);
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data) as ServerMessage;
  if (msg.t === 'welcome') {
    playerId = msg.playerId;
    mySnakeId = msg.snakeId;
  } else if (msg.t === 'state') {
    render(msg.snakes, msg.foods);
  }
});

function screenToWorld(x: number, y: number) {
  return { x: x, y: y };
}

// simple mouse controls
window.addEventListener('mousemove', (e) => {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  direction = Math.atan2(e.clientY - cy, e.clientX - cx);
});

setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    lastSeq++;
    ws.send(JSON.stringify({ t: 'input', seq: lastSeq, direction }));
  }
}, 50);

const g = new Graphics();
app.stage.addChild(g);

function render(snakes: ServerSnake[], foods: ServerFood[]) {
  g.clear();
  // find my head for camera
  const me = snakes.find((s) => s.id === mySnakeId);
  const cam = me?.segments[0] ?? { x: 0, y: 0 };

  // foods
  g.fill(0xffcc00);
  for (const f of foods) {
    g.circle(f.x - cam.x + window.innerWidth / 2, f.y - cam.y + window.innerHeight / 2, 3);
    g.fill();
  }

  // snakes
  for (const s of snakes) {
    g.stroke({ width: 6, color: s.id === mySnakeId ? 0xffffff : 0x000000, alpha: 0.3 });
    for (let i = 0; i < s.segments.length; i++) {
      const seg = s.segments[i];
      const x = seg.x - cam.x + window.innerWidth / 2;
      const y = seg.y - cam.y + window.innerHeight / 2;
      g.circle(x, y, 6);
      g.stroke();
    }
    g.fill(parseInt(s.color.replace('#', ''), 16) || 0x55aaff);
    for (let i = 0; i < s.segments.length; i++) {
      const seg = s.segments[i];
      const x = seg.x - cam.x + window.innerWidth / 2;
      const y = seg.y - cam.y + window.innerHeight / 2;
      g.circle(x, y, 5);
      g.fill();
    }
  }

  const hud = document.getElementById('hud')!;
  hud.textContent = `Players: ${snakes.length}  Food: ${foods.length}`;
}


