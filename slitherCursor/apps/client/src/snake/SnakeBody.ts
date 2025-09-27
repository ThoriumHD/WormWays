// apps/client/src/snake/SnakeBody.ts
export type Vec2 = { x: number; y: number };

export const SNAKE = {
  radius: 23,            // px
  overlap: 0.4,         // center spacing = overlap * radius (dense overlap for continuous tube)
  turnRate: 4.5,         // rad / sec
  speed: 250,            // px / sec
  boostSpeed: 625,       // px / sec
  historyMin: 24,        // more points => smoother spline
  historyMax: 1024,      // big enough so boost never outruns history
  resampleDt: 1 / 64,    // finer arc-length sampling
};

export function dir(a: number): Vec2 {
  return { x: Math.cos(a), y: Math.sin(a) };
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const a = 0.5, t2 = t * t, t3 = t2 * t;
  return {
    x: a * ((2 * p1.x) + (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: a * ((2 * p1.y) + (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export class SnakeBody {
  head: Vec2 = { x: 0, y: 0 };
  angle = 0;                  // radians
  boosting = false;
  score = 0;

  private history: Vec2[] = [];   // head-first trail
  private resampled: Vec2[] = []; // even spacing, head -> tail

  get r() { return SNAKE.radius; }
  get spacing() { return this.r * SNAKE.overlap; }

  /** visual segment count derived ONLY from score (NOT speed) */
  get targetSegments() { return 30 + Math.floor(this.score * 0.6); }

  reset(pos: Vec2, angle = 0) {
    this.head = { ...pos };
    this.angle = angle;
    this.history.length = 0;
    for (let i = 0; i < SNAKE.historyMin; i++) this.history.push({ ...pos });
    this.resampled.length = 0;
  }

  step(dt: number, desiredAngle: number) {
    // helpers (put these at file top-level or inside the class)
const angDiff = (t: number, a: number) =>
  Math.atan2(Math.sin(t - a), Math.cos(t - a));        // shortest signed delta in (-π, π]
const normPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)); // normalize to (-π, π]

// clamp turn using shortest delta
let da = angDiff(desiredAngle, this.angle);
const maxDa = SNAKE.turnRate * dt;
if (da > maxDa) da = maxDa;
if (da < -maxDa) da = -maxDa;

this.angle = normPi(this.angle + da);


    const speed = this.boosting ? SNAKE.boostSpeed : SNAKE.speed;
    const v = dir(this.angle);
    this.head.x += v.x * speed * dt;
    this.head.y += v.y * speed * dt;

    // push head into history
    this.history.unshift({ x: this.head.x, y: this.head.y });
    if (this.history.length > SNAKE.historyMax) this.history.length = SNAKE.historyMax;
    while (this.history.length < SNAKE.historyMin) this.history.push({ ...this.head });

    // resample to a FIXED visual arc-length (constant number of points),
    // padding the tail synthetically if we run out of history.
    const needCount = this.targetSegments;
    this.resampled = this.resampleEqualSpacingPadded(this.history, this.spacing, needCount);
  }

  getPoints(): ReadonlyArray<Vec2> {
    return this.resampled;
  }

  /**
   * Equal-spacing resampler that guarantees 'maxCount' samples by
   * synthetically extending the tail along its last tangent if history
   * length is insufficient. This makes visual length CONSTANT w.r.t speed.
   */
  private resampleEqualSpacingPadded(pts: Vec2[], spacing: number, maxCount: number): Vec2[] {
    // ensure >= 4 controls for Catmull-Rom
    if (pts.length < 4) {
      const copy = pts.slice();
      while (copy.length < 4) copy.push(copy[copy.length - 1]);
      pts = copy;
    }

    const out: Vec2[] = [];
    const head = { ...pts[0] };
    out.push(head);

    let remaining = spacing;
    let last = head;

    const consumeSegment = (a: Vec2, b: Vec2) => {
      let left = Math.hypot(b.x - a.x, b.y - a.y);
      if (left <= 1e-6) return a;
      // march along a->b, emitting samples each 'remaining'
      while (left >= remaining) {
        const t = (Math.hypot(b.x - a.x, b.y - a.y) - left + remaining) / Math.hypot(b.x - a.x, b.y - a.y);
        const sx = a.x + (b.x - a.x) * t;
        const sy = a.y + (b.y - a.y) * t;
        out.push({ x: sx, y: sy });
        if (out.length >= maxCount) return { x: sx, y: sy };
        last = { x: sx, y: sy };
        left -= remaining;
        remaining = spacing;
      }
      remaining -= left;
      return b;
    };

    // traverse Catmull-Rom
    for (let i = 0; i < pts.length - 3 && out.length < maxCount; i++) {
      let prev = catmullRom(pts[i], pts[i+1], pts[i+2], pts[i+3], 0);
      for (let t = SNAKE.resampleDt; t <= 1 + 1e-6 && out.length < maxCount; t += SNAKE.resampleDt) {
        const cur = catmullRom(pts[i], pts[i+1], pts[i+2], pts[i+3], Math.min(t, 1));
        prev = consumeSegment(prev, cur);
      }
    }

    // If not enough curve, PAD by extruding straight along the last tangent
    if (out.length < maxCount) {
      const n = out.length;
      // last direction from the last two points we have (fallback to head dir)
      const a = out[n - 1];
      const b = n >= 2 ? out[n - 2] : { x: a.x - Math.cos(this.angle), y: a.y - Math.sin(this.angle) };
      let tx = a.x - b.x, ty = a.y - b.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len; // unit tail direction (away from head)

      while (out.length < maxCount) {
        const tail = out[out.length - 1];
        out.push({ x: tail.x - tx * spacing, y: tail.y - ty * spacing });
      }
    }

    return out;
  }
}
