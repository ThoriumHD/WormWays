"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// apps/game-server/src/index.ts
const GameServer_1 = require("./GameServer");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;
const server = new GameServer_1.GameServer(PORT);
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Received SIGINT, shutting down gracefully...');
    server.shutdown();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('\n[Server] Received SIGTERM, shutting down gracefully...');
    server.shutdown();
    process.exit(0);
});
// Log stats every 30 seconds
setInterval(() => {
    const stats = server.getStats();
    console.log(`[Server] Stats - Clients: ${stats.connectedClients}, Players: ${stats.activePlayers}, Uptime: ${stats.uptime.toFixed(1)}s`);
}, 30000);
