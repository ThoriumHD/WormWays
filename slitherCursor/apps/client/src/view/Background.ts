export default class Background {
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private imageLoaded = false;
  private worldSize = 8000; // Match server world size
  private tileSize = 460; // Size of each hex tile
  private tileSpacing = 0; // Gap between tiles
  
  // Background extension settings
  private backgroundPaddingMultiplier = 2.0; // How many screen sizes to extend beyond visible area
  private extraTilePadding = 2; // Additional tiles beyond calculated padding
  
  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }
  
  static async create(ctx: CanvasRenderingContext2D, imageUrl: string): Promise<Background> {
    const background = new Background(ctx);
    await background.loadImage(imageUrl);
    return background;
  }
  
  private async loadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.imageLoaded = true;
        console.log('[Background] Hex tile image loaded successfully');
        console.log('[Background] Image dimensions:', img.width, 'x', img.height);
        resolve();
      };
      img.onerror = () => {
        console.error('[Background] Failed to load hex tile image:', imageUrl);
        reject(new Error('Failed to load background image'));
      };
      img.src = imageUrl;
    });
  }
  
  setWorldSize(size: number) {
    this.worldSize = size;
  }
  
  setBackgroundPadding(multiplier: number) {
    this.backgroundPaddingMultiplier = multiplier;
  }
  
  setExtraTilePadding(padding: number) {
    this.extraTilePadding = padding;
  }
  
  update(camera: { x: number; y: number; zoom: number }) {
    if (!this.imageLoaded || !this.image) return;
    
    const canvas = this.ctx.canvas;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Save the current context state
    this.ctx.save();
    
    // Apply camera transform
    this.ctx.translate(canvasWidth / 2, canvasHeight / 2);
    this.ctx.scale(camera.zoom, camera.zoom);
    this.ctx.translate(-camera.x, -camera.y);
    
    // Calculate tile dimensions maintaining aspect ratio
    const aspectRatio = this.image.width / this.image.height;
    const tileWidth = this.tileSize + this.tileSpacing;
    const tileHeight = (this.tileSize / aspectRatio) + this.tileSpacing;
    
    // Calculate screen bounds in world coordinates
    const screenLeft = (-canvasWidth / 2) / camera.zoom + camera.x;
    const screenRight = (canvasWidth / 2) / camera.zoom + camera.x;
    const screenTop = (-canvasHeight / 2) / camera.zoom + camera.y;
    const screenBottom = (canvasHeight / 2) / camera.zoom + camera.y;
    
    // Calculate tile range needed to cover the entire screen with EXTRA padding
    // Add much more padding to ensure background extends far beyond any visible area
    const padding = Math.max(canvasWidth, canvasHeight) / camera.zoom * this.backgroundPaddingMultiplier;
    const startX = Math.floor((screenLeft - padding) / tileWidth) - this.extraTilePadding;
    const endX = Math.ceil((screenRight + padding) / tileWidth) + this.extraTilePadding;
    const startY = Math.floor((screenTop - padding) / tileHeight) - this.extraTilePadding;
    const endY = Math.ceil((screenBottom + padding) / tileHeight) + this.extraTilePadding;
    
    // Draw tiles to cover the entire screen and beyond - NO WORLD BOUNDS RESTRICTION
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const tileX = x * tileWidth;
        const tileY = y * tileHeight;
        
        // Draw ALL tiles - no world bounds restriction
        // This ensures the background extends far beyond the world border
        this.ctx.drawImage(
          this.image,
          tileX,
          tileY,
          this.tileSize,
          this.tileSize / aspectRatio
        );
      }
    }
    
    // Restore the context state
    this.ctx.restore();
  }
}
