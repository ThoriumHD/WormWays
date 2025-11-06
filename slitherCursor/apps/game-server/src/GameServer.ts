// apps/game-server/src/GameServer.ts
import WebSocket from 'ws';
import { GameWorld, GameState } from './GameWorld';

export interface ClientMessage {
  type: 'join' | 'input' | 'ping' | 'boostTrail';
  data?: any;
}

export interface ServerMessage {
  type: 'welcome' | 'state' | 'pong' | 'error';
  data?: any;
}

export interface WelcomeData {
  playerId: string;
  worldSize: number;
  tickRate: number;
}

export interface StateData {
  tick: number;
  players: any[];
  food: any[];
}

export interface ErrorData {
  message: string;
  code?: string;
}

export class GameServer {
  private wss: WebSocket.Server;
  private gameWorld: GameWorld;
  private clients = new Map<WebSocket, string>(); // WebSocket -> playerId
  private playerNames = new Map<string, string>(); // playerId -> name
  private lastPingTime = new Map<string, number>(); // playerId -> timestamp
  private tickInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 30; // 30 FPS
  private readonly WORLD_SIZE = 4000; // Match client's visible red circle

  constructor(port: number) {
    this.gameWorld = new GameWorld();
    this.wss = new WebSocket.Server({ port });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    console.log(`[GameServer] Server started on port ${port}`);
    console.log(`[GameServer] Tick rate: ${this.TICK_RATE} FPS`);
    console.log(`[GameServer] World size: ${this.WORLD_SIZE}px radius`);
  }

  private handleConnection(ws: WebSocket): void {
    console.log('[GameServer] New client connected');
    
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('[GameServer] Invalid message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      const playerId = this.clients.get(ws);
      if (playerId) {
        console.log(`[GameServer] Player ${playerId} disconnected`);
        this.gameWorld.removePlayer(playerId);
        this.clients.delete(ws);
        this.playerNames.delete(playerId);
        this.lastPingTime.delete(playerId);
      }
    });

    ws.on('error', (error) => {
      console.error('[GameServer] WebSocket error:', error);
    });
  }

  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message.data);
        break;
      case 'input':
        this.handleInput(ws, message.data);
        break;
      case 'ping':
        this.handlePing(ws, message.data);
        break;
      case 'boostTrail':
        this.handleBoostTrail(ws, message.data);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private handleJoin(ws: WebSocket, data: any): void {
    const { name } = data;
    
    console.log('[GameServer] HandleJoin called for name:', name);
    console.log('[GameServer] Current players:', Array.from(this.clients.values()));
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      this.sendError(ws, 'Invalid player name');
      return;
    }

    if (name.length > 20) {
      this.sendError(ws, 'Player name too long (max 20 characters)');
      return;
    }

    // Generate unique player ID
    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[GameServer] Generated playerId:', playerId);
    
    // Add player to game world
    const success = this.gameWorld.addPlayer(playerId, name.trim());
    if (!success) {
      this.sendError(ws, 'Failed to add player to game');
      return;
    }

    // Store client mapping
    this.clients.set(ws, playerId);
    this.playerNames.set(playerId, name.trim());
    this.lastPingTime.set(playerId, Date.now());

    // Send welcome message
    const welcomeData: WelcomeData = {
      playerId,
      worldSize: this.WORLD_SIZE * 2, // Send diameter, not radius
      tickRate: this.TICK_RATE
    };

    this.sendMessage(ws, {
      type: 'welcome',
      data: welcomeData
    });

    console.log(`[GameServer] Player ${name} joined with ID ${playerId}`);

    // Start game loop if this is the first player
    if (this.gameWorld.getPlayerCount() === 1) {
      this.startGameLoop();
    }
  }

  private handleInput(ws: WebSocket, data: any): void {
    const playerId = this.clients.get(ws);
    if (!playerId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    const { t, ax, ay, b, mouseX, mouseY, boost } = data;
    
    // Support both old format (mouseX, mouseY, boost) and new format (t, ax, ay, b)
    let input: any;
    if (typeof t === 'number' && typeof ax === 'number' && typeof ay === 'number' && typeof b === 'boolean') {
      // New format with client tick
      input = { t, mouseX: ax, mouseY: ay, boost: b };
    } else if (typeof mouseX === 'number' && typeof mouseY === 'number' && typeof boost === 'boolean') {
      // Old format (backward compatibility)
      input = { mouseX, mouseY, boost };
    } else {
      this.sendError(ws, 'Invalid input data');
      return;
    }

    // Update player input
    this.gameWorld.updatePlayerInput(playerId, input);
  }

  private handleBoostTrail(ws: WebSocket, data: any): void {
    const playerId = this.clients.get(ws);
    if (!playerId) {
      this.sendError(ws, 'Not authenticated');
      return;
    }

    const { x, y, radius, color } = data;
    
    if (typeof x !== 'number' || typeof y !== 'number' || typeof radius !== 'number') {
      this.sendError(ws, 'Invalid boost trail data');
      return;
    }

    // Add boost trail pellet to food system with snake's color
    this.gameWorld.addBoostTrailPellet(x, y, radius, color);
  }

  private handlePing(ws: WebSocket, data: any): void {
    const playerId = this.clients.get(ws);
    if (!playerId) {
      return;
    }

    const timestamp = Date.now();
    const lastPing = this.lastPingTime.get(playerId) || timestamp;
    const rtt = timestamp - lastPing;

    this.lastPingTime.set(playerId, timestamp);

    this.sendMessage(ws, {
      type: 'pong',
      data: { rtt }
    });
  }

  private sendMessage(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, message: string, code?: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message, code } as ErrorData
    });
  }

  private startGameLoop(): void {
    if (this.tickInterval) {
      return; // Already running
    }

    console.log('[GameServer] Starting game loop');
    
    this.tickInterval = setInterval(() => {
      this.gameWorld.update();
      this.broadcastState();
    }, 1000 / this.TICK_RATE);
  }

  private stopGameLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      console.log('[GameServer] Game loop stopped');
    }
  }

  private broadcastState(): void {
    const state = this.gameWorld.getState();
    
    const message: ServerMessage = {
      type: 'state',
      data: state
    };

    const messageStr = JSON.stringify(message);

    // Broadcast to all connected clients
    for (const ws of this.clients.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      activePlayers: this.gameWorld.getPlayerCount(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  public shutdown(): void {
    console.log('[GameServer] Shutting down...');
    this.stopGameLoop();
    this.wss.close();
  }
}
