# Money System

This folder contains the money system implementation for the snake game.

## Files

- `MoneySystem.ts` - Core money management logic
- `MoneyDisplay.ts` - Visual display component for money counter
- `index.ts` - Exports for the money system

## Features

- **Money Management**: Add, spend, and track money amounts
- **Visual Display**: Animated money counter that appears above snake heads
- **Auto-hide**: Money display automatically hides after 2 seconds of inactivity
- **Animations**: Smooth fade-in/fade-out with bounce effects
- **Styling**: Professional-looking display with background and text shadows

## Usage

### Basic Usage

```typescript
import { MoneySystem, MoneyDisplay } from './money';

// Create money system
const moneySystem = new MoneySystem(100); // Start with $100

// Add money
moneySystem.addMoney(50);

// Spend money
const success = moneySystem.spendMoney(25);

// Get current amount
const currentMoney = moneySystem.getMoney();
```

### With Snake Renderer

```typescript
// The SnakeRenderer automatically includes money display
const snakeRenderer = new SnakeRenderer(app, 100); // Start with $100

// Add money (triggers display animation)
snakeRenderer.addMoney(50);

// Force show money display
snakeRenderer.showMoneyDisplay();
```

### Testing Controls

In the game:
- Press `M` to add $50 to your money
- Press `N` to force show the money display

## Integration

The money system is integrated into:
- `SnakeRenderer` - Shows money above your own snake's head
- `WorldRenderer` - Shows money above other players' snake heads
- `Snake` class - Provides money management methods

## Customization

You can customize the money display by modifying the constants in `MoneyDisplay.ts`:
- `FONT_SIZE` - Size of the money text
- `BACKGROUND_PADDING` - Padding around the text
- `BACKGROUND_RADIUS` - Corner radius of the background
- `MONEY_DISPLAY_DURATION` - How long the display stays visible
- `BOUNCE_HEIGHT` - Height of the bounce animation
