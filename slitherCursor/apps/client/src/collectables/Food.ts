import * as PIXI from 'pixi.js';

export interface FoodData {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  spawnTime: number;
}

export class Food {
  public id: string;
  public x: number;
  public y: number;
  public collected: boolean;
  public spawnTime: number;
  public sprite!: PIXI.Sprite;
  public glowSprite!: PIXI.Sprite;
  public container: PIXI.Container;
  
  // Animation properties
  private animationTime: number = 0;
  private rotationSpeed: number = 1; // radians per second (slower than coins)
  private bobSpeed: number = 2; // bobs per second
  private bobHeight: number = 6; // pixels (smaller than coins)
  private glowPulseSpeed: number = 3; // pulses per second
  
  // Magnetization properties (stronger than coins)
  private readonly MAGNET_RANGE = 150; // pixels - range at which magnetization starts (larger than coins)
  private readonly MAGNET_STRENGTH = 0.95; // strength of magnetic pull (stronger than coins) - almost instant
  private readonly MAGNET_SPEED = 500; // pixels per second when magnetized (faster than coins) - very fast
  
  constructor(x: number, y: number) {
    this.id = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.x = x;
    this.y = y;
    this.collected = false;
    this.spawnTime = Date.now();
    
    this.container = new PIXI.Container();
    this.createSprites();
  }
  
  private createSprites() {
    // Create glow effect (behind food)
    this.glowSprite = new PIXI.Sprite();
    this.createGlowTexture();
    this.glowSprite.anchor.set(0.5);
    this.glowSprite.blendMode = 'add';
    this.container.addChild(this.glowSprite);
    
    // Create food sprite
    this.sprite = new PIXI.Sprite();
    this.createFoodTexture();
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);
    
    // Set initial position
    this.container.position.set(this.x, this.y);
  }
  
  private createGlowTexture() {
    const size = 20;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Create radial gradient for glow (greenish)
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.6)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    this.glowSprite.texture = PIXI.Texture.from(canvas);
  }
  
  private createFoodTexture() {
    const size = 12;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Draw food body (apple-like)
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw food border
    ctx.strokeStyle = '#CC0000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw a small highlight
    ctx.fillStyle = '#FF6666';
    ctx.beginPath();
    ctx.arc(size/2 - 2, size/2 - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    
    this.sprite.texture = PIXI.Texture.from(canvas);
  }
  
  update(dt: number, snakeHead?: { x: number; y: number }) {
    if (this.collected) return;
    
    this.animationTime += dt;
    
    // Apply magnetization if snake head is within range
    if (snakeHead) {
      this.applyMagnetization(dt, snakeHead);
    }
    
    // Rotate food
    this.sprite.rotation = this.animationTime * this.rotationSpeed;
    
    // Bob up and down
    const bobOffset = Math.sin(this.animationTime * this.bobSpeed) * this.bobHeight;
    this.container.y = this.y + bobOffset;
    
    // Pulse glow
    const glowAlpha = 0.4 + 0.2 * Math.sin(this.animationTime * this.glowPulseSpeed);
    this.glowSprite.alpha = glowAlpha;
  }
  
  private applyMagnetization(dt: number, snakeHead: { x: number; y: number }) {
    const distance = Math.hypot(this.x - snakeHead.x, this.y - snakeHead.y);
    
    // Only apply magnetization if within range
    if (distance <= this.MAGNET_RANGE) {
      // Calculate direction to snake head
      const dx = snakeHead.x - this.x;
      const dy = snakeHead.y - this.y;
      const length = Math.hypot(dx, dy) || 1;
      
      // Normalize direction
      const dirX = dx / length;
      const dirY = dy / length;
      
      // Calculate magnetic force (stronger when closer)
      const magnetForce = (1 - distance / this.MAGNET_RANGE) * this.MAGNET_STRENGTH;
      
      // Apply magnetic movement
      const moveDistance = this.MAGNET_SPEED * dt * magnetForce;
      this.x += dirX * moveDistance;
      this.y += dirY * moveDistance;
    }
  }
  
  // Check if food is collected by snake
  isCollectedBy(snakeX: number, snakeY: number, snakeRadius: number = 10): boolean {
    if (this.collected) return false;
    
    const distance = Math.hypot(this.x - snakeX, this.y - snakeY);
    return distance < snakeRadius + 6; // 6 is food radius
  }
  
  // Mark as collected and return value
  collect(): boolean {
    if (this.collected) return false;
    
    this.collected = true;
    this.container.visible = false;
    return true;
  }
  
  // Get food data for serialization
  getData(): FoodData {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      collected: this.collected,
      spawnTime: this.spawnTime
    };
  }
  
  // Clean up resources
  destroy() {
    this.container.destroy({ children: true });
  }
}
