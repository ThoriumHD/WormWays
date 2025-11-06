
type Camera = { x: number; y: number; smoothX: number; smoothY: number; zoom: number };

export class WorldRenderer {
  private ctx: CanvasRenderingContext2D;
  private cam: Camera = { x: 0, y: 0, smoothX: 0, smoothY: 0, zoom: 1 };
  private worldSize: number = 8000; // Much larger world size
  
  // Food system - Slither.io style
  private foodPellets: Array<{
    x: number;
    y: number;
    radius: number;
    color: string;
    points: number;
    eaten: boolean;
    rotationCenter: { x: number; y: number };
    rotationAngle: number;
    rotationSpeed: number;
    // Server handles all food magnetism - no client-side tracking needed
    createdBy?: string; // Track who created this pellet (for anti-farming)
    id?: string; // Food ID for tracking and smooth updates
    fadeInProgress?: number; // Track fade-in for smooth appearance
    spawnTargetRadius?: number; // Target radius for spawn fade-in animation
  }> = [];
  
  // Food system constants
  private readonly FOOD_CONFIG = {
    targetCount: 300,        // More food for larger world
    spawnInterval: 0.3,      // Spawn every 300ms
    baseRadius: 3,           // Smallest food size
    maxRadius: 6,            // Largest food size
    arenaSize: 0.95,         // Use 95% of world size (almost full map)
  };
  
  private spawnTimer: number = 0;
  private gameTime: number = 0; // Track game time for pulsing effects

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.initializeFood();
  }
  
  private initializeFood() {
    this.foodPellets = [];
    this.spawnTimer = 0;
    
    // Spawn initial food pellets
    for (let i = 0; i < this.FOOD_CONFIG.targetCount; i++) {
      this.spawnFoodPellet();
    }
  }

  private spawnFoodPellet() {
    const arenaSize = this.worldSize * this.FOOD_CONFIG.arenaSize;
    
    // Random position across the entire arena
    const x = (Math.random() - 0.5) * arenaSize;
    const y = (Math.random() - 0.5) * arenaSize;
    
    // Random size (1x to 2x base radius)
    const radius = this.FOOD_CONFIG.baseRadius + Math.random() * (this.FOOD_CONFIG.maxRadius - this.FOOD_CONFIG.baseRadius);
    
    // Random color
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff8844', '#ff44ff', '#44ffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    // Points proportional to size
    const points = Math.floor(radius / this.FOOD_CONFIG.baseRadius);
    
    // Random rotation center (near the food)
    const rotationCenter = {
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20
    };
    
    // Random rotation speed (one revolution every ~2 seconds)
    const rotationSpeed = (Math.random() - 0.5) * 0.1;
    
    this.foodPellets.push({
      x,
      y,
      radius,
      color,
      points,
      eaten: false,
      rotationCenter,
      rotationAngle: Math.random() * Math.PI * 2,
      rotationSpeed,
    });
  }

  setWorldSize(size: number) { 
    this.worldSize = size; 
    this.initializeFood(); // Reinitialize food with new world size
  }

  update(state: any) {
    // Update camera position
    if (state.snakeHead) {
      this.cam.x = state.snakeHead.x;
      this.cam.y = state.snakeHead.y;
    }
    // camera lerp
    this.cam.smoothX += (this.cam.x - this.cam.smoothX) * 0.1;
    this.cam.smoothY += (this.cam.y - this.cam.smoothY) * 0.1;
    
    // Don't apply food magnetism in multiplayer mode - server handles all food interactions
    // The server food will be rendered directly without client-side modifications
    
    // Update server food if provided
    if (state.serverFood) {
      this.updateServerFood(state.serverFood);
    }
  }

  // Update server food (from multiplayer state)
  private updateServerFood(serverFood: any[]) {
    // Debug logging to track food changes
    if (this.foodPellets.length !== serverFood.length) {
      console.log(`[Client] Food count changed: ${this.foodPellets.length} -> ${serverFood.length}`);
      
      // Log which food IDs are new or missing
      const existingIds = new Set(this.foodPellets.map(f => f.id).filter(Boolean));
      const serverIds = new Set(serverFood.map(f => f.id));
      
      const newIds = [...serverIds].filter(id => !existingIds.has(id));
      const removedIds = [...existingIds].filter(id => !serverIds.has(id));
      
      if (newIds.length > 0) {
        console.log(`[Client] New food IDs:`, newIds);
      }
      if (removedIds.length > 0) {
        console.log(`[Client] Removed food IDs:`, removedIds);
      }
    }
    
    // Create a map of existing food by ID for smooth updates
    const existingFood = new Map();
    for (const food of this.foodPellets) {
      if (food.id) {
        existingFood.set(food.id, food);
      }
    }
    
    // Update food array with smooth transitions
    this.foodPellets = serverFood.map(food => {
      const existing = existingFood.get(food.id);
      
      if (existing) {
        // Handle spawn fade-in for newly spawned food
        let updatedRadius = existing.radius;
        if (existing.spawnTargetRadius && existing.radius < existing.spawnTargetRadius) {
          // Gradually increase radius if still spawning
          updatedRadius = Math.min(existing.radius + (existing.spawnTargetRadius - existing.radius) * 0.2, existing.spawnTargetRadius);
        }
        
        // Only blend if there's significant movement to prevent unnecessary flickering
        const dx = food.x - existing.x;
        const dy = food.y - existing.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If movement is very small (< 0.5px), snap to server position to prevent micro-movements
        if (distance < 0.5) {
          return {
            ...existing,
            x: food.x,
            y: food.y,
            radius: updatedRadius,
            color: food.color,
            points: Math.max(1, Math.floor(food.radius / this.FOOD_CONFIG.baseRadius)),
            // Keep existing rotation values to prevent flickering
          };
        }
        
        // Smooth blending for all movements - use faster blending to match velocity-based server movement
        const blendFactor = 0.35; // Faster blending to match smooth server physics
        return {
          ...existing,
          x: existing.x + dx * blendFactor,
          y: existing.y + dy * blendFactor,
          radius: updatedRadius,
          color: food.color,
          points: Math.max(1, Math.floor(food.radius / this.FOOD_CONFIG.baseRadius)),
          // Keep existing rotation values to prevent flickering
        };
      } else {
        // New food - start with slightly smaller radius and fade in smoothly
        return {
          x: food.x,
          y: food.y,
          radius: food.radius * 0.8, // Start smaller
          color: food.color,
          points: Math.max(1, Math.floor(food.radius / this.FOOD_CONFIG.baseRadius)),
          eaten: false,
          rotationCenter: { x: food.x, y: food.y },
          rotationAngle: Math.random() * Math.PI * 2,
          rotationSpeed: 0.5 + Math.random() * 1.0,
          createdBy: 'server',
          id: food.id, // Add ID for tracking
          fadeInProgress: 0, // Track fade-in for smooth appearance
          spawnTargetRadius: food.radius // Store target radius
        };
      }
    });
  }

  // Render server food (from multiplayer state)
  renderServerFood(serverFood: any[], dt: number, snakeHead: { x: number; y: number }, boostPoints: number) {
    this.gameTime += dt;
    
    for (const food of serverFood) {
      if (food.eaten) continue;
      
      // Don't apply magnetism - server handles all food interactions
      // Just render the food pellet at its server-determined position
      const screenPos = this.worldToScreen(food.x, food.y);
      this.drawColoredFoodPellet(screenPos.x, screenPos.y, food.color, food.radius);
    }
  }

  // Draw food pellet with custom color
  private drawColoredFoodPellet(x: number, y: number, color: string, radius: number) {
    // Create pulsing effect
    const pulse = Math.sin(this.gameTime * 3) * 0.3 + 0.7;
    const finalRadius = radius * pulse;
    
    // Create gradient for the food pellet
    const gradient = this.ctx.createRadialGradient(
      x, y, 0,
      x, y, finalRadius
    );
    
    // Parse the color and create a lighter version for the center
    const baseColor = color;
    const lighterColor = this.lightenColor(baseColor, 0.3);
    
    gradient.addColorStop(0, lighterColor);
    gradient.addColorStop(1, baseColor);
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, finalRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add a subtle highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.beginPath();
    this.ctx.arc(x - finalRadius * 0.3, y - finalRadius * 0.3, finalRadius * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // Helper function to lighten a color
  private lightenColor(color: string, factor: number): string {
    // Simple color lightening - convert hex to RGB, lighten, convert back
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
    const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
    const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  // Convert death pellets to food pellets (for other players to eat)
  addDeathPelletsAsFood(deathDots: Array<{x: number, y: number, radius: number, progress: number, color: string}>) {
    for (const dot of deathDots) {
      // Only add pellets that have finished animating (progress >= 1.0)
      if (dot.progress >= 1.0) {
        // Check if this pellet is already added (avoid duplicates)
        const alreadyExists = this.foodPellets.some(food => 
          Math.abs(food.x - dot.x) < 1 && Math.abs(food.y - dot.y) < 1
        );
        
        if (!alreadyExists) {
          this.foodPellets.push({
            x: dot.x,
            y: dot.y,
            radius: dot.radius,
            color: dot.color,
            points: 2, // Double value for death pellets
            eaten: false,
            rotationCenter: { x: dot.x, y: dot.y },
            rotationAngle: Math.random() * Math.PI * 2,
            rotationSpeed: 0.5 + Math.random() * 1.0, // Random rotation speed
            createdBy: 'death' // Mark as created by death
          });
        }
      }
    }
  }

  // Add trail dots as food pellets
  addTrailDotsAsFood(trailDots: Array<{x: number, y: number, radius: number, age: number, maxAge: number, processed: boolean}>, playerId: string = 'player') {
    for (const dot of trailDots) {
      // Only add dots that haven't been processed yet
      if (!dot.processed) {
        this.foodPellets.push({
          x: dot.x,
          y: dot.y,
          radius: dot.radius,
          color: '#4A90E2', // Blue color matching snake
          points: 1, // Each trail dot gives 1 point (same as lost mass)
          eaten: false,
          rotationCenter: { x: dot.x, y: dot.y },
          rotationAngle: Math.random() * Math.PI * 2,
          rotationSpeed: 0.5 + Math.random() * 0.5,
          createdBy: playerId // Track who created this pellet
        });
        // Mark as processed
        dot.processed = true;
      }
    }
  }

  render(camera: { x: number; y: number; zoom: number }) {
    this.cam = { ...camera, smoothX: camera.x, smoothY: camera.y };
    // Don't draw world border here - it will be drawn after all game objects
  }

  private worldToScreen(x: number, y: number) {
    return { 
      x: (x - this.cam.smoothX) * this.cam.zoom + window.innerWidth / 2, 
      y: (y - this.cam.smoothY) * this.cam.zoom + window.innerHeight / 2 
    };
  }

  // Public method to draw world border (called after all game objects)
  renderWorldBorder() {
    this.drawWorldBorder();
  }

  private drawWorldBorder() {
    const canvas = this.ctx.canvas;
    const worldRadius = this.worldSize / 2;
    
    // Convert world center to screen coordinates
    const screenCenter = this.worldToScreen(0, 0);
    const screenRadius = worldRadius * this.cam.zoom;
    
    // Save context
    this.ctx.save();
    
    // Create a clipping path that excludes the circular world area
    this.ctx.beginPath();
    this.ctx.rect(0, 0, canvas.width, canvas.height);
    this.ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
    this.ctx.clip('evenodd'); // Use even-odd rule to exclude the circle
    
    // Fill the clipped area (outside the circle) with red tint
    this.ctx.fillStyle = 'rgba(204, 0, 0, 0.3)'; // 10% darker red
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Restore context
    this.ctx.restore();
    
    // Draw the red circular border
    this.ctx.strokeStyle = '#cc0000'; // 10% darker red
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
    this.ctx.stroke();
  }



  // Method to render food pellets - Slither.io style
  renderFood(state: any, dt: number, snakeHead?: { x: number; y: number }, boostPoints: number = 0) {
    this.ctx.save();
    
    // Update game time for pulsing effects
    this.gameTime += dt;
    
    // Apply camera transform for world coordinates
    const canvas = this.ctx.canvas;
    this.ctx.translate(canvas.width / 2, canvas.height / 2);
    this.ctx.scale(this.cam.zoom, this.cam.zoom);
    this.ctx.translate(-this.cam.smoothX, -this.cam.smoothY);
    
    // Update food spawning - DISABLED for server-authoritative multiplayer
    // this.updateFoodSpawning(dt);  // Client should not spawn food in multiplayer
    
    // Server handles all food magnetism - no client-side magnetism needed
    
    // Calculate viewport bounds for culling (performance optimization)
    const viewportWidth = canvas.width / this.cam.zoom;
    const viewportHeight = canvas.height / this.cam.zoom;
    const viewportLeft = this.cam.smoothX - viewportWidth / 2;
    const viewportRight = this.cam.smoothX + viewportWidth / 2;
    const viewportTop = this.cam.smoothY - viewportHeight / 2;
    const viewportBottom = this.cam.smoothY + viewportHeight / 2;
    const cullMargin = 50; // Render food slightly outside viewport for smooth scrolling
    
    // Render only uneaten food within viewport (with margin for smooth scrolling)
    // Also update rotations only for visible food
    for (const food of this.foodPellets) {
      if (food.eaten) continue;
      
      // Viewport culling: only process food that's visible or near viewport
      const isVisible = food.x >= viewportLeft - cullMargin && food.x <= viewportRight + cullMargin &&
                       food.y >= viewportTop - cullMargin && food.y <= viewportBottom + cullMargin;
      
      if (!isVisible) continue; // Skip food outside viewport
      
      // Update rotation only for visible food (performance optimization)
      food.rotationAngle += food.rotationSpeed * dt * 2.0;
      
      // Render visible food
      this.drawSlitherFoodPellet(food, this.gameTime);
    }
    
    this.ctx.restore();
  }
  
  
  // Method to check if player is outside world border
  checkWorldBorderCollision(snakeHead: { x: number; y: number }, snakeRadius: number = 8): boolean {
    const worldRadius = this.worldSize / 2;
    const distanceFromCenter = Math.sqrt(snakeHead.x * snakeHead.x + snakeHead.y * snakeHead.y);
    
    // Player is outside border if distance + radius exceeds world radius
    return (distanceFromCenter + snakeRadius) > worldRadius;
  }
  checkFoodCollisions(snakeHead: { x: number; y: number }, snakeRadius: number = 8, playerId: string = 'player', boostPoints: number = 0): number {
    let totalPoints = 0;
    
    for (const food of this.foodPellets) {
      if (food.eaten) continue;
      
      // Always allow eating any food - no restrictions
      const dx = food.x - snakeHead.x;
      const dy = food.y - snakeHead.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Collision radius includes both snake and food radius
      const collisionRadius = snakeRadius + food.radius;
      
      if (distance < collisionRadius) {
        food.eaten = true;
        totalPoints += food.points;
      }
    }
    
    return totalPoints;
  }
  
  private drawGlowingFoodPellet(x: number, y: number) {
    const radius = 4;
    
    // Create glowing effect with multiple layers
    // Outer glow
    const outerGradient = this.ctx.createRadialGradient(
      x, y, 0,
      x, y, radius * 3
    );
    outerGradient.addColorStop(0, 'rgba(255, 100, 100, 0.3)');
    outerGradient.addColorStop(0.5, 'rgba(255, 100, 100, 0.1)');
    outerGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
    
    this.ctx.fillStyle = outerGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Inner glow
    const innerGradient = this.ctx.createRadialGradient(
      x, y, 0,
      x, y, radius * 1.5
    );
    innerGradient.addColorStop(0, 'rgba(255, 150, 150, 0.8)');
    innerGradient.addColorStop(0.7, 'rgba(255, 100, 100, 0.4)');
    innerGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');
    
    this.ctx.fillStyle = innerGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Core dot
    this.ctx.fillStyle = '#FF6666';
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Bright center highlight
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.beginPath();
    this.ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private colorFromShort(c: number) {
    // map 0..1023 to an HSL-ish rainbow
    const h = (c % 1024) / 1024 * 360;
    return this.hslToHex(h, 80, 55);
  }

  private hslToHex(h: number, s: number, l: number) {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const r = Math.round(255 * f(0));
    const g = Math.round(255 * f(8));
    const b = Math.round(255 * f(4));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  private updateFoodSpawning(dt: number) {
    this.spawnTimer += dt;
    
    // Spawn new food periodically
    if (this.spawnTimer >= this.FOOD_CONFIG.spawnInterval) {
      this.spawnTimer = 0;
      
      // Count uneaten food
      const uneatenCount = this.foodPellets.filter(f => !f.eaten).length;
      
      // Spawn new food if we're below target count
      if (uneatenCount < this.FOOD_CONFIG.targetCount) {
        this.spawnFoodPellet();
      }
    }
  }

  private updateFoodRotations(dt: number) {
    // Food rotations are now updated inline during rendering for better performance
    // This method is kept for backward compatibility but is no longer used
  }

  private drawSlitherFoodPellet(food: any, time: number = 0) {
    const { x, y, radius, color, rotationAngle } = food;
    
    // Calculate pulsing glow intensity (more pronounced pulse)
    const pulseIntensity = 1.0 + Math.sin(time * 2) * 0.2; // 20% pulse variation
    const glowRadius = radius * 8 * pulseIntensity; // Much larger glow radius
    
    // Save context for rotation
    this.ctx.save();
    
    // Apply small rotation around the food's center
    this.ctx.translate(x, y);
    this.ctx.rotate(rotationAngle);
    this.ctx.translate(-x, -y);
    
    // Outer pulsing glow aura (more subtle)
    const outerGradient = this.ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    outerGradient.addColorStop(0, color + '20'); // Much more transparent center
    outerGradient.addColorStop(0.1, color + '15'); // Very transparent
    outerGradient.addColorStop(0.3, color + '10'); // Barely visible
    outerGradient.addColorStop(0.6, color + '05'); // Almost invisible
    outerGradient.addColorStop(1, color + '00'); // Transparent edge
    
    this.ctx.fillStyle = outerGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Main pellet
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Centered highlight gradient (more noticeable)
    const highlightGradient = this.ctx.createRadialGradient(
      x, y, 0,
      x, y, radius * 1.2
    );
    highlightGradient.addColorStop(0, '#ffffffcc'); // Very bright white center
    highlightGradient.addColorStop(0.2, '#ffffff99'); // Strong white
    highlightGradient.addColorStop(0.5, '#ffffff66'); // Medium white
    highlightGradient.addColorStop(0.8, '#ffffff33'); // Light white
    highlightGradient.addColorStop(1, '#ffffff00'); // Transparent edge
    
    this.ctx.fillStyle = highlightGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Restore context
    this.ctx.restore();
  }
}