// Multiplayer networking with WebSocket
import { ClientInput, ServerStateMsg, Snapshot, NET_CONSTANTS } from '@slither/common';
import { TimeSync } from './net/TimeSync';
import { SnapshotBuffer } from './net/SnapshotBuffer';
import { Reconciler } from './net/Reconciler';

export interface WelcomeData {
  playerId: string;
  worldSize: number;
  tickRate: number;
}

export interface ErrorData {
  message: string;
  code?: string;
}

export class Net {
  private ws: WebSocket | null = null;
  private connected = false;
  private playerId: string | null = null;
  private lobbyId: string;
  private sessionId: string;
  private pingInterval: number | null = null;
  private lastPingSentTime = 0;
  private rtt = 0;
  
  // New networking infrastructure
  public timeSync = new TimeSync();
  public snapshotBuffer = new SnapshotBuffer(NET_CONSTANTS.SNAPSHOT_BUFFER_SIZE);
  public reconciler = new Reconciler();
  
  public lastState: any = null;
  
  public onWelcome: ((data: WelcomeData) => void) | null = null;
  public onState: ((snapshot: Snapshot) => void) | null = null;
  public onPong: ((rtt: number) => void) | null = null;
  public onError: ((error: ErrorData) => void) | null = null;
  public onDisconnect: (() => void) | null = null;
  
  constructor() {
    // Extract lobby ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.lobbyId = urlParams.get('lobby') || 'default';
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[net] Initialized for lobby: ${this.lobbyId}`);
  }
  
  connect(name: string) {
    if (this.connected) {
      console.warn('[net] Already connected');
      return;
    }
    
    // Determine server URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    
    // Build WebSocket URL with /ws path
    let serverUrl: string;
    if (window.location.hostname === 'localhost') {
      // Local development
      serverUrl = `${protocol}//${host}:8081/ws`;
    } else {
      // Production (no port, Nginx handles it)
      serverUrl = `${protocol}//${host}/ws`;
    }
    
    console.log(`[net] Connecting to ${serverUrl}...`);
    
    try {
      this.ws = new WebSocket(serverUrl);
      
      this.ws.onopen = () => {
        console.log('[net] WebSocket connected');
        this.connected = true;
        
        // Send join message
        this.sendMessage({
          type: 'join',
          data: { name: name.trim() }
        });
        
        // Start ping interval
        this.startPing();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[net] Failed to parse message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log(`[net] WebSocket closed: ${event.code} ${event.reason}`);
        this.connected = false;
        this.stopPing();
        this.timeSync.reset();
        this.snapshotBuffer.clear();
        this.reconciler.reset();
        this.onDisconnect?.();
      };
      
      this.ws.onerror = (error) => {
        console.error('[net] WebSocket error:', error);
        this.onError?.({ message: 'Connection error' });
      };
      
    } catch (error) {
      console.error('[net] Failed to create WebSocket:', error);
      this.onError?.({ message: 'Failed to connect to server' });
    }
  }
  
  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[net] Cannot send message - not connected');
    }
  }
  
  private handleMessage(message: any) {
    switch (message.type) {
      case 'welcome':
        this.handleWelcome(message.data as WelcomeData);
        break;
      case 'state':
        this.handleState(message.data as ServerStateMsg['data']);
        break;
      case 'pong':
        this.handlePong(message.data);
        break;
      case 'error':
        this.handleError(message.data as ErrorData);
        break;
      default:
        console.warn('[net] Unknown message type:', message.type);
    }
  }
  
  private handleWelcome(data: WelcomeData) {
    console.log('[net] Welcome received:', data);
    this.playerId = data.playerId;
    this.onWelcome?.(data);
  }
  
  private handleState(data: ServerStateMsg['data']) {
    // Store as snapshot in buffer
    const snapshot: Snapshot = {
      serverTimeMs: data.serverTimeMs,
      tick: data.tick,
      players: data.players,
      food: data.food,
      acks: data.acks
    };
    
    this.snapshotBuffer.push(snapshot);
    this.lastState = snapshot;
    
    // Notify callback with snapshot
    this.onState?.(snapshot);
  }
  
  private handlePong(data: any) {
    const clientReceivedTime = Date.now();
    const serverTime = data.timestamp || clientReceivedTime; // Server timestamp if provided
    const rtt = clientReceivedTime - this.lastPingSentTime;
    this.rtt = rtt;
    
    // Update time sync with RTT calculation
    if (this.lastPingSentTime > 0) {
      this.timeSync.updateOffsetWithRTT(this.lastPingSentTime, serverTime, clientReceivedTime);
    }
    
    this.onPong?.(this.rtt);
  }
  
  private handleError(data: ErrorData) {
    console.error('[net] Server error:', data.message);
    this.onError?.(data);
  }
  
  /**
   * Send input with client tick number
   */
  sendInput(input: ClientInput): void {
    if (!this.connected) return;
    
    // Record input in reconciler and get tick number
    const tick = this.reconciler.recordInput(input);
    
    this.sendMessage({
      type: 'input',
      data: {
        t: tick,
        ax: input.ax,
        ay: input.ay,
        b: input.b,
        angle: input.angle,
      }
    });
  }
  
  /**
   * Send input using old format (backward compatibility)
   */
  setControls(mouseX: number, mouseY: number, boost: boolean) {
    if (!this.connected) return;
    
    // Use old format for backward compatibility
    this.sendMessage({
      type: 'input',
      data: { mouseX, mouseY, boost }
    });
  }
  
  sendBoostTrailPellet(x: number, y: number, radius: number, color: string) {
    if (!this.connected) return;
    
    this.sendMessage({
      type: 'boostTrail',
      data: { x, y, radius, color }
    });
  }
  
  private startPing() {
    this.pingInterval = window.setInterval(() => {
      this.lastPingSentTime = Date.now();
      this.sendMessage({ 
        type: 'ping',
        data: { timestamp: this.lastPingSentTime }
      });
    }, NET_CONSTANTS.PING_INTERVAL_MS);
  }
  
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  pingServer() {
    if (this.connected) {
      this.lastPingSentTime = Date.now();
      this.sendMessage({ 
        type: 'ping',
        data: { timestamp: this.lastPingSentTime }
      });
    }
  }
  
  getLobbyId(): string {
    return this.lobbyId;
  }
  
  getSessionId(): string {
    return this.sessionId;
  }
  
  getPlayerId(): string | null {
    return this.playerId;
  }
  
  getRTT(): number {
    return this.rtt;
  }
  
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.stopPing();
    this.timeSync.reset();
    this.snapshotBuffer.clear();
    this.reconciler.reset();
  }
}
