// apps/client/src/view/GameOverScreen.ts
export class GameOverScreen {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isVisible = false;
  private finalScore = 0;
  
  // UI elements
  private playAgainButton = {
    x: 0, y: 0, width: 180, height: 50,
    text: "PLAY AGAIN",
    hovered: false
  };
  
  private mainMenuButton = {
    x: 0, y: 0, width: 180, height: 50,
    text: "MAIN MENU",
    hovered: false
  };
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }
  
  private handleMouseMove(e: MouseEvent) {
    if (!this.isVisible) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check button hovers
    this.playAgainButton.hovered = (
      x >= this.playAgainButton.x && x <= this.playAgainButton.x + this.playAgainButton.width &&
      y >= this.playAgainButton.y && y <= this.playAgainButton.y + this.playAgainButton.height
    );
    
    this.mainMenuButton.hovered = (
      x >= this.mainMenuButton.x && x <= this.mainMenuButton.x + this.mainMenuButton.width &&
      y >= this.mainMenuButton.y && y <= this.mainMenuButton.y + this.mainMenuButton.height
    );
  }
  
  private handleClick(e: MouseEvent) {
    if (!this.isVisible) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check button clicks
    if (this.playAgainButton.hovered) {
      this.playAgain();
    } else if (this.mainMenuButton.hovered) {
      this.returnToMainMenu();
    }
  }
  
  private playAgain() {
    this.isVisible = false;
    window.dispatchEvent(new CustomEvent('playAgain'));
  }
  
  private returnToMainMenu() {
    this.isVisible = false;
    window.dispatchEvent(new CustomEvent('returnToMainMenu'));
  }
  
  show(finalScore: number) {
    this.isVisible = true;
    this.finalScore = finalScore;
  }
  
  hide() {
    this.isVisible = false;
  }
  
  render() {
    if (!this.isVisible) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Draw semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, width, height);
    
    // Draw game over panel
    this.drawGameOverPanel();
  }
  
  private drawGameOverPanel() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const panelWidth = 500;
    const panelHeight = 400;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    
    // Panel background (matching landing page style)
    this.ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
    this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Panel border (matching landing page style)
    this.ctx.strokeStyle = 'rgba(135, 206, 235, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Add backdrop blur effect (simulated)
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowBlur = 32;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 8;
    
    // Game Over title (matching landing page style)
    this.ctx.fillStyle = '#ff4444';
    this.ctx.font = 'bold 48px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', width / 2, panelY + 80);
    
    // Final score (matching landing page style)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 28px Arial';
    this.ctx.fillText(`Final Score: ${this.finalScore}`, width / 2, panelY + 130);
    
    // Death message (matching landing page style)
    this.ctx.fillStyle = '#cccccc';
    this.ctx.font = '18px Arial';
    this.ctx.fillText('Your snake has been defeated!', width / 2, panelY + 170);
    
    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    
    // Buttons
    const buttonY = panelY + 220;
    const buttonSpacing = 30;
    const totalButtonWidth = this.playAgainButton.width + this.mainMenuButton.width + buttonSpacing;
    const buttonStartX = (width - totalButtonWidth) / 2;
    
    // Play Again button
    this.playAgainButton.x = buttonStartX;
    this.playAgainButton.y = buttonY;
    this.drawButton(
      this.playAgainButton.x, 
      this.playAgainButton.y, 
      this.playAgainButton.width, 
      this.playAgainButton.height,
      this.playAgainButton.text,
      this.playAgainButton.hovered ? '#87ceeb' : '#4a90e2'
    );
    
    // Main Menu button
    this.mainMenuButton.x = buttonStartX + this.playAgainButton.width + buttonSpacing;
    this.mainMenuButton.y = buttonY;
    this.drawButton(
      this.mainMenuButton.x, 
      this.mainMenuButton.y, 
      this.mainMenuButton.width, 
      this.mainMenuButton.height,
      this.mainMenuButton.text,
      this.mainMenuButton.hovered ? '#87ceeb' : '#4a90e2'
    );
  }
  
  private drawButton(x: number, y: number, width: number, height: number, text: string, color: string) {
    // Button background (matching landing page style)
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    
    // Button border (matching landing page style)
    this.ctx.strokeStyle = 'rgba(135, 206, 235, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);
    
    // Button text (matching landing page style)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, x + width / 2, y + height / 2 + 6);
    this.ctx.textAlign = 'left';
  }
}
