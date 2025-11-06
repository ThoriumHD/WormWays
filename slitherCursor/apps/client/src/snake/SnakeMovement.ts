// apps/client/src/snake/SnakeMovement.ts

/**
 * SnakeMovement handles movement physics and calculations including:
 * - Angle normalization and angular difference calculation
 * - Turn rate limiting based on snake length
 * - Speed transitions between normal and boost
 */
export class SnakeMovement {
  /**
   * Constants for movement constraints
   */
  static readonly MAX_TURN_ANGLE = Math.PI / 2; // 90 degrees - prevent backwards movement
  static readonly MIN_ANGLE_CHANGE = 0.001; // Minimum angle change to prevent jitter
  static readonly SPEED_TRANSITION_RATE = 12.0; // How fast speed transitions between normal and boost

  /**
   * Normalize an angle to [0, 2π) range
   */
  static normalizeAngle(a: number): number {
    let normalized = a % (2 * Math.PI);
    if (normalized < 0) normalized += 2 * Math.PI;
    return normalized;
  }

  /**
   * Calculate shortest angular difference between two angles
   * Handles angle wrapping correctly
   */
  static calculateAngularDifference(target: number, current: number): number {
    target = SnakeMovement.normalizeAngle(target);
    current = SnakeMovement.normalizeAngle(current);
    let diff = target - current;
    
    // Normalize to [-π, π] range (shortest path)
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    
    return diff;
  }

  /**
   * Calculate the turn amount for this frame
   * Applies turn rate limiting, prevents backwards movement, and dead zone filtering
   */
  static calculateTurnDelta(
    desiredAngle: number,
    currentAngle: number,
    effectiveTurnRate: number,
    dt: number
  ): number {
    let da = SnakeMovement.calculateAngularDifference(desiredAngle, currentAngle);
    const maxDa = effectiveTurnRate * dt;
    
    // Prevent backwards movement: limit angle change to ±90 degrees
    if (da > SnakeMovement.MAX_TURN_ANGLE) da = SnakeMovement.MAX_TURN_ANGLE;
    if (da < -SnakeMovement.MAX_TURN_ANGLE) da = -SnakeMovement.MAX_TURN_ANGLE;
    
    // Dead zone: ignore extremely small angle changes to prevent jitter
    if (Math.abs(da) < SnakeMovement.MIN_ANGLE_CHANGE) {
      da = 0;
    }
    
    // Clamp to max turn rate
    if (da > maxDa) da = maxDa;
    if (da < -maxDa) da = -maxDa;

    return da;
  }

  /**
   * Calculate effective turn rate based on snake length
   * Longer snakes turn slower
   */
  static calculateEffectiveTurnRate(
    baseTurnRate: number,
    segmentCount: number,
    turnRateReduction: number
  ): number {
    const maxSegments = 200; // Assume max reasonable snake length
    const lengthFactor = Math.min(1.0, segmentCount / maxSegments);
    const reduction = turnRateReduction * lengthFactor;
    return baseTurnRate * (1.0 - reduction);
  }

  /**
   * Update speed with smooth transition
   */
  static updateSpeed(
    currentSpeed: number,
    targetSpeed: number,
    dt: number,
    transitionRate: number = SnakeMovement.SPEED_TRANSITION_RATE
  ): number {
    return currentSpeed + (targetSpeed - currentSpeed) * transitionRate * dt;
  }

  /**
   * Calculate forward movement distance
   */
  static calculateMovementDistance(speed: number, dt: number): number {
    return speed * dt;
  }

  /**
   * Get direction vector from angle
   */
  static getDirectionFromAngle(angle: number): { x: number; y: number } {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  /**
   * Get reverse direction vector from angle (for tail extension)
   */
  static getReverseDirectionFromAngle(angle: number): { x: number; y: number } {
    return { x: -Math.cos(angle), y: -Math.sin(angle) };
  }
}

