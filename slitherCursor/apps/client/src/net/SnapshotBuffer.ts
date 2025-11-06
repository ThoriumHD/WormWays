import { Snapshot } from '@slither/common';

/**
 * Ring buffer for storing server snapshots
 * Used for temporal interpolation between server updates
 */
export class SnapshotBuffer {
  private buffer: (Snapshot | null)[];
  private head = 0;
  private size = 0;
  private readonly capacity: number;

  constructor(capacity: number = 64) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  /**
   * Add a new snapshot to the buffer
   */
  push(snapshot: Snapshot): void {
    this.buffer[this.head] = snapshot;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  /**
   * Get snapshot at or before the given server time
   * Returns null if no valid snapshot found
   */
  getSnapshotAt(time: number): Snapshot | null {
    if (this.size === 0) return null;

    let best: Snapshot | null = null;
    let bestTime = -Infinity;

    for (let i = 0; i < this.size; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const snap = this.buffer[idx];
      if (!snap) continue;

      if (snap.serverTimeMs <= time && snap.serverTimeMs > bestTime) {
        best = snap;
        bestTime = snap.serverTimeMs;
      }
    }

    return best;
  }

  /**
   * Get two snapshots that bracket the given time
   * Returns [before, after] or [null, null] if not available
   */
  getSnapshotsBracketing(time: number): [Snapshot | null, Snapshot | null] {
    if (this.size === 0) return [null, null];

    let before: Snapshot | null = null;
    let after: Snapshot | null = null;
    let beforeTime = -Infinity;
    let afterTime = Infinity;

    for (let i = 0; i < this.size; i++) {
      const idx = (this.head - 1 - i + this.capacity) % this.capacity;
      const snap = this.buffer[idx];
      if (!snap) continue;

      if (snap.serverTimeMs <= time && snap.serverTimeMs > beforeTime) {
        before = snap;
        beforeTime = snap.serverTimeMs;
      }
      if (snap.serverTimeMs > time && snap.serverTimeMs < afterTime) {
        after = snap;
        afterTime = snap.serverTimeMs;
      }
    }

    return [before, after];
  }

  /**
   * Get the most recent snapshot
   */
  getLatest(): Snapshot | null {
    if (this.size === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.buffer.fill(null);
    this.head = 0;
    this.size = 0;
  }

  /**
   * Get current buffer size
   */
  getSize(): number {
    return this.size;
  }
}


