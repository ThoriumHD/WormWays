import { Coin, CoinData } from './Coin';
import * as PIXI from 'pixi.js';

export class CoinManager {
  private coins: Map<string, Coin> = new Map();
  private coinContainer: PIXI.Container;
  private maxCoins: number = 50;
  private spawnRadius: number = 2000; // World radius for coin spawning
  
  constructor(container: PIXI.Container) {
    this.coinContainer = container;
  }
  
  // Spawn a coin at specific coordinates
  spawnCoin(x: number, y: number, value: number = 0.10): Coin {
    // Remove oldest coin if we're at max capacity
    if (this.coins.size >= this.maxCoins) {
      this.removeOldestCoin();
    }
    
    const coin = new Coin(x, y, value);
    this.coins.set(coin.id, coin);
    this.coinContainer.addChild(coin.container);
    
    return coin;
  }
  
  // Spawn a coin at random location
  spawnRandomCoin(value: number = 0.10): Coin {
    const x = (Math.random() - 0.5) * this.spawnRadius;
    const y = (Math.random() - 0.5) * this.spawnRadius;
    return this.spawnCoin(x, y, value);
  }
  
  // Spawn multiple coins
  spawnCoins(count: number, value: number = 0.10): Coin[] {
    const spawnedCoins: Coin[] = [];
    for (let i = 0; i < count; i++) {
      spawnedCoins.push(this.spawnRandomCoin(value));
    }
    return spawnedCoins;
  }
  
  // Update all coins
  update(dt: number, snakeHead?: { x: number; y: number }) {
    for (const coin of this.coins.values()) {
      coin.update(dt, snakeHead);
    }
  }
  
  // Update coin positions for camera transform
  updateCoinPositions(scale: number, offsetX: number, offsetY: number) {
    for (const coin of this.coins.values()) {
      if (!coin.collected) {
        coin.container.scale.set(scale);
        coin.container.position.set(
          coin.x * scale + offsetX,
          coin.y * scale + offsetY
        );
      }
    }
  }
  
  // Check for coin collections
  checkCollections(snakeX: number, snakeY: number, snakeRadius: number = 10): number {
    let totalValue = 0;
    
    for (const coin of this.coins.values()) {
      if (coin.isCollectedBy(snakeX, snakeY, snakeRadius)) {
        totalValue += coin.collect();
        this.removeCoin(coin.id);
      }
    }
    
    return totalValue;
  }
  
  // Remove a specific coin
  removeCoin(coinId: string): boolean {
    const coin = this.coins.get(coinId);
    if (coin) {
      coin.destroy();
      this.coins.delete(coinId);
      return true;
    }
    return false;
  }
  
  // Remove the oldest coin
  private removeOldestCoin(): void {
    let oldestCoin: Coin | null = null;
    let oldestTime = Date.now();
    
    for (const coin of this.coins.values()) {
      if (coin.spawnTime < oldestTime) {
        oldestTime = coin.spawnTime;
        oldestCoin = coin;
      }
    }
    
    if (oldestCoin) {
      this.removeCoin(oldestCoin.id);
    }
  }
  
  // Clear all coins
  clearAllCoins(): void {
    for (const coin of this.coins.values()) {
      coin.destroy();
    }
    this.coins.clear();
  }
  
  // Get all active coins
  getActiveCoins(): Coin[] {
    return Array.from(this.coins.values()).filter(coin => !coin.collected);
  }
  
  // Get coin count
  getCoinCount(): number {
    return this.coins.size;
  }
  
  // Set maximum number of coins
  setMaxCoins(max: number): void {
    this.maxCoins = max;
    
    // Remove excess coins if needed
    while (this.coins.size > this.maxCoins) {
      this.removeOldestCoin();
    }
  }
  
  // Get coin data for serialization
  getAllCoinData(): CoinData[] {
    return Array.from(this.coins.values()).map(coin => coin.getData());
  }
  
  // Load coins from data (for server sync)
  loadCoinsFromData(coinsData: CoinData[]): void {
    this.clearAllCoins();
    
    for (const data of coinsData) {
      const coin = new Coin(data.x, data.y, data.value);
      coin.id = data.id;
      coin.collected = data.collected;
      coin.spawnTime = data.spawnTime;
      
      this.coins.set(coin.id, coin);
      this.coinContainer.addChild(coin.container);
    }
  }
}
