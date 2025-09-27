// apps/client/src/snake/SnakeMaterial.ts
import * as PIXI from 'pixi.js';

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

// A single “skin” – you can add more later.

export const BLUE = 0x007ba7;

type Key = string;
const cache = new Map<Key, PIXI.Texture>();

// ---------------- Tunables (no hard rim; soft glow + gloss) ------------------

const INNER_LIFT   = +0.12;                 // lighten center relative to base
const OUTER_DROP   = -0.08;                 // darken rim relative to base
const GLOSS_GAIN   = 0.16;                  // off-center gloss strength
const GLOSS_ANG    = 0 * Math.PI / 180;    // gloss azimuth (from +X toward +Y)


// Soft outer glow (white, *behind* the bead)
const OUTER_GLOW_ALPHA = 0.12;
const OUTER_GLOW_SCALE = 1.06;  // glow radius factor vs bead radius
const OUTER_GLOW_BLUR  = 1.5;   // px

// Very subtle under-bead shadow (grounding); keep small
const SHADOW_ALPHA = 0.10;
const SHADOW_BLUR  = 1.5;       // px
const SHADOW_OFFSET_Y = 0.25;   // as fraction of radius
const SHADOW_A = 1.20;          // ellipse major axis (x) vs radius
const SHADOW_B = 0.35;          // ellipse minor axis (y) vs radius

// ---------------------------------------------------------------------------
// Utility color helpers
function hexToRgb(hex: number): Rgb {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}
function rgbToHex({ r, g, b }: Rgb): number {
  return (r << 16) | (g << 8) | b;
}
function clamp01(x: number) { return Math.min(1, Math.max(0, x)); }

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  r /= 255; b /= 255; g /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}
function hslToRgb({ h, s, l }: Hsl): Rgb {
  h = (h % 360 + 360) % 360; s = clamp01(s); l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if      (0 <= hp && hp < 1) { r = c; g = x; }
  else if (1 <= hp && hp < 2) { r = x; g = c; }
  else if (2 <= hp && hp < 3) { g = c; b = x; }
  else if (3 <= hp && hp < 4) { g = x; b = c; }
  else if (4 <= hp && hp < 5) { r = x; b = c; }
  else if (5 <= hp && hp < 6) { r = c; b = x; }
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

function lighten(hex: number, dl: number): number {
  const hsl = rgbToHsl(hexToRgb(hex)); hsl.l = clamp01(hsl.l + dl);
  return rgbToHex(hslToRgb(hsl));
}
function darken(hex: number, dl: number): number {
  const hsl = rgbToHsl(hexToRgb(hex)); hsl.l = clamp01(hsl.l - dl);
  return rgbToHex(hslToRgb(hsl));
}

// ---------------------------------------------------------------------------
// Bead rasterization (Canvas2D -> Pixi texture)

function drawBeadCanvas(diam: number, baseHex: number): HTMLCanvasElement {
  // We allow a few pixels of padding for blur/glow so nothing clips.
  const pad = 4; // px
  const size = Math.ceil(diam + 2 * pad);
  const r = diam / 2;          // bead radius
  const cx = pad + r;          // center X
  const cy = pad + r;          // center Y

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext('2d', { alpha: true })!;
  ctx.clearRect(0, 0, size, size);

  // --- 1) Very subtle under-bead shadow (beneath the disc) ---
  ctx.save();
  ctx.globalAlpha = SHADOW_ALPHA;
  ctx.filter = `blur(${SHADOW_BLUR}px)`;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(
    cx,
    cy + SHADOW_OFFSET_Y * r,
    SHADOW_A * r,
    SHADOW_B * r,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  // --- 2) Soft outer glow (white) drawn BEHIND the bead ---
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = OUTER_GLOW_ALPHA;
  ctx.filter = `blur(${OUTER_GLOW_BLUR}px)`;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, OUTER_GLOW_SCALE * r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 3) Base disc with radial gradient (no dark rim) ---
  const inner = lighten(baseHex, INNER_LIFT);
  const outer = darken(baseHex, OUTER_DROP);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0.0, `#${inner.toString(16).padStart(6, '0')}`);
  grad.addColorStop(0.85, `#${outer.toString(16).padStart(6, '0')}`);
  grad.addColorStop(1.0, `#${outer.toString(16).padStart(6, '0')}`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // --- 4) Off-center gloss (soft elliptical highlight) ---
  const ox = 0.22 * r * Math.cos(GLOSS_ANG);
  const oy = 0.22 * r * Math.sin(GLOSS_ANG);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; // add/screen-ish
  ctx.globalAlpha = GLOSS_GAIN;

  ctx.translate(cx + ox, cy + oy);
  ctx.rotate(GLOSS_ANG);
  ctx.scale(1.1, 0.55); // ellipse radii scale

  const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  gloss.addColorStop(0.0, 'rgba(255,255,255,1)');
  gloss.addColorStop(1.0, 'rgba(255,255,255,0)');

  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
}

// ---------------------------------------------------------------------------
// Public API

export class SnakeMaterial {
  /**
   * Returns (and caches) a glossy bead texture for a given radius & color.
   * Use the returned texture with sprites at scale 1.0 (no tint required).
   */
  static textureFor(
    app: PIXI.Application,
    baseHex: number,
    radius: number
  ): PIXI.Texture {
    const diam = Math.max(2, Math.round(radius * 2)); // ensure >= 2px
    // bump a version suffix so caches from "rim" builds don't get reused
    const key: Key = `${baseHex}_${diam}_v3`;
    const hit = cache.get(key);
    if (hit) return hit;

    const canvas = drawBeadCanvas(diam, baseHex);
    const tex = PIXI.Texture.from(canvas);
    tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR; // smooth
    cache.set(key, tex);
    return tex;
  }
}
