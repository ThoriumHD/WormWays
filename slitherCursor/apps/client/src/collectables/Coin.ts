import * as PIXI from 'pixi.js';

export interface CoinData {
  id: string;
  x: number;
  y: number;
  value: number;
  collected: boolean;
  spawnTime: number;
}

export class Coin {
  public id: string;
  public x: number;
  public y: number;
  public value: number;
  public collected: boolean;
  public spawnTime: number;
  public sprite!: PIXI.Sprite;
  public glowSprite!: PIXI.Sprite;
  public container: PIXI.Container;
  
  // Animation properties
  private animationTime: number = 0;
  private rotationSpeed: number = 2; // radians per second
  private bobSpeed: number = 3; // bobs per second
  private bobHeight: number = 8; // pixels
  private glowPulseSpeed: number = 4; // pulses per second
  
  // Magnetization properties
  private readonly MAGNET_RANGE = 120; // pixels - range at which magnetization starts
  private readonly MAGNET_STRENGTH = 0.9; // strength of magnetic pull (0-1) - much stronger
  private readonly MAGNET_SPEED = 400; // pixels per second when magnetized - much faster
  
  constructor(x: number, y: number, value: number = 0.10) {
    this.id = `coin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.x = x;
    this.y = y;
    this.value = value;
    this.collected = false;
    this.spawnTime = Date.now();
    
    this.container = new PIXI.Container();
    this.createSprites();
  }
  
  private createSprites() {
    // Create glow effect (behind coin)
    this.glowSprite = new PIXI.Sprite();
    this.createGlowTexture();
    this.glowSprite.anchor.set(0.5);
    this.glowSprite.blendMode = 'add';
    this.container.addChild(this.glowSprite);
    
    // Create coin sprite
    this.sprite = new PIXI.Sprite();
    this.createCoinTexture();
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);
    
    // Set initial position
    this.container.position.set(this.x, this.y);
  }
  
  private createGlowTexture() {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Create radial gradient for glow
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    this.glowSprite.texture = PIXI.Texture.from(canvas);
  }
  
  private createCoinTexture() {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Draw coin body
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw coin border
    ctx.strokeStyle = '#FFA500';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw dollar sign
    ctx.fillStyle = '#FFA500';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', size/2, size/2);
    
    this.sprite.texture = PIXI.Texture.from(canvas);
  }
  
  update(dt: number, snakeHead?: { x: number; y: number }) {
    if (this.collected) return;
    
    this.animationTime += dt;
    
    // Apply magnetization if snake head is within range
    if (snakeHead) {
      this.applyMagnetization(dt, snakeHead);
    }
    
    // Rotate coin
    this.sprite.rotation = this.animationTime * this.rotationSpeed;
    
    // Bob up and down
    const bobOffset = Math.sin(this.animationTime * this.bobSpeed) * this.bobHeight;
    this.container.y = this.y + bobOffset;
    
    // Pulse glow
    const glowAlpha = 0.5 + 0.3 * Math.sin(this.animationTime * this.glowPulseSpeed);
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
  
  // Check if coin is collected by snake
  isCollectedBy(snakeX: number, snakeY: number, snakeRadius: number = 10): boolean {
    if (this.collected) return false;
    
    const distance = Math.hypot(this.x - snakeX, this.y - snakeY);
    return distance < snakeRadius + 8; // 8 is coin radius
  }
  
  // Mark as collected and return value
  collect(): number {
    if (this.collected) return 0;
    
    this.collected = true;
    this.container.visible = false;
    return this.value;
  }
  
  // Get coin data for serialization
  getData(): CoinData {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      value: this.value,
      collected: this.collected,
      spawnTime: this.spawnTime
    };
  }
  
  // Clean up resources
  destroy() {
    this.container.destroy({ children: true });
  }
}
