// apps/client/src/snake/SnakeBoostSystem.ts
export type Vec2 = { x: number; y: number };

/**
 * SnakeBoostSystem manages boost mechanics including:
 * - Mass loss (segment reduction) while boosting
 * - Pellet trail drops
 * - Anti-cheat boost point accumulation
 */
export class SnakeBoostSystem {
  /**
   * Update boost state and create trail pellets
   * Handles segment loss, pellet drops, and boost points
   */
  static updateBoostTrail(
    dt: number,
    boosting: boolean,
    canBoost: boolean,
    lastPelletTime: number,
    actualSegments: number,
    boostPoints: number,
    tailPosition: Vec2 | undefined,
    boostConstants: {
      boostPointsPerSecond: number;
      boostMassLossRate: number;
      boostPelletDropRate: number;
      boostTrailRadius: number;
      minSegments: number;
    },
    net: any,
    snakeColor: string
  ): {
    lastPelletTime: number;
    actualSegments: number;
    boostPoints: number;
    pelletsSent: Array<{ x: number; y: number; radius: number; color: string }>;
  } {
    const pelletsSent: Array<{ x: number; y: number; radius: number; color: string }> = [];

    // Create new trail dots while boosting
    if (boosting && canBoost) {
      // Accumulate boost points (anti-cheat system)
      boostPoints += boostConstants.boostPointsPerSecond * dt;
      
      // Lose mass (reduce segments) - 1 segment per second
      const segmentsLost = boostConstants.boostMassLossRate * dt;
      actualSegments -= segmentsLost;
      
      // Drop pellets at configured rate
      lastPelletTime += dt;
      const pelletInterval = 1.0 / boostConstants.boostPelletDropRate;
      
      while (lastPelletTime >= pelletInterval) {
        // Send boost trail pellet to server (server handles both creation and rendering)
        if (tailPosition && net) {
          const pellet = {
            x: tailPosition.x,
            y: tailPosition.y,
            radius: boostConstants.boostTrailRadius,
            color: snakeColor
          };
          net.sendBoostTrailPellet(pellet.x, pellet.y, pellet.radius, pellet.color);
          pelletsSent.push(pellet);
        }
        
        lastPelletTime -= pelletInterval;
      }
      
      // Ensure we don't go below minimum
      actualSegments = Math.max(boostConstants.minSegments, actualSegments);
    }

    return {
      lastPelletTime,
      actualSegments,
      boostPoints,
      pelletsSent
    };
  }

  /**
   * Check if snake is currently able to boost
   * Requires having more than minimum segments
   */
  static canBoostCheck(actualSegments: number, minSegments: number, resampledLength: number): boolean {
    return actualSegments > minSegments && resampledLength > minSegments;
  }

  /**
   * Get the effective speed based on boost state
   */
  static getEffectiveSpeed(boosting: boolean, normalSpeed: number, boostSpeed: number): number {
    return boosting ? boostSpeed : normalSpeed;
  }
}

