import { Graphics } from 'pixi.js';
import { Camera } from './Camera';

export class Grid {
  private graphics = new Graphics();
  private spacing = 64;
  private lineColor = 0x1a1a1a;
  private lineAlpha = 0.4;
  private lineWidth = 1;
  
  constructor() {
    this.graphics.zIndex = -1; // behind everything
  }
  
  getGraphics() {
    return this.graphics;
  }
  
  update(camera: Camera) {
    this.draw(camera);
  }
  
  private draw(camera: Camera) {
    const g = this.graphics;
    g.clear();
    
    const transform = camera.getTransform();
    const zoom = transform.zoom;
    const camX = transform.x;
    const camY = transform.y;
    
    // Calculate visible grid bounds with some padding
    const padding = 200;
    const left = (camX - window.innerWidth / 2 / zoom) - padding;
    const right = (camX + window.innerWidth / 2 / zoom) + padding;
    const top = (camY - window.innerHeight / 2 / zoom) - padding;
    const bottom = (camY + window.innerHeight / 2 / zoom) + padding;
    
    // Draw vertical lines
    g.stroke({ color: this.lineColor, width: this.lineWidth, alpha: this.lineAlpha });
    
    const startX = Math.floor(left / this.spacing) * this.spacing;
    const endX = Math.ceil(right / this.spacing) * this.spacing;
    
    for (let x = startX; x <= endX; x += this.spacing) {
      const screenPos = camera.worldToScreen({ x, y: top });
      const screenPos2 = camera.worldToScreen({ x, y: bottom });
      
      g.moveTo(screenPos.x, screenPos.y);
      g.lineTo(screenPos2.x, screenPos2.y);
    }
    
    // Draw horizontal lines
    const startY = Math.floor(top / this.spacing) * this.spacing;
    const endY = Math.ceil(bottom / this.spacing) * this.spacing;
    
    for (let y = startY; y <= endY; y += this.spacing) {
      const screenPos = camera.worldToScreen({ x: left, y });
      const screenPos2 = camera.worldToScreen({ x: right, y });
      
      g.moveTo(screenPos.x, screenPos.y);
      g.lineTo(screenPos2.x, screenPos2.y);
    }
    
    g.stroke();
  }
}
