import type { Vec2 } from '@packages/proto';
import { Physics } from '../state/Physics';

export type Input = {
  timestamp: number;
  angle: number;
  boost: boolean;
  seq: number;
};

export type SnakeState = {
  position: Vec2;
  angle: number;
  score: number;
  body: Vec2[];
};

export class ClientSim {
  private lastServerTick = 0;
  private pendingInputs: Input[] = [];
  private localState: SnakeState = {
    position: { x: 0, y: 0 },
    angle: 0,
    score: 20,
    body: []
  };
  
  private speed = 140;
  private turnRate = 4;
  private maxInputs = 100; // circular buffer size
  private segmentSpacing = 9; // ~0.9 * visual radius (10)
  private lastPlaced: Vec2 = { x: 0, y: 0 };
  
  constructor() {
    // Initialize evenly spaced trail behind origin
    this.lastPlaced = { ...this.localState.position };
    const n = Math.max(10, this.localState.score);
    for (let i = 0; i < n; i++) {
      this.localState.body.push({ x: this.localState.position.x - i * this.segmentSpacing, y: this.localState.position.y });
    }
  }
  
  addInput(input: Input) {
    this.pendingInputs.push(input);
    
    // Keep only recent inputs
    if (this.pendingInputs.length > this.maxInputs) {
      this.pendingInputs = this.pendingInputs.slice(-this.maxInputs);
    }
  }
  
  applyInput(input: Input, dt: number) {
    const result = Physics.stepHead(
      this.localState.position,
      this.localState.angle,
      dt,
      input.angle,
      this.speed,
      input.boost,
      this.turnRate
    );
    
    this.localState.position = result.position;
    this.localState.angle = result.angle;
    
    // Maintain evenly spaced body points (head-first)
    let from = this.lastPlaced;
    let to = this.localState.position;
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    let dist = Math.hypot(dx, dy);
    while (dist >= this.segmentSpacing) {
      const ratio = this.segmentSpacing / dist;
      const nx = from.x + dx * ratio;
      const ny = from.y + dy * ratio;
      this.localState.body.unshift({ x: nx, y: ny });
      this.lastPlaced = { x: nx, y: ny };
      from = this.lastPlaced;
      dx = to.x - from.x; dy = to.y - from.y; dist = Math.hypot(dx, dy);
    }
    // trim to score segments
    const maxPoints = Math.max(10, this.localState.score);
    if (this.localState.body.length > maxPoints) this.localState.body.length = maxPoints;
  }
  
  reconcile(serverState: { tick: number; players: any[] }, myId: number) {
    const serverMe = serverState.players.find(p => p.id === myId);
    if (!serverMe) return;
    
    this.lastServerTick = serverState.tick;
    
    // Find inputs that happened after the server tick
    const serverTime = serverState.tick;
    const inputsToReplay = this.pendingInputs.filter(input => input.timestamp > serverTime);
    
    // Reset to server position
    this.localState.position = { x: serverMe.headX, y: serverMe.headY };
    this.localState.score = serverMe.len;
    // Snap lastPlaced to server head to avoid drag
    this.lastPlaced = { ...this.localState.position };
    
    // Replay inputs from server state forward
    for (let i = 0; i < inputsToReplay.length - 1; i++) {
      const input = inputsToReplay[i];
      const nextInput = inputsToReplay[i + 1];
      const dt = nextInput.timestamp - input.timestamp;
      this.applyInput(input, dt);
    }
    
    // Apply the last input with remaining time
    if (inputsToReplay.length > 0) {
      const lastInput = inputsToReplay[inputsToReplay.length - 1];
      const remainingTime = performance.now() - lastInput.timestamp;
      this.applyInput(lastInput, remainingTime);
    }
    
    // Clean up old inputs
    this.pendingInputs = this.pendingInputs.filter(input => input.timestamp > serverTime - 1000);
  }
  
  update(dt: number, currentAngle: number, currentBoost: boolean) {
    // Apply current input
    const input: Input = {
      timestamp: performance.now(),
      angle: currentAngle,
      boost: currentBoost,
      seq: 0 // will be set by net layer
    };
    
    this.addInput(input);
    this.applyInput(input, dt);
  }
  
  getState(): SnakeState {
    return { ...this.localState };
  }
  
  getPosition(): Vec2 {
    return { ...this.localState.position };
  }
  
  getAngle(): number {
    return this.localState.angle;
  }
  
  getBody(): Vec2[] {
    return [...this.localState.body];
  }

  getHeadCarry(): number {
    const dx = this.localState.position.x - this.lastPlaced.x;
    const dy = this.localState.position.y - this.lastPlaced.y;
    return Math.hypot(dx, dy);
  }
}
