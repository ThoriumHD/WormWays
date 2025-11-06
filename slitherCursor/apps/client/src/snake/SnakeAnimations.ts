// apps/client/src/snake/SnakeAnimations.ts

export interface Pulse {
  position: number;
  fadeAlpha: number;
}

export class SnakeAnimations {
  // Pulse system constants (matching SnakeRenderer)
  static readonly PULSE_SPAWN_INTERVAL_S = 0.4;
  static readonly MAX_PULSES = 1000;
  static readonly DECAY_SECONDS = 0.12;
  static readonly PULSE_SPEED_PX_PER_S = 512;
  static readonly PULSE_SPEED_REFERENCE_LENGTH = 800;
  static readonly PULSE_SPEED_SCALE_POWER = 0.3;

  /**
   * Update boost pulse animations
   * Pulses spawn at the head and travel down the snake's body during boost
   */
  static updatePulses(
    pulses: Pulse[],
    dt: number,
    boosting: boolean,
    wasBoosting: boolean,
    spawnAcc: { value: number },
    totalArcLength: number
  ): void {
    // Detect when boosting stops - fade out existing pulses
    if (wasBoosting && !boosting) {
      // Mark all existing pulses to fade out
      for (let k = 0; k < pulses.length; k++) {
        pulses[k].fadeAlpha = 1.0; // Start fade from full alpha
      }
    }

    // Pulse spawn logic
    if (boosting) {
      spawnAcc.value += dt;
      const T = SnakeAnimations.PULSE_SPAWN_INTERVAL_S;
      while (spawnAcc.value >= T && pulses.length < SnakeAnimations.MAX_PULSES) {
        pulses.push({ position: 0, fadeAlpha: 1.0 }); // new pulse at head
        spawnAcc.value -= T;
      }
    } else {
      spawnAcc.value = 0;
    }

    // Scale pulse speed with snake length to prevent piling up
    const referenceLength = SnakeAnimations.PULSE_SPEED_REFERENCE_LENGTH;
    const scalePower = SnakeAnimations.PULSE_SPEED_SCALE_POWER;
    let lengthScale = 1.0;
    if (totalArcLength > 0 && totalArcLength > referenceLength) {
      const ratio = totalArcLength / referenceLength;
      lengthScale = Math.pow(ratio, scalePower);
    }
    const baseSpeed = SnakeAnimations.PULSE_SPEED_PX_PER_S;
    const v = baseSpeed * lengthScale;

    const fadeOutRate = dt / SnakeAnimations.DECAY_SECONDS; // How fast pulses fade per second

    // Advance pulses and handle fade-out
    for (let k = pulses.length - 1; k >= 0; k--) {
      const pulse = pulses[k];
      
      // Advance position
      pulse.position += v * dt;
      
      // If not boosting, fade out this pulse
      if (!boosting && pulse.fadeAlpha > 0) {
        pulse.fadeAlpha -= fadeOutRate;
        if (pulse.fadeAlpha <= 0) {
          // Remove faded-out pulse
          pulses.splice(k, 1);
          continue;
        }
      }
      
      // Remove pulses that have traveled past the snake (cleanup)
      if (pulse.position > totalArcLength + 100) {
        pulses.splice(k, 1);
      }
    }
  }

  /**
   * Update death animation state
   * Progresses through fade-out and completion phases
   */
  static updateDeathAnimation(
    dt: number,
    deathAnimationProgress: number,
    snakeFadeProgress: number,
    isDead: boolean
  ): { deathAnimationProgress: number; snakeFadeProgress: number } {
    if (!isDead) {
      return { deathAnimationProgress, snakeFadeProgress };
    }
    
    // Phase 1: Snake fade-out (0.3 seconds)
    if (snakeFadeProgress < 1.0) {
      snakeFadeProgress += dt * 3.33; // Fade out over 0.3 seconds (dt is in seconds)
      snakeFadeProgress = Math.min(1.0, snakeFadeProgress);
    }
    
    // Phase 2: Death animation progress (death dots are now server-side food)
    if (snakeFadeProgress >= 1.0) {
      deathAnimationProgress += dt / 1.5; // Animation completes over 0.7 seconds
      deathAnimationProgress = Math.min(1.0, deathAnimationProgress);
    }
    
    return { deathAnimationProgress, snakeFadeProgress };
  }
}

