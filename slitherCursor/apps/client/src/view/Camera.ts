import type { Vec2 } from '@packages/proto';

export class Camera {
  public position: Vec2 = { x: 0, y: 0 };
  public zoom = 1.0;
  public targetZoom = 1.0;
  
  private smoothPosition: Vec2 = { x: 0, y: 0 };
  private smoothingFactor = 10.0; // faster easing to reduce perceived latency
  
  constructor() {
    this.smoothPosition = { ...this.position };
  }
  
  update(dt: number, target: Vec2, speed: number = 0) {
    // Update target position
    this.position = { ...target };
    
    // Smooth camera following with exponential easing
    const factor = 1 - Math.exp(-dt * this.smoothingFactor / 1000);
    this.smoothPosition.x += (this.position.x - this.smoothPosition.x) * factor;
    this.smoothPosition.y += (this.position.y - this.smoothPosition.y) * factor;
    
    // Adjust zoom based on speed (zoom out when boosting)
    this.targetZoom = 1.0 + Math.min(0.2, speed / 1000); // max 20% zoom out
    this.zoom += (this.targetZoom - this.zoom) * (factor * 0.8);
  }
  
  worldToScreen(worldPos: Vec2): Vec2 {
    const screenX = (worldPos.x - this.smoothPosition.x) * this.zoom + window.innerWidth / 2;
    const screenY = (worldPos.y - this.smoothPosition.y) * this.zoom + window.innerHeight / 2;
    return { x: screenX, y: screenY };
  }
  
  screenToWorld(screenPos: Vec2): Vec2 {
    const worldX = (screenPos.x - window.innerWidth / 2) / this.zoom + this.smoothPosition.x;
    const worldY = (screenPos.y - window.innerHeight / 2) / this.zoom + this.smoothPosition.y;
    return { x: worldX, y: worldY };
  }
  
  getTransform() {
    return {
      x: this.smoothPosition.x,
      y: this.smoothPosition.y,
      zoom: this.zoom
    };
  }
}
