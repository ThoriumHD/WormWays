// apps/client/src/snake/SnakeReconciliation.ts
import { HistoryTrail, Vec2 } from './HistoryTrail';

/**
 * SnakeReconciliation handles server state synchronization and correction.
 * Manages the process of reconciling predicted client state with authoritative server state.
 */
export class SnakeReconciliation {
  /**
   * Build trail from server-provided points
   * Creates a smooth, padded history trail from a set of segment points
   */
  static buildTrailFromPoints(
    points: Vec2[],
    angle: number,
    resampled: Vec2[],
    spacing: number,
    actualSegments: number,
    SNAKE_minSegments: number
  ): { history: Vec2[]; resampled: Vec2[] } {
    const base: Vec2[] = [];
    if (points.length === 0) {
      const head = resampled.length > 0 ? resampled[0] : { x: 0, y: 0 };
      base.push({ x: head.x, y: head.y });
    } else {
      for (const p of points) {
        base.push({ x: p.x, y: p.y });
      }
    }

    const smoothed = HistoryTrail.generateSmoothTrail(base);
    const segmentCount = Math.max(SNAKE_minSegments, Math.round(actualSegments));
    
    // Get tail direction from smoothed trail
    const tailDir = smoothed.length > 1
      ? {
          x: smoothed[smoothed.length - 1].x - smoothed[smoothed.length - 2].x,
          y: smoothed[smoothed.length - 1].y - smoothed[smoothed.length - 2].y
        }
      : { x: -Math.cos(angle), y: -Math.sin(angle) };
    
    HistoryTrail.ensureTrailCoverage(smoothed, tailDir, spacing, (segmentCount + 5) * spacing);
    const paddedHistory = HistoryTrail.padTrail(smoothed, segmentCount);
    const resampledSegments = HistoryTrail.sampleSegmentsFromHistory(paddedHistory, angle, spacing, segmentCount);
    
    return { history: paddedHistory, resampled: resampledSegments };
  }

  /**
   * Finalize reconciliation after replaying inputs
   * Rebuilds segments from the reconciled history and starts healing window
   */
  static finalizeReconciliation(
    history: Vec2[],
    angle: number,
    spacing: number,
    actualSegments: number,
    SNAKE_minSegments: number,
    HEALING_WINDOW: number
  ): { resampled: Vec2[]; postCorrectionFrames: number } {
    const segmentCount = Math.max(SNAKE_minSegments, Math.round(actualSegments));
    
    // Get tail direction from actual tail position, not head angle
    const tailDir = history.length > 1 
      ? { 
          x: history[history.length - 1].x - history[history.length - 2].x,
          y: history[history.length - 1].y - history[history.length - 2].y
        }
      : { x: -Math.cos(angle), y: -Math.sin(angle) };
    
    HistoryTrail.ensureTrailCoverage(history, tailDir, spacing, (segmentCount + 5) * spacing);
    const resampled = HistoryTrail.sampleSegmentsFromHistory(history, angle, spacing, segmentCount);
    
    return { resampled, postCorrectionFrames: HEALING_WINDOW };
  }

  /**
   * Apply micro-healing clamp to turn rate during healing window
   * Reduces turn rate aggressiveness right after reconciliation to prevent jerky corrections
   */
  static applyMicroHealingClamp(
    desiredAngle: number,
    currentAngle: number,
    effectiveTurnRate: number,
    dt: number
  ): number {
    const angleDiffRaw = desiredAngle - currentAngle;
    let normalized = angleDiffRaw % (2 * Math.PI);
    if (normalized > Math.PI) normalized -= 2 * Math.PI;
    if (normalized < -Math.PI) normalized += 2 * Math.PI;
    
    const maxAngleChangeDuringHeal = effectiveTurnRate * dt * 0.5;
    if (normalized > maxAngleChangeDuringHeal) normalized = maxAngleChangeDuringHeal;
    if (normalized < -maxAngleChangeDuringHeal) normalized = -maxAngleChangeDuringHeal;
    
    return currentAngle + normalized;
  }
}

