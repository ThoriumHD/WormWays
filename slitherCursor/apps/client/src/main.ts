import { Net } from './net';
import { Snapshot, NET_CONSTANTS, ClientInput } from '@slither/common';
import { WorldRenderer } from './render/WorldRenderer';
import { Camera } from './view/Camera';
import { SnakeBody, SNAKE } from './snake/SnakeBody';
import { SnakeRenderer } from './snake/SnakeRenderer';
import Background from './view/Background';

// Global function declarations
declare global {
  interface Window {
    showGameOver: (score: number) => void;
    playAgain: () => void;
    returnToMainMenu: () => void;
  }
}

/* ──────────────────────────────────────────────────────────────
   BOOT LOGS + EARLY CONNECT (before Canvas init)
   ────────────────────────────────────────────────────────────── */
console.log('[BOOT] main.ts loaded', new Date().toISOString());
console.log('[BOOT] VITE_SERVER_URL (from code) =', import.meta.env.VITE_SERVER_URL);

const net = new Net();
try {
  console.log('[BOOT] calling net.connect()…');
  console.log('[BOOT] Net instance created, about to connect');
  
  // Add a small delay to ensure any previous connection is fully closed
  setTimeout(() => {
    net.connect('Player');                       // connect ASAP so we see WS in Network
    console.log('[BOOT] net.connect() call completed');
  }, 100);
  (window as any).net = net;                   // inspect in DevTools
  (window as any).__connect = () => {          // manual retry from DevTools if needed
    console.log('[BOOT] manual __connect()');
    new Net().connect('Manual');
  };
} catch (e) {
  console.error('[BOOT] net.connect threw', e);
  console.error('[BOOT] Error stack:', e instanceof Error ? e.stack : 'No stack trace');
}

/* ──────────────────────────────────────────────────────────────
   CANVAS 2D SETUP
   ────────────────────────────────────────────────────────────── */
console.log('[BOOT] VITE_SERVER_URL =', import.meta.env.VITE_SERVER_URL);

// Create canvas element
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
if (!ctx) {
  throw new Error('Failed to get 2D context from canvas');
}

// Set canvas size
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.background = '#0b0f1a';

// Add canvas to DOM
document.getElementById('app')!.appendChild(canvas);

// Handle window resize
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

console.log('[BOOT] Canvas 2D initialized successfully');

// Camera and renderers
const camera = new Camera();
const world = new WorldRenderer(ctx);
const snakeRenderer = new SnakeRenderer(ctx);

// Create background (async)
let background: Background | null = null;
try {
  // Use Vite's asset handling for the hex image
  const hexImageUrl = new URL('/assets/hex-tile.png', import.meta.url).href;
  console.log('[BOOT] Loading background from:', hexImageUrl);
  background = await Background.create(ctx, hexImageUrl);
  console.log('[BOOT] Background loaded successfully');
} catch (error) {
  console.warn('[BOOT] Failed to load background:', error);
}

// UI screens - now handled by HTML

// Game state
let gameState: 'landing' | 'playing' | 'gameOver' = 'landing';
let localPlayerId: string | null = null;
let localSnake: SnakeBody | null = null;
let otherPlayerSnakes = new Map<string, SnakeBody>(); // playerId -> SnakeBody instance

// ─────────────────────────────────────────────
// EVENT HANDLERS
// ─────────────────────────────────────────────

// Landing page events
window.addEventListener('startGame', () => {
  gameState = 'playing';
  if (localSnake) {
    localSnake.reset({ x: 0, y: 0 }, 0);
    localSnake.score = 0;
  }
  
  // Restart the game loop
  requestAnimationFrame(gameLoop);
});

// Game over screen events
window.addEventListener('playAgain', () => {
  // Reset game state
  gameState = 'playing';
  if (localSnake) {
    localSnake.reset({ x: 0, y: 0 }, 0);
    localSnake.score = 0;
  }
  
  // Reset game container opacity
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.opacity = '1';
  }
  
  // Ensure game container is visible
  document.getElementById('game-container')!.style.display = 'block';
  
  // Restart the game loop
  requestAnimationFrame(gameLoop);
});

window.addEventListener('returnToMainMenu', () => {
  // Simply refresh the page to ensure clean state
  window.location.reload();
});

// ─────────────────────────────────────────────
// LOCAL SNAKE (logic + renderer)
// ─────────────────────────────────────────────
const snakeBody = new SnakeBody();
snakeBody.setNet(net);
snakeBody.reset({ x: 0, y: 0 }, 0);
localSnake = snakeBody; // Store reference for multiplayer

/* Attach handlers AFTER world/snake are ready.
   net is already connected; these will start receiving events immediately. */
net.onWelcome = (data) => {
  console.log('[net] welcome', data);
  console.log(`[Client] World size: ${data.worldSize}`);
  localPlayerId = data.playerId;
  console.log('[Client] Set localPlayerId to:', localPlayerId);
  world.setWorldSize(data.worldSize || 8000); // Pass world size to renderer
  if (background) {
    background?.setWorldSize(data.worldSize || 8000); // Pass world size to background
  }
  snakeBody.reset({ x: 0, y: 0 }, 0);
};

net.onState = (snapshot: Snapshot) => {
  // Snapshot is already pushed to buffer in net.ts
  // Here we handle reconciliation for local player ONLY when there's significant desync
  
  if (!localPlayerId) return;
  
  const localPlayerData = snapshot.players.find(p => p.playerId === localPlayerId);
  if (!localPlayerData) return;
      
  // Update non-positional state (these should always sync)
  snakeBody.score = localPlayerData.score;
  snakeBody.isDead = localPlayerData.isDead;
  snakeBody.deathAnimationProgress = localPlayerData.deathAnimationProgress;
  snakeBody.snakeFadeProgress = localPlayerData.snakeFadeProgress;
  snakeBody.actualSegmentCount = localPlayerData.actualSegments;
  snakeBody.setBoostPoints(localPlayerData.boostPoints);
  snakeBody.color = localPlayerData.color || '#4A90E2';
      
  // Check if snake just died
  if (localPlayerData.isDead && !snakeBody.isDead) {
        console.log('[Client] Snake died, triggering death animation');
        snakeBody.triggerDeath();
    // On death, always sync position
    snakeBody.setFromPoints(localPlayerData.points, localPlayerData.angle);
    return;
  }
  
  // RECONCILIATION: Only reconcile if there's MAJOR desync (>150px) - prevent all teleportation
  const serverHead = localPlayerData.head;
        const localHead = snakeBody.head;
        const distance = Math.sqrt(
          (serverHead.x - localHead.x) ** 2 + (serverHead.y - localHead.y) ** 2
        );
        
  const ackedTick = snapshot.acks[localPlayerId] || 0;
  const segmentCountDiff = Math.abs(snakeBody.getPoints().length - localPlayerData.points.length);
  const segmentCountMismatch = segmentCountDiff > 0;
  
  // Drop acknowledged inputs (always do this)
  net.reconciler.dropAcknowledged(ackedTick);
  
  // Update segment count for gradual growth (always, regardless of distance)
  if (segmentCountMismatch && Math.abs(snakeBody.actualSegmentCount - localPlayerData.actualSegments) > 0) {
    snakeBody.actualSegmentCount = localPlayerData.actualSegments;
  }
  
  // Increase threshold significantly to prevent frequent reconciliation
  // Only reconcile for major desyncs - never on normal segment growth
  const correctionThreshold = Math.max(snakeBody.spacing * 3, 50);
  // Only reconcile on position desync, NOT on segment count changes
  // Segment growth is handled gracefully by ensureCorrectSegmentCount
  const needsTrailRebuild = distance > correctionThreshold;

  if (needsTrailRebuild) {
    snakeBody.reconcileAndRebuildTrail(localPlayerData.points, localPlayerData.angle, ackedTick);
    snakeBody.setBoosting(localPlayerData.boosting);

    const unackedInputs = net.reconciler.getUnacknowledgedInputs(ackedTick);
    const fixedDt = NET_CONSTANTS.TICK_DELTA_MS / 1000;
    snakeBody.beginReconciliationReplay();
    for (const input of unackedInputs) {
      const currentHead = snakeBody.head;
      const dx = input.ax - currentHead.x;
      const dy = input.ay - currentHead.y;
      const distanceToInput = Math.sqrt(dx * dx + dy * dy);
      if (distanceToInput <= 0.5) {
        continue;
      }

      const desiredAngle = input.angle !== undefined ? input.angle : Math.atan2(dy, dx);
      const replayDt = input.dt !== undefined ? Math.min(Math.max(input.dt, 0.005), 0.05) : fixedDt;
      snakeBody.step(replayDt, desiredAngle);
      snakeBody.setBoosting(input.b);
    }
    snakeBody.endReconciliationReplay();
    snakeBody.finalizeReconciliation();
  } else {
    // Small desync - smooth correction without full reconciliation
    snakeBody.setBoosting(localPlayerData.boosting);
    
    // Smooth angle correction (only if difference is significant)
    let angleDiff = localPlayerData.angle - snakeBody.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    if (Math.abs(angleDiff) > 0.05) {
      // Only correct if angle difference is significant (>3 degrees)
      snakeBody.angle += angleDiff * 0.1; // Very gentle correction
    }
    
    // Very gentle head position correction for small desyncs
    if (distance > 5 && distance <= correctionThreshold) {
      const head = snakeBody.head;
      const dx = serverHead.x - head.x;
      const dy = serverHead.y - head.y;
      // Very slow correction (1% per frame) - only noticeable over many frames
      head.x += dx * 0.01;
      head.y += dy * 0.01;
      
      // Update history head to match
      if (snakeBody['history'].length > 0) {
        snakeBody['history'][0].x = head.x;
        snakeBody['history'][0].y = head.y;
      }
    }
  }
  
  // Update world with server food
  world.update({ snakeHead: snakeBody.head, serverFood: snapshot.food });
};

net.onPong = (rtt) => {
  // Update ping display if needed
  console.log('[net] pong', rtt);
};

net.onError = (error) => {
  console.error('[net] Server error:', error.message);
  // Could show error UI here
};

net.onDisconnect = () => {
  console.log('[net] Disconnected from server');
  // Could show reconnection UI here
};

/* ─────────────────────────────────────────────
   INPUT + TICK
   ───────────────────────────────────────────── */
let mouseX = 0;
let mouseY = 0;
let boost = false;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});
window.addEventListener('keydown', (e) => { if (e.key === 'Shift') boost = true; });
window.addEventListener('keyup',   (e) => { if (e.key === 'Shift') boost = false; });

// Left click boost support (only when clicking on the game canvas)
canvas.addEventListener('mousedown', (e) => { 
  if (e.button === 0) {
    boost = true;
    e.preventDefault(); // Prevent default click behavior
  }
});
canvas.addEventListener('mouseup',   (e) => { 
  if (e.button === 0) {
    boost = false;
    e.preventDefault(); // Prevent default click behavior
  }
});

// Input sending is now handled in the game loop with proper world coordinate conversion

let lastTime = performance.now();

function gameLoop() {
  const now = performance.now();
  const dtMs = now - lastTime;               // milliseconds (Camera expects ms)
  const dt = Math.min(0.05, dtMs / 1000);    // seconds for snake physics
  lastTime = now;

  // Clear canvas
  ctx!.clearRect(0, 0, canvas.width, canvas.height);

  // Handle different game states
  if (gameState === 'landing') {
    // Landing page is handled by HTML/CSS, stop the game loop
    return;
  }

  if (gameState === 'gameOver') {
    // Game over screen is now handled by HTML/CSS
    requestAnimationFrame(gameLoop);
    return;
  }

  // Playing state - normal game logic
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  
  // ============================================================================
  // LOCAL PLAYER: Client Prediction with Reconciliation
  // ============================================================================
  
  // Calculate mouse position in world coordinates
  const worldMouseX = (mouseX - cx) / camera.getTransform().zoom + snakeBody.head.x;
  const worldMouseY = (mouseY - cy) / camera.getTransform().zoom + snakeBody.head.y;

  const mouseAngle = Math.atan2(mouseY - cy, mouseX - cx);

  // Create input and send to server
  const input: ClientInput = {
    ax: worldMouseX,
    ay: worldMouseY,
    b: boost && snakeBody.canBoost,
    dt,
    angle: mouseAngle,
  };
  net.sendInput(input);
  
  // Run client-side prediction (this is what makes movement feel instant)
  snakeBody.boosting = boost && snakeBody.canBoost;
  snakeBody.step(dt, mouseAngle);
  
  // ============================================================================
  // OTHER PLAYERS: Snapshot Interpolation with Smooth 60fps Movement
  // ============================================================================
  
  // IMPORTANT: Always update other players every frame for smooth 60fps movement
  // Even if we don't have new snapshot data, they continue moving forward
  
  // Calculate render time (120ms behind server time)
  const renderTime = net.timeSync.serverNow() - NET_CONSTANTS.INTERPOLATION_DELAY_MS;
  
  // Get snapshots bracketing render time
  const [snapshotBefore, snapshotAfter] = net.snapshotBuffer.getSnapshotsBracketing(renderTime);
  
  // Process snapshot corrections FIRST (head positions)
  // THEN update segments based on corrected head positions
  if (snapshotBefore && snapshotAfter) {
    // Interpolate between snapshots
    const t0 = snapshotBefore.serverTimeMs;
    const t1 = snapshotAfter.serverTimeMs;
    const alpha = (renderTime - t0) / (t1 - t0);
    
    // Clean up removed players
    const currentPlayerIds = new Set([
      ...snapshotBefore.players.map(p => p.playerId),
      ...snapshotAfter.players.map(p => p.playerId)
    ]);
    for (const [playerId] of otherPlayerSnakes) {
      if (!currentPlayerIds.has(playerId)) {
        otherPlayerSnakes.delete(playerId);
      }
    }
    
    // Interpolate each other player
    for (const playerAfter of snapshotAfter.players) {
      if (playerAfter.playerId === localPlayerId) continue;
      
      const playerBefore = snapshotBefore.players.find(p => p.playerId === playerAfter.playerId);
      if (!playerBefore) {
        // New player - use after snapshot
        let otherSnake = otherPlayerSnakes.get(playerAfter.playerId);
        if (!otherSnake) {
          otherSnake = new SnakeBody();
          otherPlayerSnakes.set(playerAfter.playerId, otherSnake);
        }
        // New player - directly use server points (no interpolation needed)
        otherSnake.setFromPoints(playerAfter.points, playerAfter.angle);
        
        otherSnake.score = playerAfter.score;
        otherSnake.isDead = playerAfter.isDead;
        otherSnake.deathAnimationProgress = playerAfter.deathAnimationProgress;
        otherSnake.snakeFadeProgress = playerAfter.snakeFadeProgress;
        otherSnake.actualSegmentCount = playerAfter.actualSegments;
        otherSnake.setBoostPoints(playerAfter.boostPoints);
        otherSnake.boosting = playerAfter.boosting;
        otherSnake.color = playerAfter.color || '#4A90E2';
        continue;
      }
      
      // Interpolate between before and after
      let otherSnake = otherPlayerSnakes.get(playerAfter.playerId);
      if (!otherSnake) {
        otherSnake = new SnakeBody();
        otherPlayerSnakes.set(playerAfter.playerId, otherSnake);
        otherSnake.color = playerAfter.color || '#4A90E2';
      }
      
      // Interpolate head position and angle from snapshots
      const headBefore = playerBefore.points[0] || playerBefore.points[playerBefore.points.length - 1];
      const headAfter = playerAfter.points[0] || playerAfter.points[playerAfter.points.length - 1];
      const targetHeadX = headBefore.x + (headAfter.x - headBefore.x) * alpha;
      const targetHeadY = headBefore.y + (headAfter.y - headBefore.y) * alpha;
      
      // Interpolate angle
      let angle0 = playerBefore.angle;
      let angle1 = playerAfter.angle;
      let angleDiff = angle1 - angle0;
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      const targetAngle = angle0 + angleDiff * alpha;
      
      // Update non-positional state first
      otherSnake.score = playerAfter.score;
      otherSnake.isDead = playerAfter.isDead;
      otherSnake.deathAnimationProgress = playerAfter.deathAnimationProgress;
      otherSnake.snakeFadeProgress = playerAfter.snakeFadeProgress;
      otherSnake.actualSegmentCount = playerAfter.actualSegments;
      otherSnake.setBoostPoints(playerAfter.boostPoints);
      otherSnake.boosting = playerAfter.boosting;
      otherSnake.color = playerAfter.color || '#4A90E2';
      
      // Check if player just died
      if (playerAfter.isDead && !otherSnake.isDead) {
        otherSnake.triggerDeath();
  }
  
      // NEW APPROACH: Directly interpolate ALL segments from server snapshots
      // No chain physics, no corrections - just pure interpolation of server positions
      const maxPoints = Math.max(playerBefore.points.length, playerAfter.points.length);
      const interpolatedPoints: Array<{ x: number; y: number }> = [];
      
      // Interpolate each segment position from server data
      for (let i = 0; i < maxPoints; i++) {
        const p0 = playerBefore.points[i] || playerBefore.points[playerBefore.points.length - 1];
        const p1 = playerAfter.points[i] || playerAfter.points[playerAfter.points.length - 1];
        interpolatedPoints.push({
          x: p0.x + (p1.x - p0.x) * alpha,
          y: p0.y + (p1.y - p0.y) * alpha
        });
      }
      
      // Directly set all segments from interpolated positions
      // This is the authoritative server state, so we use it directly
      otherSnake.setFromPoints(interpolatedPoints, targetAngle);
    }
  } else if (snapshotBefore) {
    // Only have before snapshot - use it directly
    for (const player of snapshotBefore.players) {
      if (player.playerId === localPlayerId) continue;
      
      let otherSnake = otherPlayerSnakes.get(player.playerId);
      if (!otherSnake) {
        otherSnake = new SnakeBody();
        otherPlayerSnakes.set(player.playerId, otherSnake);
        otherSnake.color = player.color || '#4A90E2';
      }
      
      // For single snapshot: directly use server points (authoritative state)
      otherSnake.setFromPoints(player.points, player.angle);
      
      otherSnake.score = player.score;
      otherSnake.isDead = player.isDead;
      otherSnake.color = player.color || '#4A90E2';
      otherSnake.boosting = player.boosting; // Sync boosting state for pulse animation
    }
  }
  
  // No need to update segments for players without snapshot data
  // We only use authoritative server positions via interpolation
  
  // ============================================================================
  // FOOD: Interpolate from snapshot buffer (done in WorldRenderer via world.update)
  // ============================================================================
  
  // Check if death animation is complete and transition to game over
  if (snakeBody.isDead && snakeBody.deathAnimationProgress >= 1.0 && gameState === 'playing') {
    // Start transition to game over screen
    gameState = 'gameOver';
    console.log('[GameOver] Death animation complete, transitioning to game over screen');
    console.log('[GameOver] Snake fade progress:', snakeBody.snakeFadeProgress);
    console.log('[GameOver] Death animation progress:', snakeBody.deathAnimationProgress);
    
    // Wait a bit more to ensure death animation is fully visible, then transition
    setTimeout(() => {
      console.log('[GameOver] Starting CSS transition to game over screen');
      // Use the new HTML-based game over screen
      if (typeof window.showGameOver === 'function') {
        window.showGameOver(Math.round(snakeBody.score));
      } else {
        console.error('[GameOver] showGameOver function not available!');
      }
    }, 200); // Small delay to ensure death animation is fully visible
    
    requestAnimationFrame(gameLoop);
    return;
  }
  
  // Update snake renderer
  snakeRenderer.tick(dt);

  // Camera follow
  const snakePos = snakeBody.head;
  const speedForCamera = boost ? 180 : 140;
  camera.update(dtMs, snakePos, speedForCamera, snakeBody.growthFactor);

  // Get camera transform
  const cam = camera.getTransform();

  // Render everything (background first, then game objects)
  if (background) {
    background.update(cam);
  }
  world.render(cam);
  
  // Render server food (interpolated from snapshot buffer)
  const latestSnapshot = net.snapshotBuffer.getLatest();
  if (latestSnapshot) {
    world.renderFood({}, dt, snakeBody.head, snakeBody.getBoostPoints());
  }
  
  // Render other players using SnakeBody instances (same rendering as local player)
  for (const [playerId, otherSnake] of otherPlayerSnakes) {
    // Update pulse system for other players (they don't step, so update pulses manually)
    const points = otherSnake.getPoints();
    if (points.length > 0) {
      let totalArcLength = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        totalArcLength += Math.hypot(dx, dy);
      }
      // Use actual frame delta for pulse updates
      otherSnake.updatePulses(dt, totalArcLength);
    }
    
    // Always render other players, including during death animation (same as local player)
    snakeRenderer.renderSnake(otherSnake, cam, false);
  }
  
  // Render local snake
  snakeRenderer.renderSnake(snakeBody, cam, true);
  
  // Draw world border last (after all game objects)
  world.renderWorldBorder();

  requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();