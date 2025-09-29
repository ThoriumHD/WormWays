# Collectables System

This folder contains the collectable systems for the snake game, including coins and food.

## Files

### Coins
- `Coin.ts` - Individual coin implementation with animations
- `CoinManager.ts` - Manages all coins in the game world

### Food
- `Food.ts` - Individual food implementation with animations
- `FoodManager.ts` - Manages all food in the game world

- `index.ts` - Exports for all collectable systems

## Features

### Coins 💰
- **Visual Appeal**: Golden coins with glow effects and animations
- **Smooth Animations**: Rotating, bobbing, and pulsing effects
- **Collection System**: Automatic detection when snake touches coins
- **Money Rewards**: Each coin gives $0.10 when collected
- **Magnetization**: Strong magnetic pull when snake head is within 120px
- **Performance Optimized**: Efficient rendering and cleanup
- **Debug Controls**: Easy testing with keyboard shortcuts

### Food 🍎
- **Visual Appeal**: Red apple-like food with green glow effects
- **Smooth Animations**: Rotating, bobbing, and pulsing effects
- **Collection System**: Automatic detection when snake touches food
- **Length Increase**: Each food increases snake length by 1
- **Magnetization**: Very strong magnetic pull when snake head is within 150px
- **Performance Optimized**: Efficient rendering and cleanup
- **Debug Controls**: Easy testing with keyboard shortcuts

## Usage

### Basic Usage

```typescript
import { CoinManager, FoodManager } from './collectables';

// Create managers
const coinManager = new CoinManager(app.stage);
const foodManager = new FoodManager(app.stage);

// Spawn collectables
const coin = coinManager.spawnRandomCoin(0.10);
const food = foodManager.spawnRandomFood();

// Check for collections (in game loop)
const collectedValue = coinManager.checkCollections(snakeX, snakeY, snakeRadius);
const collectedFood = foodManager.checkCollections(snakeX, snakeY, snakeRadius);

if (collectedValue > 0) {
  player.addMoney(collectedValue);
}

if (collectedFood > 0) {
  snake.length += collectedFood;
}
```

### Debug Controls

In the game:
- **Coins**: 
  - Press `C` to spawn a single coin at a random location
  - Press `V` to spawn 5 coins at random locations
- **Food**:
  - Press `F` to spawn a single food at a random location
  - Press `G` to spawn 3 foods at random locations

## Collectable Properties

### Coins
- **Value**: $0.10 per coin (configurable)
- **Size**: 16px diameter with 8px glow radius
- **Animation**: 
  - Rotation: 2 radians/second
  - Bobbing: 3 bobs/second with 8px height
  - Glow pulse: 4 pulses/second
- **Collection**: 18px radius (10px snake + 8px coin)
- **Magnetization**: 
  - Range: 120px
  - Strength: 0.9 (strong)
  - Speed: 400px/second

### Food
- **Value**: +1 snake length per food
- **Size**: 12px diameter with 6px glow radius
- **Animation**: 
  - Rotation: 1 radian/second (slower than coins)
  - Bobbing: 2 bobs/second with 6px height
  - Glow pulse: 3 pulses/second
- **Collection**: 16px radius (10px snake + 6px food)
- **Magnetization**: 
  - Range: 150px (larger than coins)
  - Strength: 0.95 (very strong)
  - Speed: 500px/second (faster than coins)

## Integration

The collectable systems are integrated into:
- `main.ts` - Game loop with collection detection
- Camera system - Collectables follow camera transforms
- Money system - Collected coins add money to player
- Snake system - Collected food increases snake length

## Performance

- **Coins**: Maximum 50 coins in world at once
- **Food**: Maximum 30 foods in world at once
- Automatic cleanup of old collectables when limit reached
- Efficient collision detection
- Optimized rendering with PIXI.js

## Customization

You can customize collectables by modifying constants in their respective files:
- `rotationSpeed` - How fast collectables rotate
- `bobSpeed` - How fast collectables bob up and down
- `bobHeight` - How high collectables bob
- `glowPulseSpeed` - How fast the glow pulses
- `maxCoins`/`maxFoods` - Maximum number of collectables in world