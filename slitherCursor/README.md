Slither-like Multiplayer MVP

Monorepo with client (Pixi.js), server (Node + ws), and API (Express + SQLite).

Run locally

Prereqs: Node 20+, npm 10+.

1. Install deps

```
npm install
```

2. Start dev servers (client, server, api)

```
npm run dev
```

- Client: http://localhost:5173
- Game WS: ws://localhost:8081
- API: http://localhost:8080

Docker Compose

```
docker compose up --build
```

Folders

- `/client`: Vite + TypeScript + Pixi.js renderer. Minimal HUD and controls.
- `/server`: WebSocket authoritative game server. Ticks at 60 Hz, handles movement, simple collisions, and food.
- `/api`: Express API with SQLite (better-sqlite3) for users and matches. Starts with fake credits.

Controls

- Move mouse to steer your snake. Camera follows your head.

Notes / Next steps

- Add rollback input buffering and client prediction.
- Add matchmaking and rooms instead of a single world.
- Persist sessions and balances; integrate real-money provider later.
- Improve art, skins, and mobile touch joystick.


