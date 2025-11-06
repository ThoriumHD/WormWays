// apps/client/src/snake/SnakeBody.ts
import { HistoryTrail, Vec2 } from './HistoryTrail';
import { SnakeAnimations, Pulse } from './SnakeAnimations';
import { SnakeReconciliation } from './SnakeReconciliation';
import { SnakeBoostSystem } from './SnakeBoostSystem';
import { SnakeGrowth } from './SnakeGrowth';
import { SnakeMovement } from './SnakeMovement';

export type { Vec2 };

// Debug logging for history tracking (set to true to enable)
const DEBUG_HISTORY = true;
let lastHistoryLog = 0;
const HISTORY_LOG_INTERVAL = 5000; // Log every 5 seconds

export const SNAKE = {
  radius: 21,            // px
  overlap: 0.4,         // center spacing = overlap * radius (dense overlap for continuous tube)
  turnRate: 4.5,         // rad / sec
  speed: 250,            // px / sec
  boostSpeed: 625,       // px / sec
  baseSpacing: 13.4,      // Base spacing between segments (radius * overlap = 23 * 0.4 = 9.2)
  
  // Growth system constants
  growthPerSegment: 0.0025,  // How much snake grows per segment (1.2% = 0.012)
  cameraZoomCompensation: 0.7,  // How much camera zooms out (0.7 = less compensation, 1.0 = full compensation)
  turnRateReduction: 0.3,  // How much turning speed reduces with length (0.3 = 30% reduction at max length)
  
  // Eye scaling constants
  eyeSeparation: 0.80,  // Base distance between eyes relative to head radius
  eyeSeparationPerSegment: 0.001,  // Additional separation per segment as fraction of radius (e.g., 0.01 = 1% of radius per segment)
  
  // Boost trail system constants
  minSegments: 12,           // Minimum segments (can't boost below this)
  boostMassLossRate: 1.0,    // Segments lost per second while boosting
  boostPelletDropRate: 2.0,  // Pellets dropped per second while boosting
  boostTrailRadius: 6,       // Radius of trail dots
  boostPointsPerSecond: 1.0, // Boost points accumulated per second (for anti-cheat)
  
  // Growth system constants
  pointsPerSegment: 2,       // How many food points needed for 1 segment
  
  // Death animation constants
  deathAnimationDuration: 2000,  // Death animation duration in ms
  deathDotMassRatio: 0.5,        // 50% of snake mass becomes dots
  deathDotBaseRadius: 8,         // Base radius for death dots
  deathDotMaxRadius: 15,        // Max radius for larger segments
};

export function dir(a: number): Vec2 {
  return SnakeMovement.getDirectionFromAngle(a);
}

export class SnakeBody {
  angle = 0;                  // radians
  boosting = false;
  score = 0;
  isDead = false;             // Death state
  deathAnimationProgress = 0;  // 0 to 1, death animation progress
  snakeFadeProgress = 0;      // 0 to 1, snake fade-out progress
  color = '#4A90E2';          // Snake color (default blue)

  private history: Vec2[] = [];   // head-first trail
  private resampled: Vec2[] = []; // even spacing, head -> tail
  private currentSpeed = SNAKE.speed; // smooth speed transition
  private net: any = null; // Network instance for sending boost trail pellets

  // Boost trail system
  private lastPelletTime = 0; // Last time a pellet was dropped
  private actualSegments = 12; // Actual segment count (can be reduced by boosting)
  private boostPoints = 0; // Accumulated boost points (for anti-cheat)
  private fractionalFoodPoints = 0; // Accumulated fractional food points for growth
  
  // Pulse system for boost glow animation (per-snake)
  pulses: Pulse[] = [];
  private spawnAcc = { value: 0 };
  private wasBoosting = false;

  // Reconciliation helpers
  private postCorrectionFrames = 0;
  private readonly HEALING_WINDOW = 2;
  private isReplayingInputs = false;

  // Death animation
  private deathDots: Array<{
    x: number;
    y: number;
    radius: number;
    progress: number; // 0 to 1, dot animation progress
    color: string;   // Color of the pellet
  }> = [];
  

  get r() { 
    // Snake grows slightly larger as it gains segments
    const growthFactor = 1.0 + (this.targetSegments - 20) * SNAKE.growthPerSegment;
    return SNAKE.radius * growthFactor; 
  }
  
  setNet(net: any) {
    this.net = net;
  }
  get spacing() { return this.r * SNAKE.overlap; }

  /** visual segment count derived ONLY from score (NOT speed) */
  get targetSegments() { return Math.max(SNAKE.minSegments, this.actualSegments); }
  
  /** Check if snake can boost (has enough segments) */
  get canBoost() { 
    return this.actualSegments > SNAKE.minSegments && this.resampled.length > SNAKE.minSegments; 
  }
  
  /** Head is now just the first body segment */
  get head(): Vec2 { 
    return this.resampled.length > 0 ? this.resampled[0] : { x: 0, y: 0 };
  }

  /** Get current boost points (for anti-cheat) */
  getBoostPoints() {
    return this.boostPoints;
  }

  /** Set boost points (for anti-cheat) */
  setBoostPoints(value: number) {
    this.boostPoints = Math.max(0, value);
  }

  /** Get actual segment count */
  get actualSegmentCount() {
    return this.actualSegments;
  }

  /** Set actual segment count */
  set actualSegmentCount(value: number) {
    this.actualSegments = Math.max(SNAKE.minSegments, Math.floor(value));
  }

  /** Add food points and handle fractional growth */
  addFoodPoints(points: number) {
    const result = SnakeGrowth.addFoodPoints(
      this.fractionalFoodPoints,
      this.actualSegments,
      SNAKE.pointsPerSegment,
      points
    );
    this.fractionalFoodPoints = result.fractionalFoodPoints;
    this.actualSegments = result.actualSegments;
  }

  /** Get growth factor for camera zoom compensation */
  get growthFactor() {
    return 1.0 + (this.targetSegments - 20) * SNAKE.growthPerSegment; // Same as radius growth
  }

  /** Get effective turn rate (reduces with snake length) */
  get effectiveTurnRate() {
    return SnakeMovement.calculateEffectiveTurnRate(
      SNAKE.turnRate,
      this.targetSegments,
      SNAKE.turnRateReduction
    );
  }

  /** Get color variants for gradients */
  getColorVariants() {
    return this.generateColorVariants(this.color);
  }

  /** Generate darker and lighter variants of a color for gradients */
  private generateColorVariants(baseColor: string) {
    // Parse hex color
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Generate variants
    const lighten = (factor: number) => {
      const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
      const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
      const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };
    
    const darken = (factor: number) => {
      const newR = Math.max(0, Math.floor(r * (1 - factor)));
      const newG = Math.max(0, Math.floor(g * (1 - factor)));
      const newB = Math.max(0, Math.floor(b * (1 - factor)));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };
    
    return {
      light: lighten(0.2),    // 20% lighter
      base: baseColor,         // Original color
      dark: darken(0.3),       // 30% darker
      darker: darken(0.5)      // 50% darker
    };
  }

  reset(pos: Vec2, angle = 0) {
    this.angle = angle;
    this.currentSpeed = SNAKE.speed;
    this.history.length = 0;
    this.resampled.length = 0;
    
    // Initialize all segments in a straight line behind the head
    this.actualSegments = 33; // Start with minimum segments
    const segmentSpacing = this.spacing;
    const backDir = SnakeMovement.getReverseDirectionFromAngle(angle);
    
    // Initialize head
    this.resampled.push({ ...pos });
    
    // Initialize remaining segments in a straight line behind head
    for (let i = 1; i < this.actualSegments; i++) {
      this.resampled.push({
        x: pos.x + backDir.x * segmentSpacing * i,
        y: pos.y + backDir.y * segmentSpacing * i
      });
    }
    
    // Initialize history with ALL segment positions (tail to head, reversed for path following)
    // This ensures the path-following system has a proper trail from the start
    for (let i = this.resampled.length - 1; i >= 0; i--) {
      this.history.push({ ...this.resampled[i] });
    }

    // Get tail direction from initialized segments
    const tailDir = this.resampled.length > 1
      ? {
          x: this.resampled[this.resampled.length - 1].x - this.resampled[this.resampled.length - 2].x,
          y: this.resampled[this.resampled.length - 1].y - this.resampled[this.resampled.length - 2].y
        }
      : SnakeMovement.getReverseDirectionFromAngle(this.angle);
    HistoryTrail.ensureTrailCoverage(this.history, tailDir, this.spacing, (this.resampled.length + 5) * this.spacing);
    this.history = HistoryTrail.padTrail(this.history, this.getTargetSegmentCount());
    this.resampled = HistoryTrail.sampleSegmentsFromHistory(this.history, this.angle, this.spacing, this.getTargetSegmentCount());
    
    // Reset boost trail system
    this.lastPelletTime = 0;
    this.boostPoints = 0;
    this.fractionalFoodPoints = 0;
    this.score = 0;
    
    // Reset death animation
    this.isDead = false;
    this.deathAnimationProgress = 0;
    this.snakeFadeProgress = 0;
    this.deathDots = [];
  }

  step(dt: number, desiredAngle: number) {
    // If dead, only update death animation
    if (this.isDead) {
      const result = SnakeAnimations.updateDeathAnimation(dt, this.deathAnimationProgress, this.snakeFadeProgress, this.isDead);
      this.deathAnimationProgress = result.deathAnimationProgress;
      this.snakeFadeProgress = result.snakeFadeProgress;
      return;
    }
    
    const applyingHealing = this.postCorrectionFrames > 0 && !this.isReplayingInputs;
    if (applyingHealing) {
      desiredAngle = SnakeReconciliation.applyMicroHealingClamp(
        desiredAngle,
        this.angle,
        this.effectiveTurnRate,
        dt
      );
    }

    // Validate desired angle
    if (!isFinite(desiredAngle)) {
      desiredAngle = this.angle;
    }

    // Calculate turn delta with all constraints applied
    const da = SnakeMovement.calculateTurnDelta(
      desiredAngle,
      this.angle,
      this.effectiveTurnRate,
      dt
    );

    this.angle = SnakeMovement.normalizeAngle(this.angle + da);

    // Speed transition
    const targetSpeed = this.boosting ? SNAKE.boostSpeed : SNAKE.speed;
    this.currentSpeed = SnakeMovement.updateSpeed(
      this.currentSpeed,
      targetSpeed,
      dt
    );
    
    // Handle boost trail system
    const boostResult = SnakeBoostSystem.updateBoostTrail(
      dt,
      this.boosting,
      this.canBoost,
      this.lastPelletTime,
      this.actualSegments,
      this.boostPoints,
      this.resampled[this.resampled.length - 1],
      {
        boostPointsPerSecond: SNAKE.boostPointsPerSecond,
        boostMassLossRate: SNAKE.boostMassLossRate,
        boostPelletDropRate: SNAKE.boostPelletDropRate,
        boostTrailRadius: SNAKE.boostTrailRadius,
        minSegments: SNAKE.minSegments
      },
      this.net,
      this.color
    );
    this.lastPelletTime = boostResult.lastPelletTime;
    this.actualSegments = boostResult.actualSegments;
    this.boostPoints = boostResult.boostPoints;

    // Update pulse system for boost glow animation
    const points = this.getPoints();
    if (points.length > 0) {
      let totalArcLength = 0;
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        totalArcLength += Math.hypot(dx, dy);
      }
      SnakeAnimations.updatePulses(this.pulses, dt, this.boosting, this.wasBoosting, this.spawnAcc, totalArcLength);
    }
    this.wasBoosting = this.boosting;

    // SYNCHRONOUS SEGMENT-BASED MOVEMENT
    this.moveSegmentsSynchronously(dt);

    // History is updated inside moveSegmentsSynchronously for path following
    if (applyingHealing && !this.isReplayingInputs && this.postCorrectionFrames > 0) {
      this.postCorrectionFrames = Math.max(0, this.postCorrectionFrames - 1);
    }
  }
  
  private moveSegmentsSynchronously(dt: number) {
    if (this.resampled.length === 0) return;
    
    const movementDistance = this.currentSpeed * dt;
    const forward = dir(this.angle);
    
    // Move head forward
    this.resampled[0].x += forward.x * movementDistance;
    this.resampled[0].y += forward.y * movementDistance;
    const head = this.resampled[0];

    const healing = this.postCorrectionFrames > 0 && !this.isReplayingInputs;

    // Update history trail
    if (!healing) {
      this.history.unshift({ x: head.x, y: head.y });
    } else {
      if (this.history.length > 0) {
        this.history[0].x = head.x;
        this.history[0].y = head.y;
      } else {
        this.history.unshift({ x: head.x, y: head.y });
      }
    }

    // Keep history - no cap, allows full coverage for any snake size
    const targetSegments = this.getTargetSegmentCount();

    // Build cumulative distance along history trail from head (index 0) backwards
    const distances: number[] = [0];
    for (let i = 1; i < this.history.length; i++) {
      const dx = this.history[i - 1].x - this.history[i].x;
      const dy = this.history[i - 1].y - this.history[i].y;
      distances[i] = distances[i - 1] + Math.sqrt(dx * dx + dy * dy);
    }

    const maxAvailableDist = distances[distances.length - 1] || 0;

    // Log history usage periodically for debugging
    if (DEBUG_HISTORY) {
      const now = Date.now();
      if (now - lastHistoryLog > HISTORY_LOG_INTERVAL) {
        const historyMemoryKB = (this.history.length * 16) / 1024; // ~16 bytes per Vec2
        const pixelsCovered = maxAvailableDist;
        const segmentsCoverable = Math.floor(pixelsCovered / this.spacing);
        console.log(
          `[History] Points: ${this.history.length}, Memory: ${historyMemoryKB.toFixed(1)}KB, ` +
          `Distance: ${pixelsCovered.toFixed(0)}px, Segments Coverable: ${segmentsCoverable}, Current: ${this.resampled.length}`
        );
        lastHistoryLog = now;
      }
    }

    // MATCH SERVER EXACTLY: Path-following when history available, chain physics fallback
    for (let i = 1; i < this.resampled.length; i++) {
      const targetDistance = i * this.spacing;
      const prevSegment = i > 1 ? this.resampled[i - 1] : head;
      let segmentPos: Vec2;

      // Only use history trail if we have enough history for this segment
      if (this.history.length > 1 && distances.length > 0) {
        if (targetDistance <= maxAvailableDist && maxAvailableDist > 0) {
          // We have enough history - use path following
          let foundIndex = 1;
          for (let j = 1; j < distances.length; j++) {
            if (distances[j] >= targetDistance) {
              foundIndex = j;
              break;
            }
          }

          if (foundIndex < this.history.length) {
            // Interpolate between history points for smooth following
            const prevIdx = Math.max(0, foundIndex - 1);
            const nextIdx = foundIndex;

            if (prevIdx === nextIdx || foundIndex === 1) {
              // Use the exact point if we're at the beginning
              segmentPos = { ...this.history[prevIdx] };
            } else {
              // Interpolate between the two history points
              const distPrev = distances[prevIdx];
              const distNext = distances[nextIdx];
              const t = distNext > distPrev ? (targetDistance - distPrev) / (distNext - distPrev) : 0;
              segmentPos = {
                x: this.history[prevIdx].x + (this.history[nextIdx].x - this.history[prevIdx].x) * t,
                y: this.history[prevIdx].y + (this.history[nextIdx].y - this.history[prevIdx].y) * t
              };
            }
          } else {
            // Shouldn't happen due to check above, but fallback to spacing from previous
            const dx = prevSegment.x - this.resampled[i].x;
            const dy = prevSegment.y - this.resampled[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.01) {
              const dirX = dx / dist;
              const dirY = dy / dist;
              segmentPos = {
                x: prevSegment.x - dirX * this.spacing,
                y: prevSegment.y - dirY * this.spacing
              };
            } else {
              segmentPos = { ...this.resampled[i] };
            }
          }
        } else {
          // History too short - use chain physics (extend straight from previous segment)
          const dx = prevSegment.x - this.resampled[i].x;
          const dy = prevSegment.y - this.resampled[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.01) {
            const dirX = dx / dist;
            const dirY = dy / dist;
            segmentPos = {
              x: prevSegment.x - dirX * this.spacing,
              y: prevSegment.y - dirY * this.spacing
            };
          } else {
            segmentPos = { ...this.resampled[i] };
          }
        }
      } else {
        // No history available - extend straight from previous segment
        const dx = prevSegment.x - this.resampled[i].x;
        const dy = prevSegment.y - this.resampled[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.01) {
          const dirX = dx / dist;
          const dirY = dy / dist;
          segmentPos = {
            x: prevSegment.x - dirX * this.spacing,
            y: prevSegment.y - dirY * this.spacing
          };
        } else {
          segmentPos = { ...this.resampled[i] };
        }
      }

      // ALWAYS enforce exact spacing from previous segment to prevent gaps/flickering
      // This is the root fix - ensures consistent spacing regardless of history trail issues
      const dx = prevSegment.x - segmentPos.x;
      const dy = prevSegment.y - segmentPos.y;
      const actualDist = Math.sqrt(dx * dx + dy * dy);

      if (actualDist > 0.01 && Math.abs(actualDist - this.spacing) > 0.01) {
        // Adjust position to maintain exact spacing
        const dirX = dx / actualDist;
        const dirY = dy / actualDist;
        segmentPos.x = prevSegment.x - dirX * this.spacing;
        segmentPos.y = prevSegment.y - dirY * this.spacing;
      }

      this.resampled[i].x = segmentPos.x;
      this.resampled[i].y = segmentPos.y;
    }
    
    // Ensure we have the right number of segments
    const growthResult = SnakeGrowth.ensureCorrectSegmentCount(
      this.resampled,
      this.history,
      this.actualSegments,
      this.spacing,
      this.angle,
      SNAKE.minSegments
    );
    this.resampled = growthResult.resampled;
    this.history = growthResult.history;
  }

  // Trigger death animation
  triggerDeath() {
    if (this.isDead) return;
    
    this.isDead = true;
    this.deathAnimationProgress = 0;
    this.snakeFadeProgress = 0; // Start snake fade-out
    
    // Death dots are now created server-side and sent as food
    // No need to create them locally anymore
    this.deathDots = [];
  }
  
  // Get death dots for rendering
  getDeathDots() {
    return this.deathDots;
  }

  // Get snake fade progress for rendering
  getSnakeFadeProgress() {
    return this.snakeFadeProgress;
  }

  getPoints(): ReadonlyArray<Vec2> {
    return this.resampled;
  }

  /**
   * Wrapper method for updating pulses (used by other players)
   * This allows external code to update pulses without exposing private fields
   */
  updatePulses(dt: number, totalArcLength: number): void {
    SnakeAnimations.updatePulses(this.pulses, dt, this.boosting, this.wasBoosting, this.spawnAcc, totalArcLength);
    this.wasBoosting = this.boosting;
  }

  /**
   * Set snake segments directly from server correction
   * Used for reconciliation - overwrites local state with authoritative server state
   * Preserves history continuity to prevent path-following breaks
   * 
   * History format: [head (index 0 = newest), segment1, segment2, ..., tail (oldest)]
   * This matches the path-following system where segments follow backwards along history
   */
  setFromPoints(points: Vec2[], angle: number): void {
    if (points.length === 0) return;
    
    this.angle = angle;
    
    // Directly copy points from server - let chain physics correct spacing naturally
    // This is simpler and more reliable than trying to resample
    this.resampled.length = 0;
    for (const p of points) {
      this.resampled.push({ x: p.x, y: p.y });
    }
    
    // Rebuild history from segment positions (for compatibility, not used in chain physics)
    this.history.length = 0;
    for (let i = 0; i < this.resampled.length; i++) {
      this.history.push({ x: this.resampled[i].x, y: this.resampled[i].y });
    }
    
    // Pad history if needed
    const minHistoryNeeded = Math.max(this.resampled.length * 2, 50);
    while (this.history.length < minHistoryNeeded) {
      const tailPos = this.resampled.length > 0 
        ? { x: this.resampled[this.resampled.length - 1].x, y: this.resampled[this.resampled.length - 1].y }
        : { x: 0, y: 0 };
      this.history.push({ ...tailPos });
    }
  }

  /**
   * Set boosting state directly
   * Used for reconciliation
   */
  setBoosting(on: boolean): void {
    this.boosting = on;
  }

  reconcileAndRebuildTrail(serverPoints: Vec2[], serverAngle: number, _correctionTick: number): void {
    const { history, resampled } = SnakeReconciliation.buildTrailFromPoints(
      serverPoints,
      serverAngle,
      this.resampled,
      this.spacing,
      this.actualSegments,
      SNAKE.minSegments
    );
    this.history = history;
    this.resampled = resampled;
    this.angle = serverAngle;
    this.postCorrectionFrames = 0;
  }

  beginReconciliationReplay(): void {
    this.isReplayingInputs = true;
  }

  endReconciliationReplay(): void {
    this.isReplayingInputs = false;
  }

  finalizeReconciliation(): void {
    const { resampled, postCorrectionFrames } = SnakeReconciliation.finalizeReconciliation(
      this.history,
      this.angle,
      this.spacing,
      this.actualSegments,
      SNAKE.minSegments,
      this.HEALING_WINDOW
    );
    this.resampled = resampled;
    this.postCorrectionFrames = postCorrectionFrames;
  }

  private getTargetSegmentCount(): number {
    return Math.max(SNAKE.minSegments, Math.round(this.actualSegments));
  }

  /**
   * Update segments using chain physics - each segment follows its immediate neighbors
   * This is robust against history irregularities and prevents jitter propagation
   * Used for other players that are interpolated from server snapshots
   */
  updateSegmentsOnly(dt: number): void {
    if (this.resampled.length === 0) return;
    
    const head = this.resampled[0];
    
    // Chain physics: each segment positions based only on its immediate neighbors
    // This prevents history irregularities from propagating down the spine
    for (let i = 1; i < this.resampled.length; i++) {
      const prevSegment = i > 1 ? this.resampled[i - 1] : head;
      const currentSegment = this.resampled[i];
      
      // Calculate direction based on previous segments
      let dirX: number;
      let dirY: number;
      
      if (i >= 2) {
        // Use direction from segment i-2 to i-1 (smoothes out turns)
        const refSegment = this.resampled[i - 2];
        const dx = prevSegment.x - refSegment.x;
        const dy = prevSegment.y - refSegment.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0.01) {
          dirX = dx / dist;
          dirY = dy / dist;
        } else {
          // Fallback to snake angle if segments are overlapping
          dirX = -Math.cos(this.angle);
          dirY = -Math.sin(this.angle);
        }
      } else {
        // First segment uses snake's angle (backwards from head direction)
        dirX = -Math.cos(this.angle);
        dirY = -Math.sin(this.angle);
      }
      
      // Calculate target position (exact spacing from previous segment)
      const targetX = prevSegment.x - dirX * this.spacing;
      const targetY = prevSegment.y - dirY * this.spacing;
      
      // Calculate distance to target
      const dx = targetX - currentSegment.x;
      const dy = targetY - currentSegment.y;
      const distToTarget = Math.sqrt(dx * dx + dy * dy);
      
      // Adaptive smoothing based on distance to target
      // Large misalignments snap immediately, small ones smooth gradually
      if (distToTarget > this.spacing * 0.3) {
        // Large movement needed - snap immediately (fixes misalignment quickly)
        currentSegment.x = targetX;
        currentSegment.y = targetY;
      } else if (distToTarget > 0.05) {
        // Medium movement - smooth but fast interpolation
        const blend = 0.4;
        currentSegment.x += dx * blend;
        currentSegment.y += dy * blend;
      } else {
        // Small movement - gentle smoothing (prevents micro-jitter)
        const blend = 0.15;
        currentSegment.x += dx * blend;
        currentSegment.y += dy * blend;
      }
      
      // CRITICAL: Always enforce exact spacing after movement
      // This prevents compression and maintains perfect alignment
      const actualDx = currentSegment.x - prevSegment.x;
      const actualDy = currentSegment.y - prevSegment.y;
      const actualDist = Math.sqrt(actualDx * actualDx + actualDy * actualDy);
      
      if (actualDist > 0.01) {
        // Enforce exact spacing - prevents compression and maintains alignment
        currentSegment.x = prevSegment.x + (actualDx / actualDist) * this.spacing;
        currentSegment.y = prevSegment.y + (actualDy / actualDist) * this.spacing;
      } else {
        // Segments overlapping - use angle fallback
        currentSegment.x = prevSegment.x - dirX * this.spacing;
        currentSegment.y = prevSegment.y - dirY * this.spacing;
      }
    }
    
    // Rebuild history FROM segments (not used for positioning, just for compatibility)
    // This keeps history clean and synchronized with actual segment positions
    this.history.length = 0;
    for (let i = 0; i < this.resampled.length; i++) {
      this.history.push({ x: this.resampled[i].x, y: this.resampled[i].y });
    }
    
    // Pad history if needed (for any future path-following, though we don't use it now)
    const minHistory = Math.max(this.resampled.length * 2, 50);
    while (this.history.length < minHistory) {
      const tail = this.resampled.length > 0 
        ? this.resampled[this.resampled.length - 1]
        : { x: 0, y: 0 };
      this.history.push({ x: tail.x, y: tail.y });
    }
    
    // Update segment count if needed
    const growthResult = SnakeGrowth.ensureCorrectSegmentCount(
      this.resampled,
      this.history,
      this.actualSegments,
      this.spacing,
      this.angle,
      SNAKE.minSegments
    );
    this.resampled = growthResult.resampled;
    this.history = growthResult.history;
  }

}

