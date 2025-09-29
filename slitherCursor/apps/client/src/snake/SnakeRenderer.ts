import * as PIXI from 'pixi.js';
import { SnakeBody, SNAKE, Vec2 } from './SnakeBody';
import { SnakeMaterial, BLUE } from './SnakeMaterial';

// --------------------------------------------------------------------------------------
const BOOST = {
  GLOW_RADIUS_SCALE: 1.5,
  PASSIVE_ALPHA: 0.10,        
  BASE_ALPHA: 0.28,
  FLICKER_GAIN: 0.15,
  FLICKER_OMEGA: 12.0,
  FLICKER_PHASE_STEP: Math.PI * 0.4,

  PULSE_SPEED_PX_PER_S: 268,
  PULSE_SIGMA_R: 2.3,
  PULSE_GAIN: 0.15,

  PULSE_SPAWN_INTERVAL_S: 1, // <- NEW: smaller = more pulses (keep speed same)
  MAX_PULSES: 1000,                // <- NEW: cap to avoid runaway

  DECAY_SECONDS: 0.12
};

const GlowTexCache: Record<number, PIXI.Texture> = {};
function makeRadialGlowTexture(radiusPx: number): PIXI.Texture {
  const key = Math.max(4, Math.round(radiusPx));
  if (GlowTexCache[key]) return GlowTexCache[key];
  const size = key * 2;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d')!;
  const g = ctx.createRadialGradient(key, key, 0, key, key, key);
  g.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.5)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(key, key, key, 0, Math.PI * 2); ctx.fill();
  const tex = PIXI.Texture.from(cnv);
  GlowTexCache[key] = tex;
  return tex;
}
// --------------------------------------------------------------------------------------

export class SnakeRenderer extends PIXI.Container {
  private app: PIXI.Application;

  private bodySprites: PIXI.Sprite[] = [];
  private leftEye!: PIXI.Graphics;
  private rightEye!: PIXI.Graphics;

  // glow (behind body)
  private glowLayer: PIXI.Container = new PIXI.Container();
  private glowSprites: PIXI.Sprite[] = [];

// pulse state (multi)
  private pulses: number[] = []; // each = arc-length from head (px)
  private spawnAcc = 0;          // spawn timer accumulator
  private tClock = 0;
  private lastDt = 0;


    // "over" pulses (rendered above the body)
  private pulseLayer: PIXI.Container = new PIXI.Container();
  private pulseSprites: PIXI.Sprite[] = [];

  private readonly fallbackTint = 0x8C7BFF;
  private readonly fallbackTintGlow = 0xE6E0FF;
  private palette = BLUE;




  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    // glow layer at the bottom
    this.addChild(this.glowLayer);

    // pulse layer on top of glow
    this.addChild(this.pulseLayer);

    // eyes (always on top)
    this.leftEye = new PIXI.Graphics();
    this.rightEye = new PIXI.Graphics();
    this.addChild(this.leftEye, this.rightEye);
  }

  tick(dt: number) {
    this.tClock += dt;
    this.lastDt = dt;
  }

  renderSnake(body: SnakeBody) {
    const pts = body.getPoints();
    if (!pts || pts.length === 0) return;

    const R = SNAKE.radius;
    const headR = R; // head == body

    // pulse progress / decay
    // spawn pulses while boosting (multiple visible); none when not boosting
if (body.boosting) {
  this.spawnAcc += (this.lastDt || 1/60);
  const T = BOOST.PULSE_SPAWN_INTERVAL_S;
  while (this.spawnAcc >= T && this.pulses.length < BOOST.MAX_PULSES) {
    this.pulses.push(0);     // new pulse at the head (s = 0)
    this.spawnAcc -= T;
  }
} else {
  // stop spawning; existing pulses keep traveling until they pass the tail
  this.spawnAcc = 0;
}

// advance pulses & cull after they move beyond (tail + margin)
const v = BOOST.PULSE_SPEED_PX_PER_S;
for (let k = 0; k < this.pulses.length; k++) this.pulses[k] += v * (this.lastDt || 1/60);


    // textures / pools
    const bodyTex = this.getSafeTexture(R);
    const glowTex = makeRadialGlowTexture(BOOST.GLOW_RADIUS_SCALE * R);
    this.ensurePools(pts.length, bodyTex, glowTex, R);

    

    // arc-lengths (head=0) for pulse gaussian
    const S: number[] = new Array(pts.length).fill(0);
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      S[i] = S[i - 1] + Math.hypot(dx, dy);
      
    }

    // place sprites
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const s = this.bodySprites[i];
      const g = this.glowSprites[i];

      // body disc
      s.visible = true;
      s.texture = bodyTex;
      if (bodyTex === PIXI.Texture.WHITE) s.tint = this.fallbackTint;
      s.position.set(p.x, p.y);

      const t: Vec2 =
        i < pts.length - 1
          ? { x: pts[i + 1].x - p.x, y: pts[i + 1].y - p.y }
          : { x: p.x - pts[i - 1].x, y: p.y - pts[i - 1].y };
      s.rotation = Math.atan2(t.y, t.x);

      // glow (behind)
      // passive outer boost glow (BEHIND body) — only while boosting
g.visible = body.boosting;
g.position.set(p.x, p.y);
g.rotation = s.rotation;

const baseA =
  BOOST.BASE_ALPHA *
  (1 + BOOST.FLICKER_GAIN * Math.sin(this.tClock * BOOST.FLICKER_OMEGA + i * BOOST.FLICKER_PHASE_STEP));

g.alpha = Math.max(0, baseA);

// 2) Traveling pulses (OVER body) — sum of Gaussians from all active pulses
const pOver = this.pulseSprites[i];
pOver.visible = this.pulses.length > 0;
pOver.position.set(p.x, p.y);
pOver.rotation = s.rotation;

let a = 0;
if (this.pulses.length) {
  const sigma = BOOST.PULSE_SIGMA_R * headR;
  const inv2s2 = 1 / (2 * sigma * sigma);
  const Si = S[i]; // arc-length of this disc from head
  for (let k = 0; k < this.pulses.length; k++) {
    const ds = Si - this.pulses[k];
    a += Math.exp(-ds * ds * inv2s2);
  }
  a *= BOOST.PULSE_GAIN; // scale after summing
}
pOver.alpha = Math.min(1, a);

    }

    // head frame from the *visual* tangent of the first two resampled points
    const headP = pts[0];
  const ahead = SNAKE.radius * SNAKE.overlap;           // look ahead by one disc spacing
  let j = 0;
  while (j + 1 < pts.length && S[j + 1] < ahead) j++;
  const segLen = (j + 1 < pts.length) ? (S[j + 1] - S[j]) : 0;
  const tAhead = segLen > 0 ? (ahead - S[j]) / segLen : 0;
  const ax = (j + 1 < pts.length) ? (pts[j].x + (pts[j + 1].x - pts[j].x) * tAhead) : pts[0].x + 1;
  const ay = (j + 1 < pts.length) ? (pts[j].y + (pts[j + 1].y - pts[j].y) * tAhead) : pts[0].y;
  const dx = ax - headP.x, dy = ay - headP.y;
  const len = Math.hypot(dx, dy) || 1;
  const headF = { x: dx / len, y: dy / len };           // forward from fixed arc-length


    // Z order: glow bottom, body discs tail→head above glow, eyes top
    const n = pts.length;
    this.setChildIndex(this.glowLayer, 0);
    for (let i = 0; i < n; i++) this.setChildIndex(this.bodySprites[i], 1 + (n - 1 - i));
    this.setChildIndex(this.pulseLayer, 1 + n);
    this.setChildIndex(this.leftEye,  this.children.length - 1);
    this.setChildIndex(this.rightEye, this.children.length - 1);

    // eyes locked to front segment (no head sprite)
    this.drawEyesFromFrame(headP, headF);

    // wrap pulse position sometimes
    const totalS = S[S.length - 1] || 0;
// remove pulses once they are past the tail (add a small margin)
    this.pulses = this.pulses.filter(s => s <= totalS + 4 * headR);

    // DEBUG: print pulse info occasionally while boosting
    //if (body.boosting && Math.random() < 0.02) {
    //console.log('Active pulses:', this.pulses.length, 'spawnAcc:', this.spawnAcc.toFixed(3)); }

  }

  private ensurePools(n: number, bodyTex: PIXI.Texture, glowTex: PIXI.Texture, R: number) {
    while (this.bodySprites.length < n) {
      const s = new PIXI.Sprite(bodyTex);
      s.anchor.set(0.5);
      s.width = s.height = 2 * R;
      this.bodySprites.push(s);
      this.addChild(s); // above glow layer
    }
    for (let i = n; i < this.bodySprites.length; i++) this.bodySprites[i].visible = false;

    while (this.glowSprites.length < n) {
      const g = new PIXI.Sprite(glowTex);
      g.anchor.set(0.5);
      g.width = g.height = 2 * R * BOOST.GLOW_RADIUS_SCALE;
      g.tint = this.fallbackTintGlow;
      g.alpha = 0;
      g.blendMode = 'add';
      this.glowSprites.push(g);
      this.glowLayer.addChild(g);
    }
    for (let i = n; i < this.glowSprites.length; i++) this.glowSprites[i].visible = false;

    while (this.pulseSprites.length < n) {
      const p = new PIXI.Sprite(glowTex);
      p.anchor.set(0.5);
      p.width = p.height = 2 * R * BOOST.GLOW_RADIUS_SCALE;
      p.tint = this.fallbackTintGlow;
      p.alpha = 0;
      p.blendMode = 'add';
      this.pulseSprites.push(p);
      this.pulseLayer.addChild(p);
    }
    for (let i = n; i < this.pulseSprites.length; i++) this.pulseSprites[i].visible = false;

    for (let i = 0; i < n; i++) {
      const s = this.bodySprites[i];
      s.texture = bodyTex;
      s.width = s.height = 2 * R;

      const g = this.glowSprites[i];
      g.texture = glowTex;
      g.width = g.height = 2 * R * BOOST.GLOW_RADIUS_SCALE;
      const p = this.pulseSprites[i];
      p.texture = glowTex;
      p.width = p.height = 2 * R * BOOST.GLOW_RADIUS_SCALE;
    }
  }

  // Eyes anchored to the first body disc (head) using its local frame
  private drawEyesFromFrame(headCenter: { x: number; y: number }, forward: { x: number; y: number }) {
    const R   = SNAKE.radius;

    // slither-like proportions
    const Re  = 0.38 * R;    // sclera
    const Rp  = 0.55 * Re;   // pupil
    const d   = 0.80 * R;    // spacing
    const f   = -0.30 * R;    // forward offset of pair
    const v   = 0.06 * R;    // slight local "up"
    const rho = -0.30 * Re;   // pupil clamp
    const s = 0.00 * R // side offset

    const F = forward;                  // +X (forward)
    const U = { x: -F.y, y: F.x };      // +Y (local up/right)

    // origin of the eye pair (all offsets in head-local space)
    // local offsets
// knobs
const s2 = -0.05 * SNAKE.radius;   // <-- SIDE offset; + = snake’s right, − = left

// local offsets (forward along F, lateral along U)
let ox = f;
let oy = v + s2;                  // add side shift along the same local axis

// clamp (keeps the eye origin from “orbiting” the rim)
const rMax = 0.35 * SNAKE.radius;
const rLoc = Math.hypot(ox, oy);
if (rLoc > rMax) { const k = rMax / rLoc; ox *= k; oy *= k; }

const Ox = headCenter.x + ox * F.x + oy * U.x;
const Oy = headCenter.y + ox * F.y + oy * U.y;



    // centers split along U
    const exL = Ox - (d * 0.5) * U.x, eyL = Oy - (d * 0.5) * U.y;
    const exR = Ox + (d * 0.5) * U.x, eyR = Oy + (d * 0.5) * U.y;

    // pupils toward F, clamped inside white
    const clamp = (cx:number, cy:number, tx:number, ty:number) => {
      const dx = tx - cx, dy = ty - cy, L = Math.hypot(dx, dy) || 1;
      const k = Math.min(rho, L) / L;
      return { x: cx + dx * k, y: cy + dy * k };
    };
    const pL = clamp(exL, eyL, exL + F.x * R, eyL + F.y * R);
    const pR = clamp(exR, eyR, exR + F.x * R, eyR + F.y * R);

    this.leftEye
      .clear()
      .beginFill(0xffffff).drawCircle(exL, eyL, Re).endFill()
      .beginFill(0x101010).drawCircle(pL.x, pL.y, Rp).endFill();

    this.rightEye
      .clear()
      .beginFill(0xffffff).drawCircle(exR, eyR, Re).endFill()
      .beginFill(0x101010).drawCircle(pR.x, pR.y, Rp).endFill();
  }

  private getSafeTexture(radius: number): PIXI.Texture {
    try {
      const tex = SnakeMaterial.textureFor(this.app, this.palette, radius);
      if (!tex || !(tex as any).baseTexture) throw new Error('invalid baseTexture');
      return tex;
    } catch {
      return PIXI.Texture.WHITE;
    }
  }
}




