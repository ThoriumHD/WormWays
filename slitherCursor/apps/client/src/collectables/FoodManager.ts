import { Food, FoodData } from './Food';
import * as PIXI from 'pixi.js';

export class FoodManager {
  private foods: Map<string, Food> = new Map();
  private foodContainer: PIXI.Container;
  private maxFoods: number = 30;
  private spawnRadius: number = 2000; // World radius for food spawning
  
  constructor(container: PIXI.Container) {
    this.foodContainer = container;
  }
  
  // Spawn food at specific coordinates
  spawnFood(x: number, y: number): Food {
    // Remove oldest food if we're at max capacity
    if (this.foods.size >= this.maxFoods) {
      this.removeOldestFood();
    }
    
    const food = new Food(x, y);
    this.foods.set(food.id, food);
    this.foodContainer.addChild(food.container);
    
    return food;
  }
  
  // Spawn food at random location
  spawnRandomFood(): Food {
    const x = (Math.random() - 0.5) * this.spawnRadius;
    const y = (Math.random() - 0.5) * this.spawnRadius;
    return this.spawnFood(x, y);
  }
  
  // Spawn multiple foods
  spawnFoods(count: number): Food[] {
    const spawnedFoods: Food[] = [];
    for (let i = 0; i < count; i++) {
      spawnedFoods.push(this.spawnRandomFood());
    }
    return spawnedFoods;
  }
  
  // Update all foods
  update(dt: number, snakeHead?: { x: number; y: number }) {
    for (const food of this.foods.values()) {
      food.update(dt, snakeHead);
    }
  }
  
  // Check for food collections
  checkCollections(snakeX: number, snakeY: number, snakeRadius: number = 10): number {
    let collectedCount = 0;
    
    for (const food of this.foods.values()) {
      if (food.isCollectedBy(snakeX, snakeY, snakeRadius)) {
        if (food.collect()) {
          collectedCount++;
          this.removeFood(food.id);
        }
      }
    }
    
    return collectedCount;
  }
  
  // Remove a specific food
  removeFood(foodId: string): boolean {
    const food = this.foods.get(foodId);
    if (food) {
      food.destroy();
      this.foods.delete(foodId);
      return true;
    }
    return false;
  }
  
  // Remove the oldest food
  private removeOldestFood(): void {
    let oldestFood: Food | null = null;
    let oldestTime = Date.now();
    
    for (const food of this.foods.values()) {
      if (food.spawnTime < oldestTime) {
        oldestTime = food.spawnTime;
        oldestFood = food;
      }
    }
    
    if (oldestFood) {
      this.removeFood(oldestFood.id);
    }
  }
  
  // Clear all foods
  clearAllFoods(): void {
    for (const food of this.foods.values()) {
      food.destroy();
    }
    this.foods.clear();
  }
  
  // Get all active foods
  getActiveFoods(): Food[] {
    return Array.from(this.foods.values()).filter(food => !food.collected);
  }
  
  // Get food count
  getFoodCount(): number {
    return this.foods.size;
  }
  
  // Set maximum number of foods
  setMaxFoods(max: number): void {
    this.maxFoods = max;
    
    // Remove excess foods if needed
    while (this.foods.size > this.maxFoods) {
      this.removeOldestFood();
    }
  }
  
  // Get food data for serialization
  getAllFoodData(): FoodData[] {
    return Array.from(this.foods.values()).map(food => food.getData());
  }
  
  // Load foods from data (for server sync)
  loadFoodsFromData(foodsData: FoodData[]): void {
    this.clearAllFoods();
    
    for (const data of foodsData) {
      const food = new Food(data.x, data.y);
      food.id = data.id;
      food.collected = data.collected;
      food.spawnTime = data.spawnTime;
      
      this.foods.set(food.id, food);
      this.foodContainer.addChild(food.container);
    }
  }
  
  // Update food positions for camera transform
  updateFoodPositions(scale: number, offsetX: number, offsetY: number) {
    for (const food of this.foods.values()) {
      if (!food.collected) {
        food.container.scale.set(scale);
        food.container.position.set(
          food.x * scale + offsetX,
          food.y * scale + offsetY
        );
      }
    }
  }
}
