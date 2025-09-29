import * as PIXI from 'pixi.js';
import { MoneySystem } from './MoneySystem';

export class MoneyDisplay extends PIXI.Container {
  private moneyText: PIXI.Text;
  private background: PIXI.Graphics;
  private moneySystem: MoneySystem;
  private isVisible: boolean = false;
  private animationTime: number = 0;
  
  // Display settings
  private readonly FONT_SIZE = 20;
  private readonly BACKGROUND_PADDING = 10;
  private readonly BACKGROUND_RADIUS = 15;
  private readonly FADE_IN_DURATION = 0.3;
  private readonly FADE_OUT_DURATION = 0.5;
  private readonly BOUNCE_HEIGHT = 20;
  private readonly BOUNCE_DURATION = 0.6;
  
  constructor(moneySystem: MoneySystem) {
    super();
    this.moneySystem = moneySystem;
    
    // Create background
    this.background = new PIXI.Graphics();
    this.addChild(this.background);
    
    // Create money text
    this.moneyText = new PIXI.Text('$0.00', {
      fontFamily: 'Arial, sans-serif',
      fontSize: this.FONT_SIZE,
      fill: 0xFFFFFF,
      fontWeight: 'bold',
    });
    this.moneyText.anchor.set(0.5);
    this.addChild(this.moneyText);
    
    // Make visible from the start
    this.visible = true;
    this.isVisible = true;
  }
  
  update(dt: number, snakeHeadPosition: { x: number; y: number }): void {
    // Always show the money display
    this.isVisible = true;
    this.visible = true;
    this.animationTime += dt;
    
    // Update position above snake head
    // The snakeHeadPosition is in world coordinates, but we need to position relative to the container
    // Since the container is transformed by camera, we need to account for that
    const baseY = snakeHeadPosition.y - 40;
    const floatOffset = Math.sin(this.animationTime * 2) * 3; // Gentle 3px float
    this.position.set(snakeHeadPosition.x, baseY + floatOffset);
    
    // Update money text with proper formatting
    const money = this.moneySystem.getMoney();
    this.moneyText.text = `$${money.toFixed(2)}`;
    
    // Update background size
    this.updateBackground();
    
    // Apply constant display animations
    this.applyConstantAnimations();
    
    // Debug logging (remove after testing)
    if (Math.random() < 0.01) { // 1% chance to log
      console.log('Money display:', {
        visible: this.visible,
        position: { x: this.position.x, y: this.position.y },
        money: money,
        text: this.moneyText.text,
        snakeHead: snakeHeadPosition
      });
    }
  }
  
  private updateBackground(): void {
    const bounds = this.moneyText.getBounds();
    const width = bounds.width + this.BACKGROUND_PADDING * 2;
    const height = bounds.height + this.BACKGROUND_PADDING * 2;
    
    this.background.clear();
    this.background.beginFill(0x000000, 0.9); // More opaque background
    this.background.drawRoundedRect(
      -width / 2, 
      -height / 2, 
      width, 
      height, 
      this.BACKGROUND_RADIUS
    );
    this.background.endFill();
  }
  
  private applyConstantAnimations(): void {
    // Fade in animation on first show
    const fadeProgress = Math.min(this.animationTime / this.FADE_IN_DURATION, 1);
    this.alpha = fadeProgress;
    
    // Scale animation on first show
    const scaleProgress = Math.min(this.animationTime / this.FADE_IN_DURATION, 1);
    this.scale.set(0.8 + 0.2 * scaleProgress);
  }
  
  // Force show money display (for testing or special events)
  forceShow(): void {
    this.moneySystem.addMoney(0); // This will update lastUpdate time
  }
  
  // Get the money system for external access
  getMoneySystem(): MoneySystem {
    return this.moneySystem;
  }
}
