import * as PIXI from 'pixi.js';

export interface MoneyData {
  amount: number;
  lastUpdate: number;
}

export class MoneySystem {
  private money: number = 0;
  private lastUpdate: number = 0;
  
  // Money display settings
  private readonly MONEY_DISPLAY_DURATION = 2000; // 2 seconds
  private readonly MONEY_ANIMATION_SPEED = 0.1;
  
  constructor(initialMoney: number = 0) {
    this.money = initialMoney;
    this.lastUpdate = Date.now();
  }
  
  // Add money to the system
  addMoney(amount: number): void {
    this.money += amount;
    this.lastUpdate = Date.now();
  }
  
  // Remove money from the system
  spendMoney(amount: number): boolean {
    if (this.money >= amount) {
      this.money -= amount;
      this.lastUpdate = Date.now();
      return true;
    }
    return false;
  }
  
  // Get current money amount
  getMoney(): number {
    return this.money;
  }
  
  // Set money amount (for server sync)
  setMoney(amount: number): void {
    this.money = amount;
    this.lastUpdate = Date.now();
  }
  
  // Check if money display should be shown (always true for constant display)
  shouldShowMoneyDisplay(): boolean {
    return true; // Always show the money display
  }
  
  // Get money data for serialization
  getMoneyData(): MoneyData {
    return {
      amount: this.money,
      lastUpdate: this.lastUpdate
    };
  }
  
  // Update from money data (for deserialization)
  updateFromData(data: MoneyData): void {
    this.money = data.amount;
    this.lastUpdate = data.lastUpdate;
  }
}
