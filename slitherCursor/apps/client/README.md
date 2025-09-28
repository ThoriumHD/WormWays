# WormWays - Snake Game Client

A skill-based snake game with money collection, food growth, and magnetic collectables.

## 🎮 Game Features

- **Money System**: Collect coins to earn money ($0.10 per coin)
- **Food Growth**: Eat food to increase snake length by 1
- **Magnetic Collectables**: Items are drawn to you when close
  - Coins: 120px range, strong magnetism
  - Food: 150px range, very strong magnetism
- **Real-time Multiplayer**: Play with other players online
- **Beautiful UI**: Modern, responsive design

## 🚀 Getting Started

### Entry Points

1. **Home Page** (`home.html`) - Main entry point with game overview
2. **Landing Page** (`landing.html`) - Game lobby with leaderboard and stats
3. **Game** (`index.html`) - Direct game access

### Navigation Flow

```
home.html → landing.html → index.html (game)
     ↓           ↓              ↓
  Overview → Lobby/Stats → Actual Game
```

## 🎯 Controls

### Game Controls
- **Arrow Keys** or **WASD**: Move snake
- **Space**: Boost (if implemented)

### Debug Controls
- **M**: Add $50 to money
- **N**: Show money display
- **C**: Spawn random coin
- **V**: Spawn 5 coins
- **F**: Spawn random food
- **G**: Spawn 3 food items

## 🏗️ Project Structure

```
src/
├── main.ts                 # Main game entry point
├── snake/                  # Snake game logic
│   ├── index.ts           # Snake class
│   ├── SnakeBody.ts       # Physics and movement
│   ├── SnakeMaterial.ts   # Visual materials
│   └── SnakeRenderer.ts   # Rendering logic
├── money/                  # Money system (deleted)
├── collectables/          # Collectable system (deleted)
├── render/                # World rendering
├── state/                 # Game state management
├── view/                  # Camera and viewport
└── net/                   # Network client
```

## 🎨 UI Components

### Landing Page Features
- **Leaderboard**: Live player rankings
- **Social**: Friend system (placeholder)
- **Game Interface**: Player info, controls, stats
- **Balance**: Money display and management
- **Customize**: Snake appearance options

### Responsive Design
- Desktop: 3-column layout (sidebar-game-sidebar)
- Tablet: Stacked layout with horizontal sidebars
- Mobile: Single column layout

## 🔧 Development

### Running the Game
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### File Structure
- `home.html` - Entry point with game overview
- `landing.html` - Game lobby interface
- `index.html` - Direct game access
- `src/main.ts` - Game logic and initialization

## 🎮 Game Mechanics

### Money System
- Start with $1.00
- Collect coins for $0.10 each
- Money display follows snake head
- Persistent across game sessions

### Collectables
- **Coins**: Golden, rotating, bobbing animation
- **Food**: Red apple-like, slower animation
- **Magnetism**: Range-based attraction to snake head
- **Collection**: Automatic when touching snake head

### Snake Growth
- Start with default length
- Grow by 1 segment per food collected
- Visual feedback with body segments
- Smooth movement and rendering

## 🌟 Features

- **Real-time Rendering**: Smooth 60fps gameplay
- **Responsive Design**: Works on all screen sizes
- **Modern UI**: Glass-morphism design with gradients
- **Interactive Elements**: Hover effects and animations
- **Debug Tools**: Easy testing and development
- **Performance Optimized**: Efficient rendering and cleanup

## 🚀 Future Enhancements

- Multiplayer lobbies
- Player authentication
- Real money integration
- Snake customization
- Power-ups and special items
- Tournament system
- Social features

---

**Note**: The money and collectable systems were previously implemented but have been removed from the current codebase. The landing page serves as a placeholder for these features.
