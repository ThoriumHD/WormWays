# Slither.io Clone - Complete Project Overview

## Project Description

A multiplayer web-based Slither.io clone built as a TypeScript monorepo with client-server architecture. The game features smooth snake movement, food mechanics, collision detection, boosting, growth, and death animations. The server runs at 30 FPS with authoritative game logic, while clients use prediction and interpolation for smooth 60+ FPS rendering.

---

## Architecture Overview

### **Tech Stack**
- **Client**: HTML5 Canvas 2D, TypeScript, Vite
- **Server**: Node.js, TypeScript, WebSocket (ws library)
- **Build System**: pnpm workspaces (monorepo)
- **Communication**: WebSocket (real-time bidirectional)

### **Project Structure**
```
slitherCursor/
├── apps/
│   ├── client/                      # Client-side game (Vite + Canvas)
│   │   ├── src/
│   │   │   ├── main.ts              # Game loop (60+ FPS), input handling, prediction
│   │   │   │
│   │   │   ├── snake/               # Snake entity and physics (REFACTORED)
│   │   │   │   ├── SnakeBody.ts     # Core orchestrator (716 lines) - state management
│   │   │   │   ├── SnakeRenderer.ts # Visual rendering (598 lines) - segments, eyes, effects
│   │   │   │   ├── HistoryTrail.ts  # Arc-length path sampling (215 lines) [EXTRACTED]
│   │   │   │   ├── SnakeMovement.ts # Movement physics (109 lines) [EXTRACTED]
│   │   │   │   ├── SnakeReconciliation.ts # Server sync (100 lines) [EXTRACTED]
│   │   │   │   ├── SnakeAnimations.ts # Boost & death effects (120 lines) [EXTRACTED]
│   │   │   │   ├── SnakeBoostSystem.ts # Boost mechanics (83 lines) [EXTRACTED]
│   │   │   │   └── SnakeGrowth.ts   # Growth system (122 lines) [EXTRACTED]
│   │   │   │
│   │   │   ├── render/              # World rendering
│   │   │   │   └── WorldRenderer.ts # Food & background rendering (577 lines)
│   │   │   │
│   │   │   ├── view/                # Camera & UI
│   │   │   │   ├── Camera.ts        # Smooth following & zoom (53 lines)
│   │   │   │   ├── Background.ts    # Hexagonal tile background
│   │   │   │   └── GameOverScreen.ts # Death & score screen
│   │   │   │
│   │   │   ├── net/                 # Networking & reconciliation
│   │   │   │   ├── Reconciler.ts    # Input history & replay tracking
│   │   │   │   ├── SnapshotBuffer.ts # Server state interpolation buffer
│   │   │   │   ├── TimeSync.ts      # RTT & time synchronization
│   │   │   │   └── net.ts           # WebSocket connection (237 lines)
│   │   │   │
│   │   │   ├── food/                # Food entity management
│   │   │   │
│   │   │   └── state/               # Shared utilities
│   │   │       └── Physics.ts       # Physics constants & helpers
│   │   │
│   │   ├── index.html               # Main HTML entry (809 lines) - Canvas, UI, game container
│   │   ├── dist/                    # Built client files (Vite output)
│   │   ├── package.json             # Client dependencies
│   │   ├── vite.config.ts           # Vite bundler configuration
│   │   └── tsconfig.json            # TypeScript configuration
│   │
│   └── game-server/                 # Authoritative game server (Node.js + WebSocket)
│       ├── src/
│       │   ├── index.ts             # Server entry point (26 lines)
│       │   ├── GameServer.ts        # WebSocket server (279 lines) - connection & tick broadcasting
│       │   ├── GameWorld.ts         # World state (825 lines) - players, food, collisions
│       │   └── ServerSnake.ts       # Server-side snake (678 lines) - authoritative physics
│       │
│       ├── dist/                    # Compiled server files (tsc output)
│       ├── package.json             # Server dependencies
│       └── tsconfig.json            # TypeScript configuration
│
├── packages/                        # Shared code workspace
│   └── common/                      # Shared types & constants
│       ├── src/
│       │   ├── net.ts               # Message types, serialization
│       │   └── index.ts             # Exported types
│       ├── package.json             # Shared dependencies
│       └── tsconfig.json            # TypeScript configuration
│
├── READ_ME/                         # Documentation
│   ├── README.md                    # Project intro & quick start
│   ├── PROJECT_OVERVIEW.md          # Complete architecture guide (this file)
│   ├── SNAKEBODY_REFACTORED_ARCHITECTURE.md # Detailed module breakdown
│   ├── NETWORKING_FILES_SUMMARY.md  # Network protocol documentation
│   └── REFACTORING_COMPLETE.md      # Historical refactoring notes
│
├── package.json                     # Root workspace config (pnpm)
├── pnpm-workspace.yaml              # Workspace declaration
└── .gitignore                       # Git ignore rules
```

### **File Count Summary**
- **Client Entry**: 1 file (809 lines) - index.html main container
- **Client Snake**: 8 files (744 + 598 + 215 + 109 + 100 + 120 + 83 + 122 = 2,091 lines)
- **Client World**: 3 files (577 + 53 + other UI)
- **Client Network**: 4 files (237 + reconciliation + sync + buffer)
- **Client Config**: 3 files (vite.config.ts, tsconfig.json, package.json)
- **Server Core**: 4 files (825 + 678 + 279 + 26 = 1,808 lines)
- **Server Config**: 2 files (tsconfig.json, package.json)
- **Shared Types**: 2 files (net.ts + index.ts)
- **Documentation**: 4 files in READ_ME/
- **Total Lines**: ~6,500+ lines (809 HTML + ~5,700 TypeScript + docs) across 25+ files

---

## Core Game Systems

### **1. Snake Movement & Physics**

#### **Movement Constants** (`SNAKE` object)
- **Base Speed**: 250 px/sec (normal), 625 px/sec (boost)
- **Turn Rate**: 4.5 rad/sec (reduces with length)
- **Radius**: 21px base (grows with segments)
- **Segment Spacing**: 13.4px between segments (base)
- **Overlap**: 0.4 (40% overlap for continuous tube appearance)

#### **Movement Implementation**
- **Path Following System**: Segments follow a recorded history trail of the head
- **History Buffer**: Up to 2048 points recorded for path following
- **1:1 Following**: Each segment follows the previous one with exact spacing
- **No Coiling**: Segments move at constant rate, creating perfect circles when looping
- **Angle Normalization**: Angles wrapped to [0, 2π) with shortest-path calculations
- **Dead Zone**: 0.001 radians (~0.06°) minimum angle change threshold to prevent jitter
- **Maximum Turn**: ±90° (π/2) limit prevents backwards movement

#### **Length-Based Modifications**
- **Growth Per Segment**: 0.0025% radius increase per segment
- **Turn Rate Reduction**: 30% reduction at maximum length
- **Camera Zoom**: Scales inversely with snake growth (70% compensation factor)

### **2. Client-Side Prediction & Interpolation**

#### **Local Player (Client Prediction)**
- **Immediate Response**: Client runs `snakeBody.step()` every frame (~60 FPS)
- **Server Correction**: Blends local prediction with server state when desync > 30px
- **Angle Synchronization**: Smoothly blends client angle toward server angle (10% blend)
- **Major Desync Handling**: Snaps to server position if distance > 200px or death

#### **Other Players (Interpolation)**
- **Continuous Blending**: 15% blend factor per frame for smooth interpolation
- **Point Count Matching**: Ensures segment counts match before interpolation
- **Major Desync Handling**: Snaps to server state if distance > 200px or count mismatch

#### **Network State Updates**
- **Server Tick Rate**: 30 FPS (updates sent every ~33ms)
- **Client Render Rate**: 60+ FPS (continuous frame-by-frame interpolation)
- **State Updates**: Received in `net.onState()` callback, processed in `main.ts`

### **3. Boosting System**

#### **Boost Mechanics**
- **Minimum Segments**: 12 segments required to boost
- **Speed Multiplier**: 2.5x normal speed (250 → 625 px/sec)
- **Mass Loss**: 1.0 segments/second while boosting
- **Pellet Drop Rate**: 2.0 pellets/second dropped behind snake
- **Boost Points**: Accumulated for anti-cheat (1.0 points/second)

#### **Boost Trail Rendering**
- **Pulse System**: Glowing pulses travel down snake while boosting
- **Pulse Speed**: Scales with snake length (reference: 800px, power: 0.3)
- **Fade Out**: Pulses fade out when boosting stops (decay: 0.12 seconds)
- **Visual Effects**: Glow radius 1.5x snake radius, flickering alpha animation

### **4. Food System**

#### **Food Mechanics**
- **Target Count**: 300 food pellets in world
- **Spawn Rate**: 0.5 pellets/second
- **Size Range**: 3-6px radius (random)
- **Colors**: 12 vibrant Slither.io-style colors

#### **Food Magnetism** (Server-Authoritative)
- **Magnetism Radius**: 80px attraction range
- **Magnetism Strength**: 12000px/s² acceleration
- **Commitment System**: Food commits to closest snake within 40px
- **Velocity-Based**: Food follows snake's velocity for smooth tracking

#### **Food Consumption**
- **Collision Detection**: Only front third of snake can absorb food (rounded up)
- **Collision Radius**: `food.radius + snake.r` (scales with snake size)
- **Eat Radius**: 5px immediate eat range
- **Growth**: 2 food points = 1 new segment

### **5. Collision Detection**

#### **Snake vs Snake Collisions**
- **Head-to-Head**: Both snakes die when head radii overlap
- **Head-to-Body**: Hitting another snake's body kills the hitting snake
- **Collision Radius**: `snake.r + otherSnake.r * 0.8` for head-to-body
- **Collision Authority**: Server-only (no client-side collision detection)

#### **Death Animation**
- **Duration**: 2000ms animation
- **Death Dots**: 50% of snake mass becomes food dots
- **Dot Size**: 8-15px radius (scales with segment size)
- **No Cap**: All segments convert to dots (no 25-pellet limit)
- **Fade Out**: Snake segments fade during animation

### **6. Visual Rendering**

#### **Snake Rendering**
- **Body Segments**: Radial gradients (light center → dark edges)
- **Head**: Larger radius than body (21px vs 18px)
- **Color System**: Generates light/base/dark/darker variants for gradients
- **Boost Glow**: Animated glow pulses travel along body while boosting

#### **Eye System**
- **Fixed Relative Positions**: Eyes locked to relative positions on head
- **Proportional Scaling**: Eye size/position scales with head diameter
- **Eye Separation**: 50% of head diameter (fixed relative to head size)
- **Sclera Radius**: 41% of head radius
- **Pupil Radius**: 58% of sclera radius
- **Pupil Tracking**: Pupils follow mouse cursor (maintains separation distance)
- **Forward Default**: Pupils face forward when no mouse input (null target)

#### **Camera System**
- **Following**: Smooth exponential easing (factor: 10.0)
- **Zoom**: 
  - Scales with speed (max 20% zoom out when boosting)
  - Scales inversely with growth (70% compensation)
- **World-to-Screen**: Converts world coordinates to screen space

#### **Background**
- **Hexagonal Tiling**: Repeating hex tile pattern
- **Parallax**: Camera-relative positioning for depth effect

### **7. World & Spawning**

#### **World Configuration**
- **World Size**: 4000px radius (circular world)
- **Spawn Buffer**: 200px from border, 100px minimum from center
- **Arena Size**: 95% of world size for food spawning

#### **Player Spawning**
- **Random Position**: Spawned at random angle and distance from center
- **Initial State**: 12 segments, straight line formation
- **Random Angle**: Spawned facing random direction

---

## Key Files & Responsibilities

### **Client Side** (`apps/client/src/`)

#### **`main.ts`** (510 lines)
- **Primary Responsibilities**:
  - Canvas setup and initialization
  - WebSocket connection management
  - Game loop (60+ FPS)
  - Input handling (mouse position, boost key)
  - Client-side prediction for local player
  - Interpolation for other players
  - Server state synchronization
  - Game state management (landing, playing, gameOver)
- **Key Functions**:
  - `gameLoop()`: Main render loop with prediction/interpolation
  - `net.onState()`: Handles server updates, blends with local state
  - Mouse/touch input event handlers

#### **`snake/SnakeBody.ts`** (716 lines - refactored core orchestrator)
- **Client-side snake physics orchestration**
- **Refactoring Status**: ✅ Complete - extracted to 6 specialized modules
- **Core Responsibilities**:
  - State management (position, angle, speed, health)
  - Segment management and rendering coordination
  - User input processing and boost control
  - Server reconciliation orchestration
  - Lifecycle management (reset, death, initialization)
- **Key Methods**:
  - `step(dt, desiredAngle)`: Main update orchestrator
  - `moveSegmentsSynchronously()`: Core physics loop
  - `reset(pos, angle)`: Respawns snake
  - `reconcileAndRebuildTrail()`: Server sync orchestration
  - `addFoodPoints(points)`: Growth wrapper
  - `setBoosting(on)`: Boost control wrapper
- **Extracted Modules** (see SNAKEBODY_REFACTORED_ARCHITECTURE.md for details):
  - **HistoryTrail.ts** (215 lines): Arc-length path sampling, trail padding, smooth curve reconstruction
  - **SnakeAnimations.ts** (120 lines): Boost pulse effects, death animations
  - **SnakeReconciliation.ts** (100 lines): Server state sync, trail rebuild, micro-healing
  - **SnakeBoostSystem.ts** (83 lines): Boost economics, mass loss, pellet spawning
  - **SnakeGrowth.ts** (122 lines): Food accumulation, segment growth/removal
  - **SnakeMovement.ts** (109 lines): Turn rate limiting, speed transitions, angle math

#### **`snake/SnakeRenderer.ts`** (668 lines)
- **Visual rendering of snakes**
- **Responsibilities**:
  - Body segment rendering (gradients)
  - Eye rendering with proportional scaling
  - Boost glow effects (pulse system)
  - Player name rendering
  - World-to-screen coordinate conversion
- **Key Methods**:
  - `drawSnakeWithEffects()`: Renders local snake
  - `drawEyesFromFrame()`: Renders eyes with mouse tracking
  - `renderOtherPlayer()`: Renders other players' snakes
  - `updatePulses()`: Manages boost glow animation

#### **`render/WorldRenderer.ts`** (577 lines)
- **World rendering (food, background)**
- **Responsibilities**:
  - Food pellet rendering
  - Food fade-in animations
  - Server food synchronization
  - Background rendering
- **Key Methods**:
  - `updateServerFood()`: Syncs server food state with smooth blending
  - `render()`: Draws food and background

#### **`view/Camera.ts`** (53 lines)
- **Camera system**
- **Responsibilities**:
  - Smooth following with exponential easing
  - Dynamic zoom based on speed and growth
  - World ↔ screen coordinate conversion

#### **`net.ts`** (237 lines)
- **WebSocket networking layer**
- **Responsibilities**:
  - WebSocket connection management
  - Message serialization/deserialization
  - Ping/pong for RTT measurement
  - Event callbacks (onWelcome, onState, onError)

### **Server Side** (`apps/game-server/src/`)

#### **`index.ts`** (26 lines)
- **Server entry point**
- Starts GameServer instance
- Handles graceful shutdown (SIGINT/SIGTERM)
- Logs stats every 30 seconds

#### **`GameServer.ts`** (279 lines)
- **WebSocket server and message handling**
- **Responsibilities**:
  - WebSocket connection management
  - Message routing (join, input, ping, boostTrail)
  - Player lifecycle (connect, disconnect)
  - Game tick broadcasting (30 FPS)
  - Welcome message with playerId, worldSize, tickRate
- **Key Methods**:
  - `handleConnection()`: New client connection
  - `handleMessage()`: Routes messages by type
  - `handleInput()`: Processes player input
  - `broadcastState()`: Sends game state to all clients

#### **`GameWorld.ts`** (825 lines)
- **Authoritative game world state**
- **Responsibilities**:
  - Player management (add/remove)
  - Food spawning and magnetism
  - Collision detection (snake vs snake, snake vs food)
  - Input processing (mouse → desired angle)
  - Tick-based updates (30 FPS)
- **Key Methods**:
  - `updateSnakes()`: Processes all player inputs and updates snakes
  - `applyFoodMagnetism()`: Moves food toward snakes
  - `checkCollisions()`: Detects snake collisions
  - `checkFoodCollisionWithSnake()`: Detects food consumption
  - `spawnInitialFood()`: Creates initial food pellets

#### **`ServerSnake.ts`** (678 lines)
- **Server-side snake physics** (mirrors client `SnakeBody.ts`)
- **Identical to client** for authoritative simulation:
  - Same movement constants and physics
  - Same path following system (using same principles as client HistoryTrail)
  - Same angle normalization and clamping
  - Boost trail system with unbounded history (no cap)
  - Death animation with full mass-to-dots conversion
  - Segment growth logic with extended history support
- **Recent Changes**:
  - Removed `historyMax` cap for extended multiplayer sessions (tested safe for 25 players, 50 segments each)
  - Supports unlimited history growth for deterministic replay during reconciliation
- **Potential Future Optimization**: Port SnakeMovement utilities to server for code reuse

---

## Networking Protocol

### **Message Types**

#### **Client → Server**
- **`join`**: `{ type: 'join', data: { name: string } }`
- **`input`**: `{ type: 'input', data: { mouseX: number, mouseY: number, boost: boolean } }`
- **`ping`**: `{ type: 'ping', data: { timestamp: number } }`
- **`boostTrail`**: `{ type: 'boostTrail', data: { ... } }` (for boost pellets)

#### **Server → Client**
- **`welcome`**: `{ type: 'welcome', data: { playerId: string, worldSize: number, tickRate: number } }`
- **`state`**: `{ type: 'state', data: { tick: number, players: [...], food: [...] } }`
- **`pong`**: `{ type: 'pong', data: { timestamp: number } }`
- **`error`**: `{ type: 'error', data: { message: string, code?: string } }`

### **State Data Structure**
```typescript
{
  tick: number,
  players: [{
    playerId: string,
    name: string,
    angle: number,
    boosting: boolean,
    score: number,
    isDead: boolean,
    deathAnimationProgress: number,
    snakeFadeProgress: number,
    head: { x: number, y: number },
    points: [{ x: number, y: number }], // All segment positions
    actualSegments: number,
    boostPoints: number,
    color: string
  }],
  food: [{
    x: number,
    y: number,
    radius: number,
    color: string,
    id: string,
    vx: number,
    vy: number
  }]
}
```

---

## Key Technical Decisions & Optimizations

### **1. Client-Side Prediction**
- **Why**: Reduces perceived input latency from ~33ms to ~16ms (60 FPS response)
- **Implementation**: Local snake runs independently, blended with server corrections
- **Trade-off**: Minor visual artifacts during desync, but significantly better responsiveness

### **2. Path Following System**
- **Why**: Replaced "rope physics" to eliminate coiling and ensure perfect circular loops
- **Implementation**: Head records history trail, segments follow exact path with arc-length sampling (HistoryTrail module)
- **Arc-Length Sampling**: Segments positioned uniformly along curve instead of chain physics
- **Result**: Consistent segment spacing, no length changes during boost transitions, perfect circles when looping
- **Refactored Into**: HistoryTrail.ts module (215 lines) with reusable path math utilities

### **3. Server-Authoritative Food**
- **Why**: Prevents cheating and ensures consistent food state across all clients
- **Implementation**: All food logic (spawning, magnetism, consumption) handled server-side
- **Trade-off**: Client must interpolate food positions smoothly between server updates

### **4. Angle Dead Zone**
- **Why**: Prevents micro-oscillations and jitter from tiny angle differences
- **Implementation**: Filters angle changes < 0.001 radians (~0.06°)
- **Result**: Eliminates visual jitter during small movements

### **5. Maximum Turn Angle**
- **Why**: Prevents snake from turning backwards (creates jitter when mouse between forward/backward)
- **Implementation**: Limits angle change to ±90° (π/2 radians)
- **Result**: Head always moves forward, only turns left or right

### **6. Front-Third Food Absorption**
- **Why**: Prevents tail from immediately absorbing boost pellets
- **Implementation**: Only checks collision with front 1/3 of snake segments (rounded up)
- **Result**: Boost pellets drop behind snake before being consumed

### **7. Proportional Scaling**
- **Why**: Ensures hitboxes, eyes, and visual elements scale correctly with snake size
- **Implementation**: All collision radii and visual sizes use snake radius (`snake.r`)
- **Result**: Larger snakes have proportionally larger hitboxes and visual elements

### **8. Smooth Interpolation**
- **Why**: Reduces visual stutter for other players between 30 FPS server updates
- **Implementation**: 15% blend factor per frame (60 FPS) creates smooth 30 FPS → 60 FPS interpolation
- **Result**: Other players appear to move smoothly despite low server update rate

---

## Current Issues & Recent Fixes

### **Major Fixes - Jitter Elimination**
The local snake jitter issue has been resolved through a comprehensive refactoring and reconciliation system:
1. **Trail Rebuild Reconciliation**: Server corrections now rebuild the entire history trail with deterministic replay
2. **Arc-Length Segment Placement**: Segments positioned uniformly along history curve (via HistoryTrail module)
3. **Micro-Healing Window**: 2-frame healing period post-correction limits turn rate to dampen oscillation
4. **Deterministic Replay**: Inputs replayed with fixed timesteps and stored heading angles
5. **Extended History Support**: Removed history cap for extended multiplayer sessions

### **Recent Fixes**
1. **Code Refactoring**: Extracted 1136-line SnakeBody into 6 focused modules (37% reduction)
   - HistoryTrail.ts: Path math and arc-length sampling
   - SnakeAnimations.ts: Boost pulses and death effects
   - SnakeReconciliation.ts: Server sync logic
   - SnakeBoostSystem.ts: Boost mechanics
   - SnakeGrowth.ts: Growth system
   - SnakeMovement.ts: Movement physics
2. **Head Jitter Fix**: Added angle synchronization from server with stored heading angles
3. **Eye Position Fix**: Implemented fixed relative positions with proportional scaling
4. **Death Dots Cap Removal**: Removed 25-pellet cap, all segments convert to dots
5. **Collision Scaling**: Made hitboxes and pickup radius scale with snake size
6. **Segment Growth**: Growth extends from tail with immediate history addition
7. **Boost Pellet Overflow**: Fixed unbounded pellet accumulation on server

### **Known Issues**
- None currently reported; system appears stable at target scale (25 players, 50 segments each)

---

## Context & Important Details for Future Development

This section documents critical knowledge gaps that aren't immediately obvious from the codebase structure alone. Reference this when starting new tasks or debugging issues.

### **1. The Jitter Problem (SOLVED - But Important for Understanding)**

**What It Was**:
- Local snake segments would rapidly compress, stack, and oscillate during gameplay
- Especially visible while boosting, eating food, or making sharp turns
- Tail would appear much shorter than actual, segments appearing "frozen" in straight lines
- Head would "snap" in different directions or teleport forward/backward

**Root Cause**:
- Client predicted movement ahead of server
- Server would send corrections when client deviated
- Client had **contaminated history** (pre-correction positions mixed with corrected ones)
- Segments followed this mixed history, causing oscillation as snake "resettled"
- Arc-length calculations over bad history created jitter propagating down the body

**How It Was Fixed**:
- **Trail Rebuild**: On server correction, client now clears the contaminated history entirely
- **Deterministic Replay**: Unacknowledged inputs are replayed using stored heading angles and fixed timesteps
- **Arc-Length Sampling**: New segments positioned uniformly along the rebuilt trail (not chain physics)
- **Micro-Healing Window**: 2-frame period post-correction that limits turn rate by 50% to prevent new kinks
- **Extended History**: Removed history cap to support longer replays without data loss

**Why It Matters**:
- If you modify `SnakeBody.step()` or `moveSegmentsSynchronously()`, you could reintroduce jitter
- Any changes to `SnakeReconciliation` must preserve deterministic replay
- Segment count changes should NOT trigger full reconciliation (learned the hard way)

**See Also**: `SNAKEBODY_REFACTORED_ARCHITECTURE.md` for complete technical breakdown

---

### **2. Arc-Length Sampling & Path Following**

**What It Is**:
- Instead of "chain physics" (segment 1 follows head, segment 2 follows segment 1, etc.), segments follow a **recorded path** uniformly
- Each segment maintains a fixed distance from head (e.g., segment 5 is always 5 × 13.4px from head)
- Position found by sampling along historical curve at that distance (arc-length parameterization)

**Why It Matters**:
- Segments maintain **consistent spacing** even during sharp turns
- Coiling and straightening prevented (perfect circles when looping)
- Works even when history runs out (fallback to chain physics, but tries path first)

**Common Pitfalls**:
- If history is empty or corrupted, fallback direction logic kicks in (can cause sudden direction changes)
- New segments added in `ensureCorrectSegmentCount()` MUST be added to history immediately
- Blending between path-following and chain physics can create stuttering if not smooth

**Related Code**:
- `HistoryTrail.ts`: `sampleSegmentsFromHistory()` does the arc-length math
- `SnakeBody.ts`: `moveSegmentsSynchronously()` applies the sampling
- `SnakeReconciliation.ts`: `buildTrailFromPoints()` rebuilds trail and resamples on correction

---

### **3. Reconciliation & Input Replay**

**What It Is**:
- Client sends inputs to server (mouse angle, boost flag)
- Server processes authoritative game state and broadcasts corrections
- Client might have sent 5+ inputs before getting server feedback (network latency)
- Reconciliation must **deterministically replay** those unacknowledged inputs to recover state

**Critical Implementation Details**:
- Each `ClientInput` now stores `dt` (frame delta time) and `angle` (predicted heading used that frame)
- During replay, these stored values are **reused** (not recalculated) to ensure determinism
- Replay uses fixed timestep clamping: `Math.max(5, Math.min(50, dt))` milliseconds per frame
- Replay runs between `beginReconciliationReplay()` and `endReconciliationReplay()` to skip healing window
- Input history stored in `Reconciler.ts` with full input object copies (not just mouse position)

**Why It Matters**:
- Without storing heading angle: replay would recalculate angle from mouse, causing overcorrection
- Without fixed timestep clamping: frame-dependent variance causes non-deterministic divergence
- Without healing window: reconciliation trigger causes immediate re-introduction of jitter

**Common Bugs**:
- Replaying with wrong `dt` → segments appear in wrong positions
- Not storing `angle` → sharp "snap" corrections
- Skipping healing window during replay → oscillation resumes immediately after correction

**Related Code**:
- `SnakeReconciliation.ts`: `buildTrailFromPoints()` and `finalizeReconciliation()`
- `Reconciler.ts`: Input history tracking with `dt` and `angle`
- `SnakeBody.step()`: Healing clamp application via `applyMicroHealingClamp()`

---

### **4. Segment Growth & History Extension**

**Problem We Solved**:
- New segments added mid-game would "jump" or become misaligned with server-side positions
- Tail would rapidly compress when eating many pellets
- Segments appeared as straight line instead of following snake path

**Current Solution**:
- When new segments added in `ensureCorrectSegmentCount()`, they are **immediately added to history trail**
- No synthetic extension backward (was tried, caused rigid straight lines)
- History grows naturally as head moves; new segments follow tail direction
- Segments extend in straight line when history runs out, with proper spacing enforcement

**Why It Matters**:
- Growth must be synchronized with history, not independent
- Growing too fast (multiple segments per frame) can cause visual pops
- History must be sufficient to cover all segments (checked via `ensureTrailCoverage()`)

**Related Code**:
- `SnakeGrowth.ts`: `ensureCorrectSegmentCount()` adds segments and to history
- `HistoryTrail.ts`: `ensureTrailCoverage()` pads history if insufficient

---

### **5. History Cap Removal & Performance**

**What Changed**:
- Original code had `historyMax: 2048` constant capping stored path points
- This was removed entirely, allowing unbounded history growth
- Decision: Safe for target scale (25 concurrent players, 50 segments each)

**Performance Impact**:
- At max scale: ~1,250 history points per snake, ~31 KB per snake (JSON)
- Total multiplayer: ~31 KB × 25 = 775 KB total (negligible)
- CPU: Arc-length sampling is O(n) where n = history length; still very fast
- Memory grows linearly with playtime, but stays well under limits for 20+ hours

**When to Worry**:
- If adding 100+ players: might want to add cap back
- If individual snakes grow to 200+ segments: growth is exponential
- If server runs for 24+ hours without restart: monitor history size

**Related Code**:
- `ServerSnake.ts`: No `historyMax` check; history grows freely
- `SnakeBody.ts`: Debug flag `DEBUG_HISTORY` logs history usage every 5 seconds

---

### **6. Boost System Economy**

**How It Works**:
- While boosting: lose 1 segment/second, drop 2 pellets/second
- Pellets sent to server as `boostTrail` messages
- Pellets have `maxAge: Infinity` on server (don't expire automatically)
- Anti-cheat: accumulate boost points at 1 point/second

**Important Constraints**:
- Can't boost below 12 segments (checked via `canBoostCheck()`)
- Pellets accumulate indefinitely (fixed in recent build by managing server-side cleanup)
- Speed multiplier: 2.5x (625 px/sec vs 250 px/sec)
- Turn rate reduction: 30% slower when at max length

**Why It Matters**:
- Pellet accumulation was source of "overflow" lag (now managed)
- Segment cap prevents infinite boosting loop
- Anti-cheat could be spoofed if not server-validated

**Related Code**:
- `SnakeBoostSystem.ts`: All boost mechanics
- `GameWorld.ts`: Server-side pellet management and cleanup

---

### **7. Client-Server Synchronization Strategy**

**Local Player**:
- Client predicts immediately (60 FPS)
- Server corrections trigger trail rebuild and input replay
- Reconciliation threshold: ~20px desync (spacing × 1.5)
- Small desyncs use gentle smoothing (1% position, 10% angle) instead of rebuild

**Other Players**:
- Snapshot interpolation: blend between server updates (15% per frame)
- Lag compensation: Position other players slightly in the past (allow for smooth transitions)
- Full snap if > 200px away or segment count mismatch

**Why It Matters**:
- Local player feels responsive (immediate prediction)
- Other players appear smooth despite 30 FPS server
- Reconciliation prevents divergence without being too aggressive

**Related Code**:
- `main.ts`: Prediction loop and interpolation logic
- `SnapshotBuffer.ts`: Buffered snapshots for interpolation
- `TimeSync.ts`: RTT measurement for lag compensation

---

### **8. Testing Scenarios That Have Caused Issues**

These are known "stress points" that have caused bugs in the past. Test here first:

1. **Sharp turns while boosting** → Can cause jitter if reconciliation too aggressive
2. **Eating many pellets rapidly** → Segment growth sync issues
3. **Server corrections during turns** → Angle storage matters here (overcorrection without it)
4. **Low-frame-rate clients (30 FPS)** → Deterministic replay timestep clamp is critical
5. **Long play sessions** → History growth and memory usage
6. **Many concurrent players (20+)** → Network bandwidth and server CPU
7. **Connection interruption + recovery** → Input history loss and desync recovery
8. **Spawning in while other snakes nearby** → Collision detection on spawn

---

### **9. Code Organization & Dependencies**

**Module Dependency Graph**:
```
SnakeBody (orchestrator)
├─ HistoryTrail (reusable path math)
├─ SnakeMovement (reusable physics)
├─ SnakeReconciliation (uses HistoryTrail)
├─ SnakeAnimations (no dependencies)
├─ SnakeBoostSystem (no dependencies)
└─ SnakeGrowth (no dependencies)
```

**Important Notes**:
- HistoryTrail and SnakeMovement could be ported to server (not done yet)
- SnakeRenderer has NO dependency on SnakeBody state (good separation)
- GameWorld and ServerSnake must stay in sync with client logic
- Any change to movement constants must be made in both client and server

---

### **10. Known Performance Optimizations & Limits**

**Optimizations Already Done**:
- Dead zone on angle changes (0.001 radians) prevents micro-jitter
- Max turn angle (±90°) prevents backwards movement oscillation
- Turn rate reduction with length prevents sharp-turn spam
- Segment count limit (12 min, scales with growth) prevents infinite loops

**Potential Future Optimizations**:
- Spatial hashing for collision detection (currently O(n²))
- Object pooling for segments and particles (could reduce GC)
- WebWorker for physics calculations (offload server-side math)
- Compression for network state updates (large JSON each tick)
- Snapshot interpolation with rollback (for more accurate prediction)

**Current Bottlenecks**:
- Server-side food magnetism (O(n²) at 30 FPS)
- Client-side rendering (Canvas 2D doesn't batch well, ~50-100 snakes max)
- Network bandwidth at 20+ players (state size grows linearly)

---

### **Quick Reference: When to Check These Sections**

| Problem | Check Section |
|---------|---------------|
| Segments compressing or jumping | Section 1 (Jitter) & Section 4 (Growth) |
| Snake appears stiff or rigid | Section 2 (Arc-Length) |
| Rubber-banding or teleporting | Section 3 (Reconciliation) |
| Pellets disappearing or accumulating | Section 6 (Boost System) |
| Other players appearing jerky | Section 7 (Sync Strategy) |
| Memory issues in long sessions | Section 5 (History Cap) |
| Angle changes feel wrong | Section 3 (Reconciliation - angle storage) |
| Segment count mismatch | Section 4 (Growth & History) |

---

## Development Workflow

### **Setup**
```bash
pnpm install          # Install all dependencies
pnpm dev              # Start both client and server in dev mode
pnpm build            # Build both client and server
```

### **Dev Servers**
- **Client**: `http://localhost:5173` (Vite dev server)
- **Game Server**: `ws://localhost:8081` (WebSocket server)

### **Build Output**
- **Client**: `apps/client/dist/` (static files)
- **Server**: `apps/game-server/dist/` (compiled JavaScript)

---

## Performance Characteristics

- **Server Tick Rate**: 30 FPS (33ms per tick)
- **Client Render Rate**: 60+ FPS (16ms per frame)
- **WebSocket Updates**: ~33ms intervals (every server tick)
- **Interpolation**: Continuous 60 FPS blending between server updates
- **Client Prediction**: Immediate 60 FPS response for local player
- **World Size**: 4000px radius (handles ~50-100 players comfortably)

---

## Code Architecture & Refactoring

### **SnakeBody Modularization** ✅ Complete
The original monolithic `SnakeBody.ts` (1136 lines) has been refactored into 6 focused modules with clear responsibilities:

| Module | Lines | Responsibility | Benefits |
|--------|-------|-----------------|----------|
| **SnakeBody** | 716 | Core state & orchestration | Easier navigation, clear control flow |
| **HistoryTrail** | 215 | Arc-length path math | Reusable for server, testable independently |
| **SnakeMovement** | 109 | Movement physics | Tunable constants, portable physics |
| **SnakeAnimations** | 120 | Visual effects | Isolated animation logic |
| **SnakeReconciliation** | 100 | Server sync | Understandable reconciliation flow |
| **SnakeBoostSystem** | 83 | Boost mechanics | Auditable economy system |
| **SnakeGrowth** | 122 | Growth system | Deterministic growth, easy to test |

**Key Benefits**:
- 37% code reduction in main orchestrator class
- Single-responsibility modules are easier to understand and debug
- Independent testing possible for each system
- Easier onboarding for new developers (study one module at a time)
- Potential for server-side code reuse (HistoryTrail, SnakeMovement)

**See Also**: `READ_ME/SNAKEBODY_REFACTORED_ARCHITECTURE.md` for complete architectural documentation

---

## Future Improvements (from README)

- Rollback input buffering for perfect prediction
- Matchmaking and rooms (instead of single world)
- Session persistence and balances
- Real-money integration
- Improved art and skins
- Mobile touch joystick support


