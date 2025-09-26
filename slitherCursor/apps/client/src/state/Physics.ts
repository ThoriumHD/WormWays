import type { Vec2 } from '@packages/proto';

export class Physics {
  static stepHead(
    position: Vec2,
    angle: number,
    dt: number,
    targetAngle: number,
    speed: number,
    boost: boolean,
    turnRate: number = 4
  ): { position: Vec2; angle: number } {
    // Apply turn rate limiting
    const angleDiff = this.normalizeAngle(targetAngle - angle);
    const maxTurn = turnRate * dt / 1000;
    const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
    const newAngle = angle + turnAmount;
    
    // Calculate speed with boost
    const currentSpeed = boost ? speed * 1.3 : speed;
    
    // Apply slight drag when not boosting
    const drag = boost ? 1.0 : 0.998; // extremely subtle to avoid sawtooth
    const effectiveSpeed = currentSpeed * drag;
    
    // Update position
    const newPosition = {
      x: position.x + Math.cos(newAngle) * effectiveSpeed * dt / 1000,
      y: position.y + Math.sin(newAngle) * effectiveSpeed * dt / 1000
    };
    
    return { position: newPosition, angle: newAngle };
  }
  
  private static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
}
