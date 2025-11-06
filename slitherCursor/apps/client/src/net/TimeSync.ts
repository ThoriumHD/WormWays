/**
 * TimeSync: Synchronizes client and server clocks using ping/pong
 * 
 * Maintains an offset between server time and local time to enable
 * accurate snapshot interpolation at a specific render time.
 */
export class TimeSync {
  private serverTimeOffset = 0; // Offset to add to local time to get server time
  private lastSyncTime = 0;
  private isSynced = false;

  /**
   * Update the server time offset based on a pong response
   * @param clientSentTime Local time when ping was sent
   * @param serverReceivedTime Server time when ping was received (from pong)
   */
  updateOffset(clientSentTime: number, serverReceivedTime: number) {
    // Assume symmetric latency (RTT/2)
    // serverTime = serverReceivedTime - (RTT/2)
    // But we don't have RTT here, so just use the server timestamp
    // The actual offset will be refined with multiple pings
    this.serverTimeOffset = serverReceivedTime - clientSentTime;
    this.lastSyncTime = Date.now();
    this.isSynced = true;
  }

  /**
   * Update offset using RTT calculation
   * @param clientSentTime Local time when ping was sent
   * @param serverReceivedTime Server time when ping was received
   * @param clientReceivedTime Local time when pong was received
   */
  updateOffsetWithRTT(clientSentTime: number, serverReceivedTime: number, clientReceivedTime: number) {
    const rtt = clientReceivedTime - clientSentTime;
    // Server time when it received the ping (adjusted by half RTT)
    const estimatedServerTimeAtReceive = serverReceivedTime - (rtt / 2);
    this.serverTimeOffset = estimatedServerTimeAtReceive - clientSentTime;
    this.lastSyncTime = Date.now();
    this.isSynced = true;
  }

  /**
   * Get the current server time (estimated)
   */
  serverNow(): number {
    if (!this.isSynced) {
      return Date.now(); // Fallback if not synced yet
    }
    return Date.now() + this.serverTimeOffset;
  }

  /**
   * Check if time sync is established
   */
  isTimeSynced(): boolean {
    return this.isSynced;
  }

  /**
   * Get the server time offset
   */
  getOffset(): number {
    return this.serverTimeOffset;
  }

  /**
   * Reset sync state
   */
  reset() {
    this.serverTimeOffset = 0;
    this.lastSyncTime = 0;
    this.isSynced = false;
  }
}


