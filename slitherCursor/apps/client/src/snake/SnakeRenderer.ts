// apps/client/src/snake/SnakeRenderer.ts
import * as PIXI from 'pixi.js';
import { SnakeBody, SNAKE, dir, Vec2 } from './SnakeBody';
import { SnakeMaterial, PURPLE } from './SnakeMaterial';

// --- BOOST VISUALS (spec numbers) -------------------------------------------
const BOOST = {
  glowScale: 1.9,          // R_glow = 1.9 * R
  glowAlphaBase: 0.28,     // base halo opacity
  flickerAmp: 0.15,        // ±15%
  flickerOmega: 12.0,      // rad/s
  flickerPhaseStep: Math.PI * 0.4,

  pulseSpeedPxPerSec: 168, // ≈ 2.8 * R0 @60fps
  pulseSigmaFactor: 1.3,   // σ_s ≈ 1.3 * R_head
  pulseAlphaGain: 1.6,     // multiply alpha within pulse
  pulseLighten: 0.10       // lighten toward white in pulse (halo tint)
};

// lighten color toward white by t∈[0,1] in sRGB
function lightenTowardWhite(rgb: number, t: number): number {
  const r0 = (rgb >> 16) & 255, g0 = (rgb >> 8) & 255, b0 = rgb & 255;
  const r = Math.min(255, Math.round(r0 + (255 - r0) * t));
  const g = Math.min(255, Math.round(g0 + (255 - g0) * t));
  const b = Math.min(255, Math.round(b0 + (255 - b0) * t));
  return (r << 16) | (g << 8) | b;
}

// make a small radial gaussian glow texture once
function makeGlowTexture(app: PIXI.Application): PIXI.Texture {
  const g = new PIXI.Graphics();
  const size = 64, c = size * 0.5, r = size * 0.45;
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const rr = r * (1 + 0.2 * t);
    const a = Math.exp(-t * t * 3.5); // gaussian-ish
    g.clear();
    g.beginFill(0xffffff, a);
    g.drawCircle(c, c, rr);
    g.endFill();
  }
  const tex = app.renderer.generateTexture(
    g,
    { resolution: 1, region: new PIXI.Rectangle(0, 0, size, size) }
  );
  g.destroy(true);
  return tex;
}


export class SnakeRenderer extends PIXI.Container {
  private app: PIXI.Application;
  private bodySprites: PIXI.Sprite[] = [];
  private headSprite: PIXI.Sprite;
  private leftEye!: PIXI.Graphics;
  private rightEye!: PIXI.Graphics;

    /** additive glow sprites (index 0 = head glow, then one per body point) */
    private glowSprites: PIXI.Sprite[] = [];
    private glowTexture!: PIXI.Texture;
  
    /** boost timing */
    private lastBoosting = false;
    private boostStartMs = 0;
  

  // when we have to fall back to Texture.WHITE, tint with this
  private readonly fallbackTint = 0x8C7BFF; // pleasant purple
  private palette = PURPLE;

  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    // ---- HEAD ----
    const headTex = this.getSafeTexture(SNAKE.radius);
    this.headSprite = new PIXI.Sprite(headTex);
    this.headSprite.anchor.set(0.5);

    // IMPORTANT: always size the sprite (works for both custom tex and Texture.WHITE)
    this.headSprite.width = this.headSprite.height = 2 * SNAKE.radius * SNAKE.headScale;
    this.headSprite.alpha = 1;
    // If using the fallback, make it visible
    if (headTex === PIXI.Texture.WHITE) this.headSprite.tint = this.fallbackTint;

    this.addChild(this.headSprite);

    // ---- EYES ----
    this.leftEye = new PIXI.Graphics();
    this.rightEye = new PIXI.Graphics();
    this.addChild(this.leftEye, this.rightEye);

        // ---- GLOW SETUP (one head glow sprite; body glow sprites are pooled on demand)
        this.glowTexture = makeGlowTexture(this.app);

        const headGlow = new PIXI.Sprite(this.glowTexture);
        headGlow.anchor.set(0.5);
        headGlow.blendMode = 'add' as any; // v8-safe
        headGlow.alpha = 0;
        // keep glow behind body discs
        this.addChildAt(headGlow, 0);
        this.glowSprites.push(headGlow);
    
  }

  /**
   * Render one full snake frame.
   * Uses sprite pooling for body discs and a sized head sprite.
   */
  renderSnake(body: SnakeBody) {
    const pts = body.getPoints();
    if (!pts || pts.length === 0) return;

    // Read/refresh texture (handles device/context loss too)
    const tex = this.getSafeTexture(SNAKE.radius);

    // ---- Ensure sprite pool size ----
    while (this.bodySprites.length < pts.length) {
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);

      // Always size explicitly so Texture.WHITE shows as a disc
      s.width = s.height = 2 * SNAKE.radius;
      s.alpha = 1;
      if (tex === PIXI.Texture.WHITE) s.tint = this.fallbackTint;

      this.bodySprites.push(s);
      // body behind head/eyes
      this.addChildAt(s, 0);
    }
    // Hide extra pooled sprites
    for (let i = pts.length; i < this.bodySprites.length; i++) {
      this.bodySprites[i].visible = false;
    }

    // ---- Position & orient discs (head -> tail) ----
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const s = this.bodySprites[i];

      s.visible = true;
      s.texture = tex; // keep updated if tex changed
      if (tex === PIXI.Texture.WHITE) s.tint = this.fallbackTint;

      s.position.set(p.x, p.y);

      // orient along local tangent (optional, helps gloss orientation if you have it)
      const t: Vec2 =
        i < pts.length - 1
          ? { x: pts[i + 1].x - p.x, y: pts[i + 1].y - p.y }
          : { x: p.x - pts[i - 1].x, y: p.y - pts[i - 1].y };
      s.rotation = Math.atan2(t.y, t.x);

      // subtle ribbing (can be turned off by setting to 1)
      const rib = 1 + 0.00 * Math.sin(i * 0.45);
      s.scale.set(rib, rib);
    }

    // ---- Head ----
    this.headSprite.texture = tex;
    if (tex === PIXI.Texture.WHITE) this.headSprite.tint = this.fallbackTint;

    // keep the head size consistent every frame
    this.headSprite.width = this.headSprite.height = 2 * SNAKE.radius * SNAKE.headScale;
    this.headSprite.position.set(body.head.x, body.head.y);
    this.headSprite.rotation = body.angle;

    // ---- Eyes ----
    this.drawEyes(body);
  }

  /**
   * Draw slither-style eyes: paired sclera with forward-offset pupils.
   */
  private drawEyes(body: SnakeBody) {
    const R = SNAKE.radius * SNAKE.headScale;
  
    // Spec-ish ratios that looked right in your screenshots
    const Re = 0.38 * R;   // sclera
    const Rp = 0.22 * R;   // pupil
    const d  = 0.85 * R;   // separation
    const f  = 0.28 * R;   // forward offset
    const up = 0.10 * R;   // slight upward tilt
    const pupilOffset = 0.20 * SNAKE.radius;
  
    const a = body.angle;
    const fx = Math.cos(a), fy = Math.sin(a);       // forward (+X in local)
    const rx = -Math.sin(a), ry = Math.cos(a);      // right (+Y in local is screen up)
  
    // eye pair origin: forward + slight up
    const Ox = body.head.x + fx * f + (0 * rx) + (up * 0 + 0) * 0; // up handled by screen axis
    const Oy = body.head.y + fy * f - (0 * ry) + up;               // add 'up' in screen Y
  
    // centers: left is -d/2 along RIGHT? No: left is negative along 'rx,ry'
    const exL = Ox - rx * (d * 0.5);
    const eyL = Oy - ry * (d * 0.5);
    const exR = Ox + rx * (d * 0.5);
    const eyR = Oy + ry * (d * 0.5);
  
    // Pupils look along forward, clamped by rho
    const pxL = exL + fx * pupilOffset;
    const pyL = eyL + fy * pupilOffset;
    const pxR = exR + fx * pupilOffset;
    const pyR = eyR + fy * pupilOffset;
  
    this.leftEye.clear()
      .beginFill(0xffffff, 1).drawCircle(exL, eyL, Re).endFill()
      .beginFill(0x101010, 1).drawCircle(pxL, pyL, Rp).endFill();
  
    this.rightEye.clear()
      .beginFill(0xffffff, 1).drawCircle(exR, eyR, Re).endFill()
      .beginFill(0x101010, 1).drawCircle(pxR, pyR, Rp).endFill();
  }
  

  /**
   * Try to get the glossy segment texture; fall back to Texture.WHITE on error
   * and ensure its baseTexture is valid. Works during init and after context loss.
   */
  private getSafeTexture(radius: number): PIXI.Texture {
    try {
      const tex = SnakeMaterial.textureFor(this.app, this.palette, radius);
      if (!tex || !(tex as any).baseTexture) throw new Error('invalid baseTexture');
      return tex;
    } catch (e) {
      console.warn('SnakeMaterial.textureFor failed, using PIXI.Texture.WHITE', e);
      return PIXI.Texture.WHITE;
    }
  }
}
