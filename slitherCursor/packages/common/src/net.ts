/**
 * Shared networking types and constants for client and server
 * Ensures type safety and prevents drift between implementations
 */

// ============================================================================
// Constants
// ============================================================================

export const NET_CONSTANTS = {
  /** Server tick rate in Hz */
  TICK_RATE: 30,
  
  /** Tick delta in milliseconds */
  TICK_DELTA_MS: 1000 / 30, // ~33.33ms
  
  /** Interpolation delay in milliseconds (render 120ms behind server time) */
  INTERPOLATION_DELAY_MS: 120,
  
  /** Snapshot ring buffer size */
  SNAPSHOT_BUFFER_SIZE: 64,
  
  /** Ping interval in milliseconds */
  PING_INTERVAL_MS: 1000,
} as const;

// ============================================================================
// Message Types
// ============================================================================

export type ClientMessageType = 'join' | 'input' | 'ping' | 'boostTrail';
export type ServerMessageType = 'welcome' | 'state' | 'pong' | 'error';

// ============================================================================
// Client Messages
// ============================================================================

export interface ClientInput {
  /** Client's tick number (set by reconciler, optional when creating) */
  t?: number;
  /** Aim X position (world coordinates) */
  ax: number;
  /** Aim Y position (world coordinates) */
  ay: number;
  /** Boosting flag */
  b: boolean;
  /** Client-frame delta time in seconds (used for deterministic replay) */
  dt?: number;
  /** Heading angle (radians) captured when the input was generated */
  angle?: number;
}

export interface InputMsg {
  type: 'input';
  data: ClientInput;
}

export interface JoinMsg {
  type: 'join';
  data: { name: string };
}

export interface PingMsg {
  type: 'ping';
  data: { timestamp: number };
}

export interface BoostTrailMsg {
  type: 'boostTrail';
  data: { x: number; y: number; radius: number; color: string };
}

export type ClientMessage = JoinMsg | InputMsg | PingMsg | BoostTrailMsg;

// ============================================================================
// Server Messages
// ============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface ServerPlayerState {
  playerId: string;
  name: string;
  angle: number;
  boosting: boolean;
  score: number;
  isDead: boolean;
  deathAnimationProgress: number;
  snakeFadeProgress: number;
  head: Vec2;
  points: Vec2[];
  boostTrailDots: Array<{
    x: number;
    y: number;
    radius: number;
    age: number;
    maxAge: number;
    processed: boolean;
  }>;
  deathDots: Array<{
    x: number;
    y: number;
    radius: number;
    progress: number;
    color: string;
  }>;
  actualSegments: number;
  boostPoints: number;
  color: string;
}

export interface ServerFood {
  x: number;
  y: number;
  radius: number;
  color: string;
  id: string;
  vx: number;
  vy: number;
}

export interface ServerStateMsg {
  type: 'state';
  data: {
    tick: number;
    serverTimeMs: number;
    players: ServerPlayerState[];
    food: ServerFood[];
    /** Map of playerId -> last processed client tick number */
    acks: Record<string, number>;
  };
}

export interface WelcomeMsg {
  type: 'welcome';
  data: {
    playerId: string;
    worldSize: number;
    tickRate: number;
  };
}

export interface PongMsg {
  type: 'pong';
  data: {
    timestamp: number;
    rtt?: number;
  };
}

export interface ErrorMsg {
  type: 'error';
  data: {
    message: string;
    code?: string;
  };
}

export type ServerMessage = WelcomeMsg | ServerStateMsg | PongMsg | ErrorMsg;

// ============================================================================
// Snapshot Types (for client interpolation)
// ============================================================================

export interface Snapshot {
  serverTimeMs: number;
  tick: number;
  players: ServerPlayerState[];
  food: ServerFood[];
  acks: Record<string, number>;
}

