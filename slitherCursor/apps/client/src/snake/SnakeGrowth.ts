// apps/client/src/snake/SnakeGrowth.ts
export type Vec2 = { x: number; y: number };

/**
 * SnakeGrowth manages the growth system including:
 * - Food point accumulation
 * - Fractional growth handling
 * - Segment addition/removal
 */
export class SnakeGrowth {
  /**
   * Add food points and convert to segments
   * Handles fractional growth accumulation
   */
  static addFoodPoints(
    fractionalFoodPoints: number,
    actualSegments: number,
    pointsPerSegment: number,
    points: number
  ): {
    fractionalFoodPoints: number;
    actualSegments: number;
    segmentsAdded: number;
  } {
    fractionalFoodPoints += points;
    
    // Calculate how many segments we can add
    const segmentsToAdd = Math.floor(fractionalFoodPoints / pointsPerSegment);
    
    if (segmentsToAdd > 0) {
      actualSegments += segmentsToAdd;
      fractionalFoodPoints -= segmentsToAdd * pointsPerSegment; // Keep remainder
      return { fractionalFoodPoints, actualSegments, segmentsAdded: segmentsToAdd };
    }
    
    return { fractionalFoodPoints, actualSegments, segmentsAdded: 0 };
  }

  /**
   * Ensure correct number of segments by adding or removing them
   * Adds segments gradually to prevent jarring growth
   */
  static ensureCorrectSegmentCount(
    resampled: Vec2[],
    history: Vec2[],
    actualSegments: number,
    spacing: number,
    angle: number,
    minSegments: number
  ): { resampled: Vec2[]; history: Vec2[]; adjustmentsMade: number } {
    let adjustmentsMade = 0;
    const needCount = Math.floor(actualSegments);
    
    if (needCount < 1) {
      console.warn('[SnakeGrowth] Invalid segment count, resetting to minimum');
      resampled.length = minSegments;
      return { resampled, history, adjustmentsMade: resampled.length };
    }
    
    if (resampled.length < needCount) {
      // Add segments - extend from tail using tail's actual direction
      const isWholeNumber = Math.abs(actualSegments - Math.round(actualSegments)) < 0.01;
      const threshold = (isWholeNumber || actualSegments >= needCount + 0.5) ? 0.0 : 0.2;
      
      if (actualSegments >= needCount + threshold) {
        const deficit = needCount - resampled.length;
        const maxSegmentsToAdd = deficit > 5 ? Math.min(deficit, 5) : 1;
        let segmentsAdded = 0;
        
        while (resampled.length < needCount && segmentsAdded < maxSegmentsToAdd) {
          const lastSegment = resampled[resampled.length - 1];
          let newSegmentPos: Vec2;
          
          if (resampled.length > 1) {
            // Use tail's actual direction (from second-to-last to last)
            const secondLast = resampled[resampled.length - 2];
            const tailDirX = lastSegment.x - secondLast.x;
            const tailDirY = lastSegment.y - secondLast.y;
            const tailDirLen = Math.sqrt(tailDirX * tailDirX + tailDirY * tailDirY);
            
            if (tailDirLen > 0.01) {
              // Continue extending in tail's current direction
              newSegmentPos = {
                x: lastSegment.x + (tailDirX / tailDirLen) * spacing,
                y: lastSegment.y + (tailDirY / tailDirLen) * spacing
              };
            } else {
              // Segments overlapping - use angle fallback
              const dirVec = { x: Math.cos(angle), y: Math.sin(angle) };
              newSegmentPos = {
                x: lastSegment.x - dirVec.x * spacing,
                y: lastSegment.y - dirVec.y * spacing
              };
            }
          } else {
            // Only head exists - extend opposite to snake's direction
            const dirVec = { x: Math.cos(angle), y: Math.sin(angle) };
            newSegmentPos = {
              x: lastSegment.x - dirVec.x * spacing,
              y: lastSegment.y - dirVec.y * spacing
            };
          }
          
          resampled.push(newSegmentPos);
          
          // CRITICAL: Add new segment to history trail immediately
          // This ensures it's part of the path and won't jump on next frame
          // New segments are added to the END of history (tail position)
          history.push({ x: newSegmentPos.x, y: newSegmentPos.y });
          
          segmentsAdded++;
          adjustmentsMade++;
        }
      }
    } else if (resampled.length > needCount) {
      // Remove excess segments gradually
      const excess = resampled.length - needCount;
      if (excess > 1 || (excess === 1 && actualSegments < needCount + 0.1)) {
        const oldLength = resampled.length;
        resampled.length = Math.max(needCount, resampled.length - 1);
        adjustmentsMade = oldLength - resampled.length;
      }
    }
    
    return { resampled, history, adjustmentsMade };
  }

  /**
   * Get the target segment count (rounded)
   */
  static getTargetSegmentCount(actualSegments: number, minSegments: number): number {
    return Math.max(minSegments, Math.round(actualSegments));
  }
}

