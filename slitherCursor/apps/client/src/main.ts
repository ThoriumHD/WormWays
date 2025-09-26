import { Application, Graphics } from 'pixi.js';
import { Net } from './net';
import { WorldRenderer } from './render/WorldRenderer';
// import { Snake } from './snake';   // ⟵ REMOVE this
import { Camera } from './view/Camera';
// import { Grid } from './view/Grid'; // remove/disable
// import { Grid } from './view/Grid';
import Background from './view/Background';



// ⟵ ADD these
import { SnakeBody } from './snake/SnakeBody';
import { SnakeRenderer } from './snake/SnakeRenderer';

const app = new Application();
await app.init({ background: '#0b0f1a', antialias: true, resizeTo: window });
document.getElementById('app')!.appendChild(app.canvas);

const g = new Graphics();
app.stage.addChild(g);

// Camera and grid
// Camera and background
const camera = new Camera();

// create background (async)
const background = await Background.create(app);
// slither-like feel: screen-locked pattern that scrolls with camera
background.setWorldLocked(false);     // keep pattern size constant
background.setParallax(1.0);          // try 0.9 for subtle parallax

// Add at the very back
app.stage.addChildAt(background.sprite, 0);


// World renderer & networking
const world = new WorldRenderer();
app.stage.addChild(world.container);

// ─────────────────────────────────────────────
// LOCAL SNAKE (new: logic + renderer)
// ─────────────────────────────────────────────
const snakeBody = new SnakeBody();
snakeBody.reset({ x: 0, y: 0 }, 0);

const snakeView = new SnakeRenderer(app);  // this is a PIXI.Container
app.stage.addChild(snakeView);             // draw order: behind HUD

const net = new Net();
net.connect('Player');

net.onWelcome = (m) => { 
  world.setPlayer(m.playerId);
  snakeBody.reset({ x: 0, y: 0 }, 0); // reset local body to origin
};

// If you can get your player’s score/pos from world or state, set them here
net.onState = (s) => { 
  world.update(s);

  // Optional: keep local score in sync with server (if available)
  try {
    if (world.myId != null) {
      const me = world.getPlayer?.(world.myId); // if WorldRenderer exposes it
      if (me?.score != null) snakeBody.score = me.score;
      // If server sends an authoritative head position, you can gently pull:
      // if (me?.x != null && me?.y != null) snakeBody.head = { x: me.x, y: me.y };
    }
  } catch {}
};

net.onPong = (rtt) => { world.setPing(rtt); };

let mouseAngle = 0; 
let boost = false;

window.addEventListener('mousemove', (e) => {
  const cx = window.innerWidth / 2; 
  const cy = window.innerHeight / 2;
  mouseAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Shift') boost = true; });
window.addEventListener('keyup', (e) => { if (e.key === 'Shift') boost = false; });

// keep sending inputs
setInterval(() => net.setControls(mouseAngle, boost), 50);

let lastTime = performance.now();
app.ticker.add(() => {
  const now = performance.now();
  const dtMs = now - lastTime;          // milliseconds (your Camera expects ms)
  const dt = Math.min(0.05, dtMs / 1000); // seconds for snake physics
  lastTime = now;

  // ─────────────────────────────────────────
  // STEP SNAKE (client prediction feel)
  // ─────────────────────────────────────────
  snakeBody.boosting = boost;
  snakeBody.step(dt, mouseAngle);      // physics: head motion + resampling
  snakeView.renderSnake(snakeBody);    // draw body, head, eyes

  // ─────────────────────────────────────────
  // CAMERA FOLLOW (use your existing camera API)
  // ─────────────────────────────────────────
  // You used localSnake.sim.getState() previously; use our head
  const snakePos = snakeBody.head;
  const speedForCamera = boost ? 180 : 140;  // same numbers you used
  camera.update(dtMs, snakePos, speedForCamera);

  // Apply camera transform to world-space layers (grid + snake)
  const cam = camera.getTransform();
  const worldScale = cam.zoom;
  const worldOffsetX = -cam.x * cam.zoom + window.innerWidth / 2;
  const worldOffsetY = -cam.y * cam.zoom + window.innerHeight / 2;

 

  // ⟵ This replaces your old localSnake.getMaterial().getContainer()
  snakeView.scale.set(worldScale);
  snakeView.position.set(worldOffsetX, worldOffsetY);

  // Update grid visuals (your existing API)
  background.update(camera.getTransform());

  // (world container probably already transformed in WorldRenderer; if it isn't,
  // you can apply the same scale/position to world.container here as well.)
});
