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
import { CoinManager, FoodManager } from './collectables';

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

const snakeView = new SnakeRenderer(app, 1.00);  // this is a PIXI.Container with $1.00 initial money
app.stage.addChild(snakeView);             // draw order: behind HUD

// Coin system
const coinManager = new CoinManager(app.stage);

// Food system
const foodManager = new FoodManager(app.stage);

// Spawn some initial coins and food
coinManager.spawnCoins(10, 0.10);
foodManager.spawnFoods(5);

// Show controls
console.log('🎮 Game Controls:');
console.log('  Mouse: Move to control snake direction');
console.log('  Shift: Hold to boost');
console.log('  M: Add $50 money');
console.log('  N: Show money display');
console.log('  C: Spawn a coin ($0.10)');
console.log('  V: Spawn 5 coins');
console.log('  F: Spawn food (increases length)');
console.log('  G: Spawn 3 foods');
console.log('💰 Collect coins to earn money! Starting with $1.00');
console.log('🍎 Collect food to grow longer!');

// Force show money display for testing
setTimeout(() => {
  snakeView.showMoneyDisplay();
  console.log('Money display forced to show. Current money:', snakeView.getMoney());
}, 1000);

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
window.addEventListener('keydown', (e) => { 
  if (e.key === 'Shift') boost = true;
  // Money system testing controls
  if (e.key === 'm') {
    snakeView.addMoney(50);
    console.log('Added 50 money! Current money:', snakeView.getMoney());
  }
  if (e.key === 'n') {
    snakeView.showMoneyDisplay();
    console.log('Forced money display to show');
  }
  // Coin system testing controls
  if (e.key === 'c') {
    const coin = coinManager.spawnRandomCoin(0.10);
    console.log('Spawned coin at:', coin.x, coin.y, 'with value $0.10');
  }
  if (e.key === 'v') {
    const coins = coinManager.spawnCoins(5, 0.10);
    console.log('Spawned 5 coins!');
  }
  // Food system testing controls
  if (e.key === 'f') {
    const food = foodManager.spawnRandomFood();
    console.log('Spawned food at:', food.x, food.y);
  }
  if (e.key === 'g') {
    const foods = foodManager.spawnFoods(3);
    console.log('Spawned 3 foods!');
  }
});
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
  snakeView.tick(dt, snakeBody.head);  // update money display and other animations with head position

  // ─────────────────────────────────────────
  // COIN COLLECTION
  // ─────────────────────────────────────────
  const collectedValue = coinManager.checkCollections(snakeBody.head.x, snakeBody.head.y, 10);
  if (collectedValue > 0) {
    snakeView.addMoney(collectedValue);
    console.log(`Collected $${collectedValue.toFixed(2)}! Total money: $${snakeView.getMoney().toFixed(2)}`);
  }

  // ─────────────────────────────────────────
  // FOOD COLLECTION
  // ─────────────────────────────────────────
  const collectedFood = foodManager.checkCollections(snakeBody.head.x, snakeBody.head.y, 10);
  if (collectedFood > 0) {
    // Increase snake length by the number of food collected
    snakeBody.score += collectedFood;
    snakeBody.maxLenFromScore = snakeBody.score * 8;
    console.log(`Collected ${collectedFood} food! Snake length increased to ${snakeBody.score}`);
  }

  // Update coins and food with magnetization
  coinManager.update(dt, snakeBody.head);
  foodManager.update(dt, snakeBody.head);

  // ─────────────────────────────────────────
  // CAMERA FOLLOW (use your existing camera API)
  // ─────────────────────────────────────────
  // You used localSnake.sim.getState() previously; use our head
  const snakePos = snakeBody.head;
  const speedForCamera = boost ? 180 : 140;  // same numbers you used
  camera.update(dtMs, snakePos, speedForCamera);

  // Apply camera transform to world-space layers (grid + snake + coins)
  const cam = camera.getTransform();
  const worldScale = cam.zoom;
  const worldOffsetX = -cam.x * cam.zoom + window.innerWidth / 2;
  const worldOffsetY = -cam.y * cam.zoom + window.innerHeight / 2;

  // Apply camera transform to coins and food
  coinManager.updateCoinPositions(worldScale, worldOffsetX, worldOffsetY);
  foodManager.updateFoodPositions(worldScale, worldOffsetX, worldOffsetY);

  // ⟵ This replaces your old localSnake.getMaterial().getContainer()
  snakeView.scale.set(worldScale);
  snakeView.position.set(worldOffsetX, worldOffsetY);

  // Update grid visuals (your existing API)
  background.update(camera.getTransform());

  // (world container probably already transformed in WorldRenderer; if it isn't,
  // you can apply the same scale/position to world.container here as well.)
});
