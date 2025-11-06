import { ClientInput } from '@slither/common';

/**
 * Reconciler: Manages client-side input history and reconciliation
 * 
 * When server corrections arrive, we replay unacknowledged inputs
 * to maintain smooth client prediction while respecting server authority.
 */
export class Reconciler {
  private inputHistory: Array<{ tick: number; input: ClientInput }> = [];
  private clientTick = 0;
  private readonly maxHistorySize = 256;

  /**
   * Record a new input and return the tick number
   */
  recordInput(input: ClientInput): number {
    this.clientTick++;
    const tick = this.clientTick;
    
    input.t = tick;
    this.inputHistory.push({ tick, input: { ...input } });
    
    // Trim old inputs if buffer is too large
    if (this.inputHistory.length > this.maxHistorySize) {
      this.inputHistory.shift();
    }
    
    return tick;
  }

  /**
   * Get the current client tick number
   */
  getCurrentTick(): number {
    return this.clientTick;
  }

  /**
   * Drop all inputs up to and including the acknowledged tick
   * @param ackedTick The last tick number the server has processed
   */
  dropAcknowledged(ackedTick: number): void {
    // Remove all inputs with tick <= ackedTick
    this.inputHistory = this.inputHistory.filter(item => item.tick > ackedTick);
  }

  /**
   * Get all unacknowledged inputs (inputs with tick > ackedTick)
   * These need to be replayed after applying server correction
   */
  getUnacknowledgedInputs(ackedTick: number): ClientInput[] {
    return this.inputHistory
      .filter(item => item.tick > ackedTick)
      .map(item => item.input);
  }

  /**
   * Reset the reconciler (e.g., on disconnect or respawn)
   */
  reset(): void {
    this.inputHistory = [];
    this.clientTick = 0;
  }

  /**
   * Get input history size
   */
  getHistorySize(): number {
    return this.inputHistory.length;
  }
}

