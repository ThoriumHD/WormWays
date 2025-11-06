// apps/game-server/src/GameWorld.ts
import { ServerSnake, Vec2, SNAKE } from './ServerSnake';

export interface Food {
  x: number;
  y: number;
  radius: number;
  color: string;
  id: string;
  // Velocity-based magnetism for smooth movement
  vx: number;
  vy: number;
  committedSnakeId?: string; // Track which snake this pellet is committed to following
}

export interface PlayerInput {
  /** Client tick number (optional for backward compatibility) */
  t?: number;
  mouseX: number;
  mouseY: number;
  boost: boolean;
}

export interface GameState {
  tick: number;
  serverTimeMs: number;
  players: Array<{
    playerId: string;
    name: string;
    angle: number;
    boosting: boolean;
    score: number;
    isDead: boolean;
    deathAnimationProgress: number;
    snakeFadeProgress: number;
    head: Vec2;
    points: Vec2[];
    boostTrailDots: Array<{
      x: number;
      y: number;
      radius: number;
      age: number;
      maxAge: number;
      processed: boolean;
    }>;
    deathDots: Array<{
      x: number;
      y: number;
      radius: number;
      progress: number;
      color: string;
    }>;
    actualSegments: number;
    boostPoints: number;
  }>;
  food: Food[];
  acks: Record<string, number>;
}

export class GameWorld {
  private players = new Map<string, ServerSnake>();
  private playerInputs = new Map<string, PlayerInput>();
  /** Track last processed client tick for each player */
  private lastProcessedClientTick = new Map<string, number>();
  /** Track pending collisions for 1-tick confirmation window (border collisions are instant) */
  private pendingCollisions = new Map<string, number>(); // collision key -> confirmation state
  private food: Food[] = [];
  private tick = 0;
  private lastTickTime = 0;
  private tickRate = 30; // 30 FPS
  private tickInterval = 1000 / this.tickRate;
  
  // World configuration
  private readonly WORLD_SIZE = 4000; // Radius of circular world - match client's visible red circle
  
  // Server-side first food system - designed for multiplayer
  private readonly FOOD_CONFIG = {
    targetCount: 300,        // Total food pellets in world
    spawnRate: 0.5,         // Food spawns per second
    baseRadius: 3,           // Smallest food size
    maxRadius: 6,            // Largest food size
    arenaSize: 0.95,         // Use 95% of world size
    magnetismRadius: 80,     // Reduced range where food gets attracted
    magnetismStrength: 12000,  // Much faster acceleration to catch moving snakes
    eatRadius: 5,           // Smaller immediate eat range
    disableMagnetism: false, // Temporary flag to disable all food movement
    commitmentDistance: 40,  // Distance threshold for commitment
  };
  
  // Slither.io style food colors
  private readonly FOOD_COLORS = [
    '#ff4444', '#44ff44', '#4444ff', '#ffff44', 
    '#ff8844', '#ff44ff', '#44ffff', '#ff88ff',
    '#88ff88', '#8888ff', '#ffff88', '#ffaa44'
  ];
  
  private lastFoodSpawn = 0;
  private foodIdCounter = 0;

  constructor() {
    this.spawnInitialFood();
  }

  addPlayer(playerId: string, name: string): boolean {
    if (this.players.has(playerId)) {
      return false; // Player already exists
    }

    // Generate random spawn position
    const spawnPos = this.getRandomSpawnPosition();
    const spawnAngle = Math.random() * Math.PI * 2;

    const snake = new ServerSnake(playerId, name);
    snake.reset(spawnPos, spawnAngle);
    
    this.players.set(playerId, snake);
    this.playerInputs.set(playerId, { mouseX: 0, mouseY: 0, boost: false });
    this.lastProcessedClientTick.set(playerId, 0);
    
    console.log(`[GameWorld] Player ${name} (${playerId}) joined at (${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}) - distance from center: ${Math.sqrt(spawnPos.x * spawnPos.x + spawnPos.y * spawnPos.y).toFixed(1)}`);
    return true;
  }

  removePlayer(playerId: string): boolean {
    const removed = this.players.delete(playerId);
    this.playerInputs.delete(playerId);
    this.lastProcessedClientTick.delete(playerId);
    
    if (removed) {
      console.log(`[GameWorld] Player ${playerId} removed`);
    }
    
    return removed;
  }

  updatePlayerInput(playerId: string, input: PlayerInput): boolean {
    if (!this.players.has(playerId)) {
      return false;
    }
    
    this.playerInputs.set(playerId, input);
    
    // Track the client tick number if provided
    if (typeof input.t === 'number') {
      // Update last processed tick before physics runs (will be processed in updateSnakes)
      // We store it here but won't mark as processed until physics actually runs
    }
    
    return true;
  }

  private getRandomSpawnPosition(): Vec2 {
    // Spawn safely within border with buffer for snake radius
    const snakeRadius = 21; // Actual snake head radius from SNAKE.radius
    const borderBuffer = 200; // Buffer from border for smaller world
    const maxRadius = this.WORLD_SIZE - snakeRadius - borderBuffer;
    
    // Ensure we don't spawn too close to center either
    const minRadius = 100; // Minimum distance from center
    
    const angle = Math.random() * Math.PI * 2;
    const distance = minRadius + Math.random() * (maxRadius - minRadius);
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  }

  private spawnInitialFood() {
    console.log(`[GameWorld] Spawning initial ${this.FOOD_CONFIG.targetCount} food pellets`);
    for (let i = 0; i < this.FOOD_CONFIG.targetCount; i++) {
      this.spawnFood(true); // Pass true to indicate initial spawn
    }
    console.log(`[GameWorld] Initial food spawning complete`);
  }

  private spawnFood(isInitialSpawn: boolean = false): void {
    const maxRadius = this.WORLD_SIZE * this.FOOD_CONFIG.arenaSize;
    let attempts = 0;
    let food: Food;
    
    do {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * maxRadius;
      
      food = {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        radius: this.FOOD_CONFIG.baseRadius + Math.random() * (this.FOOD_CONFIG.maxRadius - this.FOOD_CONFIG.baseRadius),
        color: this.FOOD_COLORS[Math.floor(Math.random() * this.FOOD_COLORS.length)],
        id: `food_${this.foodIdCounter++}`,
        vx: 0,
        vy: 0,
        committedSnakeId: undefined
      };
      
      attempts++;
    } while (attempts < 10 && this.isFoodTooCloseToPlayers(food));
    
    this.food.push(food);
    
    // Only log runtime spawns, not initial spawns
    if (!isInitialSpawn) {
      console.log(`[GameWorld] Spawned food ${food.id} at (${food.x.toFixed(1)}, ${food.y.toFixed(1)})`);
    }
  }
  
  addBoostTrailPellet(x: number, y: number, radius: number, snakeColor: string = '#4a90e2'): void {
    // Create boost trail pellet as regular food with base radius (1 point value)
    const food: Food = {
      x,
      y,
      radius: this.FOOD_CONFIG.baseRadius * 1.2, // Increase size by 20%
      color: snakeColor, // Use snake's color
      id: `boost_${this.foodIdCounter++}`,
      vx: 0,
      vy: 0,
      committedSnakeId: undefined
    };
    
    this.food.push(food);
    console.log(`[GameWorld] Added boost trail pellet ${food.id} at (${food.x.toFixed(1)}, ${food.y.toFixed(1)})`);
  }
  
  addDeathDotsAsFood(snakePoints: readonly Vec2[], snakeRadius: number, snakeColor: string = '#4A90E2'): void {
    // Convert snake segments to death pellets (same as boost pellets)
    const pelletCount = Math.floor(snakePoints.length / 2); // Half the segment count, scales with snake size
    
    for (let i = 0; i < pelletCount; i++) {
      // Find a random segment to use as a base position
      const segmentIndex = Math.floor(Math.random() * snakePoints.length);
      const baseSegment = snakePoints[segmentIndex];
      
      // Add random offset within the snake's radius
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * snakeRadius * 0.8; // Stay within 80% of snake radius
      
      const offsetX = Math.cos(angle) * distance;
      const offsetY = Math.sin(angle) * distance;
      
      const food: Food = {
        x: baseSegment.x + offsetX,
        y: baseSegment.y + offsetY,
        radius: this.FOOD_CONFIG.baseRadius * 3, // Double size for death dots
        color: snakeColor, // Use snake's color
        id: `death_${this.foodIdCounter++}`,
        vx: 0,
        vy: 0,
        committedSnakeId: undefined
      };
      
      this.food.push(food);
      console.log(`[GameWorld] Added death dot ${food.id} at (${food.x.toFixed(1)}, ${food.y.toFixed(1)})`);
    }
  }
  
  /**
   * Determine which snake is "hitting" the other in a head-to-head collision.
   * Returns the snake that should die (the one moving into the collision).
   * 
   * Logic:
   * 1. Calculate movement vectors for both snakes
   * 2. Calculate vector from snake1 to snake2
   * 3. Determine which snake is moving more towards the collision point
   * 4. The snake moving more towards the collision dies
   */
  private determineCollisionDirection(snake1: ServerSnake, snake2: ServerSnake): ServerSnake {
    // Get movement vectors for both snakes
    const snake1Velocity = this.getSnakeVelocity(snake1);
    const snake2Velocity = this.getSnakeVelocity(snake2);
    
    // Calculate vector from snake1 to snake2
    const dx = snake2.head.x - snake1.head.x;
    const dy = snake2.head.y - snake1.head.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      // If heads are exactly on top of each other, use boosting as tiebreaker
      return snake1.boosting && !snake2.boosting ? snake1 : snake2;
    }
    
    // Normalize the collision vector
    const collisionDx = dx / distance;
    const collisionDy = dy / distance;
    
    // Calculate how much each snake is moving towards the collision
    // Positive dot product means moving towards each other
    const snake1TowardsCollision = snake1Velocity.x * collisionDx + snake1Velocity.y * collisionDy;
    const snake2TowardsCollision = snake2Velocity.x * (-collisionDx) + snake2Velocity.y * (-collisionDy);
    
    // The snake moving more towards the collision dies
    if (snake1TowardsCollision > snake2TowardsCollision) {
      return snake1;
    } else if (snake2TowardsCollision > snake1TowardsCollision) {
      return snake2;
    } else {
      // If equal, use boosting as tiebreaker (boosting snake dies)
      return snake1.boosting && !snake2.boosting ? snake1 : snake2;
    }
  }
  
  /**
   * Get the velocity vector of a snake based on its current movement.
   */
  private getSnakeVelocity(snake: ServerSnake): Vec2 & { speed: number } {
    // Get current speed and angle
    const speed = snake.boosting ? SNAKE.boostSpeed : SNAKE.speed;
    const angle = snake.angle;
    
    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
      speed: speed
    };
  }

  /**
   * Check if food collides with any part of a snake (head or body)
   */
  private checkFoodCollisionWithSnake(food: Food, snake: ServerSnake): boolean {
    // Collision scales proportionally with snake radius
    // Use snake's radius as base, so pickup scales with snake size
    const collisionDistance = food.radius + snake.r; // Full radius for proportional pickup
    
    // Only check collision with front third of snake (rounded up)
    const points = snake.getPoints();
    const frontThirdCount = Math.ceil(points.length / 3); // Rounded up
    
    for (let i = 0; i < frontThirdCount; i++) {
      const segment = points[i];
      const distance = Math.sqrt(
        (segment.x - food.x) ** 2 + (segment.y - food.y) ** 2
      );
      
      if (distance < collisionDistance) {
        return true; // Collision detected
      }
    }
    
    return false; // No collision
  }
  
  private isFoodTooCloseToPlayers(food: Food): boolean {
    const minDistance = 200; // Minimum distance from any player
    
    for (const [playerId, snake] of this.players) {
      if (snake.isDead) continue;
      
      const distance = Math.sqrt(
        (snake.head.x - food.x) ** 2 + (snake.head.y - food.y) ** 2
      );
      
      if (distance < minDistance) {
        return true;
      }
    }
    
    return false;
  }

  private maintainFoodCount(): void {
    const currentTime = Date.now();
    const dt = (currentTime - this.lastFoodSpawn) / 1000;
    
    // Only spawn food if we're significantly below target count AND enough time has passed
    const foodDeficit = this.FOOD_CONFIG.targetCount - this.food.length;
    const minSpawnInterval = 3.0; // Minimum 3 seconds between spawns
    
    if (foodDeficit > 5 && dt >= minSpawnInterval) {
      // Only spawn if we're missing more than 5 food pellets
      this.spawnFood();
      this.lastFoodSpawn = currentTime;
    }
    
    // Debug logging for food count changes
    if (this.tick % 300 === 0) { // Log every 10 seconds at 30fps
      console.log(`[GameWorld] Food count: ${this.food.length}/${this.FOOD_CONFIG.targetCount}`);
    }
  }

  private updateSnakes(dt: number): void {
    for (const [playerId, snake] of this.players) {
      if (snake.isDead) {
        snake.step(dt, snake.angle); // Continue death animation
        continue;
      }

      const input = this.playerInputs.get(playerId);
      if (!input) {
        snake.step(dt, snake.angle); // Continue in current direction
        continue;
      }

      // Calculate desired angle based on mouse position
      const head = snake.head;
      const dx = input.mouseX - head.x;
      const dy = input.mouseY - head.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Check for invalid input values
      if (!isFinite(input.mouseX) || !isFinite(input.mouseY) || !isFinite(dx) || !isFinite(dy)) {
        snake.step(dt, snake.angle); // Continue in current direction
        continue;
      }
      
      // Check for extremely large input values
      if (Math.abs(input.mouseX) > 100000 || Math.abs(input.mouseY) > 100000) {
        snake.step(dt, snake.angle); // Continue in current direction
        continue;
      }
      
      // Prevent jitter from very small movements - use minimum threshold
      const minDistance = 0.5; // Minimum distance to consider a valid input
      let desiredAngle: number;
      if (distance < minDistance) {
        // If movement is too small, continue in current direction (prevents jitter)
        desiredAngle = snake.angle;
      } else {
        desiredAngle = Math.atan2(dy, dx);
        
        // Calculate angle difference to detect rapid oscillations
        let angleDiff = desiredAngle - snake.angle;
        // Normalize to [-π, π] range
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        
        // If angle change is extremely small, maintain current angle to prevent jitter
        const minAngleThreshold = 0.001; // ~0.06 degrees
        if (Math.abs(angleDiff) < minAngleThreshold) {
          desiredAngle = snake.angle;
        }
      }
      
      // Validate the calculated angle
      if (!isFinite(desiredAngle)) {
        desiredAngle = snake.angle; // Fallback to current angle if invalid
      }

      // Update boost state
      snake.boosting = input.boost;

      // Track client tick if provided (mark as processed when we run physics)
      if (typeof input.t === 'number') {
        this.lastProcessedClientTick.set(playerId, input.t);
      }

      // Step the snake
      snake.step(dt, desiredAngle);
    }
  }

  private applyFoodMagnetism(dt: number): void {
    // Velocity-based magnetism with commitment tracking for smooth slither.io-like movement
    const foodToRemove: Array<{ food: Food; snake: ServerSnake }> = [];
    
    // Early exit if no players
    if (this.players.size === 0) return;
    
    // Pre-calculate all snake heads for faster distance calculations
    const snakeHeads: Array<{ snake: ServerSnake; head: Vec2; isBoosting: boolean }> = [];
    for (const [playerId, snake] of this.players) {
      if (!snake.isDead) {
        snakeHeads.push({ snake, head: snake.head, isBoosting: snake.boosting });
      }
    }
    
    if (snakeHeads.length === 0) return;
    
    // Calculate maximum effective range for food updates (furthest any food can be affected)
    const maxEffectiveRange = this.FOOD_CONFIG.magnetismRadius * 3; // Extended range for committed pellets
    
    for (const food of this.food) {
      // Find the closest snake head (optimized: only check snake heads, not all players)
      let closestSnake: ServerSnake | null = null;
      let closestDistance = Infinity;
      
      for (const { snake, head } of snakeHeads) {
        const dx = head.x - food.x;
        const dy = head.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestSnake = snake;
        }
      }
      
      // Skip food that's too far from any player (performance optimization)
      // Only process food within maxEffectiveRange or already committed
      if (!food.committedSnakeId && closestDistance > maxEffectiveRange) {
        // Food is far away and not committed - skip all processing except velocity decay
        food.vx *= 0.95; // Gentle decay
        food.vy *= 0.95;
        continue;
      }
      
      // Check for collision with any snake (head or body) - use pre-computed list
      let ateFood = false;
      for (const { snake } of snakeHeads) {
        if (this.checkFoodCollisionWithSnake(food, snake)) {
          foodToRemove.push({ food, snake });
          ateFood = true;
          break;
        }
      }
      
      // If we ate the food, skip the rest of the magnetism logic
      if (ateFood) continue;
      
      // Determine which snake to attract towards
      let targetSnake: ServerSnake | null = null;
      let targetDistance = closestDistance;
      
      if (food.committedSnakeId && this.players.has(food.committedSnakeId)) {
        // Already committed to a snake - keep following it even if another is closer
        const committedSnake = this.players.get(food.committedSnakeId);
        if (committedSnake && !committedSnake.isDead) {
          const committedDistance = Math.sqrt(
            (committedSnake.head.x - food.x) ** 2 + (committedSnake.head.y - food.y) ** 2
          );
          targetSnake = committedSnake;
          targetDistance = committedDistance;
          
          // Release commitment if snake is too far away (use adaptive radius)
          const adaptiveRadius = committedSnake.boosting 
            ? this.FOOD_CONFIG.magnetismRadius * 1 
            : this.FOOD_CONFIG.magnetismRadius;
          if (committedDistance > adaptiveRadius) {
            food.committedSnakeId = undefined;
            targetSnake = closestSnake;
            targetDistance = closestDistance;
          }
        } else {
          // Committed snake is dead, release commitment
          food.committedSnakeId = undefined;
          targetSnake = closestSnake;
          targetDistance = closestDistance;
        }
      } else {
        // Not committed yet - follow closest snake within range
        targetSnake = closestSnake;
        targetDistance = closestDistance;
      }
      
      // Apply magnetism if within range (and not disabled)
      if (!this.FOOD_CONFIG.disableMagnetism && targetSnake) {
        const head = targetSnake.head;
        const isBoosting = targetSnake.boosting;
        
        // Adaptive range and commitment based on boosting state
        let effectiveMagnetismRadius = isBoosting ? this.FOOD_CONFIG.magnetismRadius * 1.4 : this.FOOD_CONFIG.magnetismRadius;
        
        // Committed pellets get extended range to prevent slingshotting
        if (food.committedSnakeId) {
          effectiveMagnetismRadius *= 2.5; // Extended chase mode for committed pellets
        }
        
        // Only apply acceleration if within adaptive range
        if (targetDistance < effectiveMagnetismRadius) {
          // Calculate direction to snake
        const dx = head.x - food.x;
        const dy = head.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
          // Adaptive commitment distance
          const effectiveCommitmentDistance = isBoosting ? this.FOOD_CONFIG.commitmentDistance * 1.5 : this.FOOD_CONFIG.commitmentDistance;
          
        if (distance > 0 && distance < effectiveMagnetismRadius) {
          // Predict where the head will be when the pellet catches up
          // Calculate head velocity based on snake's angle and speed
          const headVelocity = this.getSnakeVelocity(targetSnake);
          
          // Estimate time to intercept based on pellet's current speed and distance
          const pelletSpeed = Math.sqrt(food.vx * food.vx + food.vy * food.vy);
          const estimatedTimeToIntercept = pelletSpeed > 0 
            ? distance / (pelletSpeed + headVelocity.speed * 0.5) 
            : distance / 100; // Fallback if pellet hasn't started moving
          
          // Predict future head position
          const lookAheadTime = Math.min(estimatedTimeToIntercept, 0.15); // Cap at 150ms
          const futureHeadX = head.x + headVelocity.x * lookAheadTime;
          const futureHeadY = head.y + headVelocity.y * lookAheadTime;
          
          // Aim at the predicted position
          const predDx = futureHeadX - food.x;
          const predDy = futureHeadY - food.y;
          const predDistance = Math.sqrt(predDx * predDx + predDy * predDy);
          
          // Calculate acceleration force based on distance
          const normalizedDistance = predDistance / effectiveMagnetismRadius;
          // Use linear falloff for stronger attraction when closer
          // For extended range (committed pellets), use smoother falloff
          let forceFactor = 1 - normalizedDistance;
          if (forceFactor < 0) {
            // In extended range, use gentler falloff to prevent repulsion
            forceFactor = 0.2 * Math.exp(-(normalizedDistance - 1) * 2);
          }
          const acceleration = this.FOOD_CONFIG.magnetismStrength * forceFactor;
          
          // Higher acceleration when snake is boosting to catch up, but smoother
          const boostMultiplier = isBoosting ? 3.5 : 1.0;
          const finalAcceleration = acceleration * boostMultiplier;
          
          // Normalize direction to predicted position
          const nx = predDx / predDistance;
          const ny = predDy / predDistance;
          
          // Apply acceleration to velocity
          food.vx += nx * finalAcceleration * dt;
          food.vy += ny * finalAcceleration * dt;
          
          // Commit to this snake if within commitment distance
          if (!food.committedSnakeId && predDistance < effectiveCommitmentDistance) {
            food.committedSnakeId = targetSnake.playerId;
          }
        }
        }
      }
      
      // Apply friction/damping - slightly higher friction for boosting to smooth movement
      const isTargetBoosting = targetSnake?.boosting;
      const friction = food.committedSnakeId 
        ? (isTargetBoosting ? 0.94 : 0.97)  // More friction when boosting to smooth it out
        : 0.92;
      food.vx *= friction;
      food.vy *= friction;
      
      // Cap maximum velocity - reduced for boosting to prevent jarring movement
      const isCommitted = !!food.committedSnakeId;
      
      // Check if pellet is in extended range (committed and chasing at far distance)
      const maxNormalRange = isTargetBoosting ? this.FOOD_CONFIG.magnetismRadius * 1.4 : this.FOOD_CONFIG.magnetismRadius;
      const isExtendedRange = isCommitted && targetDistance > maxNormalRange;
      
      // Lower max velocity when boosting to prevent jarring snaps
      const baseMaxVelocity = isTargetBoosting ? 400 : 250; // Reduced from 550 to 400
      const committedMultiplier = isCommitted ? (isExtendedRange ? 1.2 : 1.4) : 1.0; // Reduced from 1.6 to 1.4
      const maxVelocity = baseMaxVelocity * committedMultiplier;
      const currentSpeed = Math.sqrt(food.vx * food.vx + food.vy * food.vy);
      if (currentSpeed > maxVelocity) {
        const scale = maxVelocity / currentSpeed;
        food.vx *= scale;
        food.vy *= scale;
      }
      
      // Update position based on velocity
      food.x += food.vx * dt;
      food.y += food.vy * dt;
      
      // Constrain food to world bounds to prevent respawning
      const maxRadius = this.WORLD_SIZE * this.FOOD_CONFIG.arenaSize;
      const distanceFromCenter = Math.sqrt(food.x * food.x + food.y * food.y);
      if (distanceFromCenter > maxRadius) {
        // Clamp to world bounds instead of respawning
        const angle = Math.atan2(food.y, food.x);
        food.x = Math.cos(angle) * maxRadius;
        food.y = Math.sin(angle) * maxRadius;
        // Stop food from continuing to move outward
        food.vx = 0;
        food.vy = 0;
        food.committedSnakeId = undefined; // Release commitment if stuck at border
      }
      
      // Check for collision with any snake after movement - use pre-computed list
      ateFood = false;
      for (const { snake } of snakeHeads) {
        if (this.checkFoodCollisionWithSnake(food, snake)) {
          foodToRemove.push({ food, snake });
          ateFood = true;
          break;
        }
      }
      
      // Skip to next food if this one was eaten
      if (ateFood) continue;
    }
    
    // Remove eaten food AFTER iteration to prevent array modification during loop
    for (const { food, snake } of foodToRemove) {
      this.eatFood(food, snake);
    }
  }
  
  private eatFood(food: Food, snake: ServerSnake): void {
    // Calculate points based on food size
    const points = Math.max(1, Math.floor(food.radius / this.FOOD_CONFIG.baseRadius));
    
    // Give points to snake
    snake.addFoodPoints(points);
    snake.score += points;
    
    // Remove food from array
    const foodIndex = this.food.indexOf(food);
    if (foodIndex > -1) {
      this.food.splice(foodIndex, 1);
      const distance = Math.sqrt((snake.head.x - food.x) ** 2 + (snake.head.y - food.y) ** 2);
      console.log(`[GameWorld] Player ${snake.name} ate food ${food.id} (+${points} points) - distance: ${distance.toFixed(1)}`);
    } else {
      console.warn(`[GameWorld] Food ${food.id} not found in array when trying to eat!`);
    }
  }
  
  private validateFoodPositions(): void {
    // Only check for invalid positions (NaN/Infinity) - food clamping happens in magnetism
    for (let i = this.food.length - 1; i >= 0; i--) {
      const food = this.food[i];
      
      // Check for NaN or invalid positions only
      if (!isFinite(food.x) || !isFinite(food.y)) {
        console.log(`[GameWorld] Food ${food.id} had invalid position (${food.x}, ${food.y}), respawning`);
        this.respawnFood(food);
      }
    }
  }
  
  private respawnFood(food: Food): void {
    const maxRadius = this.WORLD_SIZE * this.FOOD_CONFIG.arenaSize;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * maxRadius;
    
    food.x = Math.cos(angle) * distance;
    food.y = Math.sin(angle) * distance;
    food.vx = 0;
    food.vy = 0;
    food.committedSnakeId = undefined;
  }


  private checkCollisions(): void {
    for (const [playerId, snake] of this.players) {
      if (snake.isDead) continue;

      const head = snake.head;
      
      // Debug: Check for invalid head positions
      if (!isFinite(head.x) || !isFinite(head.y)) {
        console.log(`[GameWorld] ERROR: Player ${snake.name} has invalid head position: (${head.x}, ${head.y})`);
        const points = snake.getPoints();
        console.log(`[GameWorld] Points array length: ${points?.length || 'undefined'}`);
        console.log(`[GameWorld] Points[0]: ${points?.[0] ? JSON.stringify(points[0]) : 'undefined'}`);
        snake.triggerDeath();
        continue;
      }
      
      const distanceFromCenter = Math.sqrt(head.x * head.x + head.y * head.y);
      const collisionThreshold = distanceFromCenter + snake.r;
      
      // Debug: Log when snake is close to border
      if (distanceFromCenter > this.WORLD_SIZE * 0.9) {
        console.log(`[GameWorld] Player ${snake.name} near border: distance=${distanceFromCenter.toFixed(1)}, radius=${snake.r.toFixed(1)}, threshold=${collisionThreshold.toFixed(1)}, world=${this.WORLD_SIZE}`);
        console.log(`[GameWorld] Head position: (${head.x.toFixed(1)}, ${head.y.toFixed(1)})`);
      }
      
      // Border collision detection (instant - no confirmation needed, very predictable)
      if (collisionThreshold >= this.WORLD_SIZE) {
        console.log(`[GameWorld] Player ${snake.name} hit border! distance=${distanceFromCenter.toFixed(1)}, radius=${snake.r.toFixed(1)}, threshold=${collisionThreshold.toFixed(1)}, world=${this.WORLD_SIZE}`);
        // Add death dots as food before triggering death
        this.addDeathDotsAsFood(snake.getPoints(), snake.r, snake.color);
        snake.triggerDeath();
        continue; // Skip snake-to-snake checks if hitting border
      }

      // Check snake-to-snake collisions
      for (const [otherPlayerId, otherSnake] of this.players) {
        if (otherPlayerId === playerId || otherSnake.isDead) continue;

        const otherHead = otherSnake.head;
        const distance = Math.sqrt(
          (head.x - otherHead.x) ** 2 + (head.y - otherHead.y) ** 2
        );

        // Check head-to-head collision (with 1-tick confirmation)
        const headCollisionKey = `head_${playerId}_${otherPlayerId}`;
        const headCollisionKeyReverse = `head_${otherPlayerId}_${playerId}`;
        if (distance < snake.r + otherSnake.r) {
          // Determine which snake is "hitting" the other based on movement direction
          const hittingSnake = this.determineCollisionDirection(snake, otherSnake);
          const hittingPlayerId = hittingSnake.playerId;
          const targetKey = hittingPlayerId === playerId ? headCollisionKey : headCollisionKeyReverse;
          
          // Track pending collision (1-tick confirmation window)
          const currentTicks = this.pendingCollisions.get(targetKey) || 0;
          if (currentTicks === 0) {
            // First tick of collision - initialize to 1
            this.pendingCollisions.set(targetKey, 1);
          } else if (currentTicks === 1) {
            // Second consecutive tick - confirm collision
            console.log(`[GameWorld] ${hittingSnake.name} confirmed collision with ${hittingSnake === snake ? otherSnake.name : snake.name}'s head (1-tick confirmation)`);
            this.addDeathDotsAsFood(hittingSnake.getPoints(), hittingSnake.r, hittingSnake.color);
            hittingSnake.triggerDeath();
            this.pendingCollisions.delete(targetKey);
          }
          continue; // Skip body collision check for this pair
        } else {
          // No head collision this tick - clear pending head collisions for this pair
          this.pendingCollisions.delete(headCollisionKey);
          this.pendingCollisions.delete(headCollisionKeyReverse);
        }

        // Check head-to-body collision (snake hitting other snake's body)
        const otherPoints = otherSnake.getPoints();
        let foundBodyCollision = false;
        for (let i = 1; i < otherPoints.length; i++) {
          const segment = otherPoints[i];
          const segmentDistance = Math.sqrt(
            (head.x - segment.x) ** 2 + (head.y - segment.y) ** 2
          );

          // Head-to-body collision scales proportionally with both snakes' radii (with 1-tick confirmation)
          if (segmentDistance < snake.r + otherSnake.r * 0.8) { // Proportional to both snakes' sizes
            foundBodyCollision = true;
            // Use a unique key per collision pair to avoid interference
            const bodyCollisionKey = `body_${playerId}_${otherPlayerId}`;
            const currentTicks = this.pendingCollisions.get(bodyCollisionKey) || 0;
            if (currentTicks === 0) {
              // First tick of collision - initialize to 1
              this.pendingCollisions.set(bodyCollisionKey, 1);
              break; // Don't check other segments this tick
            } else if (currentTicks === 1) {
              // Second consecutive tick - confirm collision
              console.log(`[GameWorld] Player ${snake.name} confirmed collision with ${otherSnake.name}'s body (1-tick confirmation)`);
              this.addDeathDotsAsFood(snake.getPoints(), snake.r, snake.color);
              snake.triggerDeath();
              this.pendingCollisions.delete(bodyCollisionKey);
              break;
            }
          }
        }
        
        // Only clear pending collision if we checked all segments and found no collision
        if (!foundBodyCollision) {
          // Clear body collision for this specific pair
          const bodyCollisionKey = `body_${playerId}_${otherPlayerId}`;
          this.pendingCollisions.delete(bodyCollisionKey);
        }
      }

      // Food collisions are now handled in applyFoodMagnetism() for better performance
    }
  }



  private respawnDeadPlayers(): void {
    for (const [playerId, snake] of this.players) {
      if (snake.isDead && snake.deathAnimationProgress >= 1.0) {
        // Respawn player
        const spawnPos = this.getRandomSpawnPosition();
        const spawnAngle = Math.random() * Math.PI * 2;
        
        snake.reset(spawnPos, spawnAngle);
        
        console.log(`[GameWorld] Player ${snake.name} respawned at (${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}) - distance from center: ${Math.sqrt(spawnPos.x * spawnPos.x + spawnPos.y * spawnPos.y).toFixed(1)}`);
      }
    }
  }

  update(): void {
    const currentTime = Date.now();
    const dt = (currentTime - this.lastTickTime) / 1000;
    
    if (dt < this.tickInterval / 1000) {
      return; // Not time for next tick yet
    }

    this.lastTickTime = currentTime;
    this.tick++;

    // Update game systems
    this.maintainFoodCount();
    this.updateSnakes(dt);
    this.applyFoodMagnetism(dt);
    this.validateFoodPositions(); // Only checks for NaN/Infinity - no more respawning
    this.checkCollisions();
    this.respawnDeadPlayers();
  }

  getState(): GameState {
    const players = Array.from(this.players.values()).map(snake => snake.getState());
    
    // Build acks map: playerId -> lastProcessedClientTick
    const acks: Record<string, number> = {};
    for (const [playerId, lastTick] of this.lastProcessedClientTick.entries()) {
      acks[playerId] = lastTick;
    }
    
    return {
      tick: this.tick,
      serverTimeMs: Date.now(), // Add server timestamp
      players,
      food: [...this.food],
      acks // Add acknowledgments
    };
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getPlayer(playerId: string): ServerSnake | undefined {
    return this.players.get(playerId);
  }
}
