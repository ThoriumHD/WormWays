import { Container, Graphics, Text } from 'pixi.js';
import type { S2CState } from '@packages/proto';

type Camera = { x: number; y: number; smoothX: number; smoothY: number };

export class WorldRenderer {
  public container = new Container();
  private bg = new Graphics();
  private snakes = new Graphics();
  private pellets = new Graphics();
  private hud = new Text({ text: '', style: { fill: '#ffffff', fontSize: 14 } });
  private moneyDisplays = new Container();

  private cam: Camera = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
  public myId: number = 0;
  private score: number = 0;
  private ping: number = 0;
  private playerMoney: Map<number, number> = new Map();

  constructor() {
    this.container.addChild(this.bg);
    this.container.addChild(this.pellets);
    this.container.addChild(this.snakes);
    this.container.addChild(this.moneyDisplays);
    this.hud.x = 10; this.hud.y = 10;
    this.container.addChild(this.hud);
  }

  setPlayer(id: number) { this.myId = id; }
  setPing(p: number) { this.ping = Math.round(p); }

  update(state: S2CState) {
    const me = state.players.find(p => p.id === this.myId);
    if (me) { this.cam.x = me.headX; this.cam.y = me.headY; this.score = me.len; }
    // camera lerp
    this.cam.smoothX += (this.cam.x - this.cam.smoothX) * 0.1;
    this.cam.smoothY += (this.cam.y - this.cam.smoothY) * 0.1;

    this.drawBackground();
    this.drawPellets(state);
    this.drawSnakes(state);
    this.drawMoneyDisplays(state);
    this.hud.text = `Score: ${this.score}   Ping: ${this.ping} ms`;
  }

  private worldToScreen(x: number, y: number) {
    return { x: x - this.cam.smoothX + window.innerWidth / 2, y: y - this.cam.smoothY + window.innerHeight / 2 };
  }

  private drawBackground() {
    const g = this.bg; g.clear();
    g.stroke({ color: 0x1d2736, width: 1, alpha: 0.6 });
    const grid = 60;
    const w = window.innerWidth; const h = window.innerHeight;
    const offX = (-this.cam.smoothX % grid) + grid; const offY = (-this.cam.smoothY % grid) + grid;
    for (let x = -grid; x < w + grid; x += grid) { g.moveTo(x + offX, 0); g.lineTo(x + offX, h); }
    for (let y = -grid; y < h + grid; y += grid) { g.moveTo(0, y + offY); g.lineTo(w, y + offY); }
    g.stroke();
  }

  private drawPellets(state: S2CState) {
    const g = this.pellets; g.clear(); g.fill(0xffd94a);
    for (const f of state.food) {
      const s = this.worldToScreen(f.x, f.y);
      g.circle(s.x, s.y, 3); g.fill();
    }
  }

  private drawSnakes(state: S2CState) {
    const g = this.snakes; g.clear();
    // Only draw other players, not our own (local snake handles that)
    for (const p of state.players) {
      if (p.id === this.myId) continue; // skip our own snake
      
      const color = this.colorFromShort(p.color);
      // head circle
      const head = this.worldToScreen(p.headX, p.headY);
      g.fill(0x000000, 0.25); g.circle(head.x, head.y, 9); g.fill();
      g.fill(color); g.circle(head.x, head.y, 7); g.fill();
      // simple body: draw trailing capsules proportional to length (approx)
      const segs = Math.min(20, Math.max(5, Math.floor(p.len / 5)));
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const x = p.headX - Math.cos(0) * i * 10; // placeholder; no server trail yet
        const y = p.headY - Math.sin(0) * i * 10;
        const s = this.worldToScreen(x, y);
        g.fill(color);
        g.circle(s.x, s.y, 6 * (1 - t * 0.4));
        g.fill();
      }
    }
  }

  private colorFromShort(c: number) {
    // map 0..1023 to an HSL-ish rainbow
    const h = (c % 1024) / 1024 * 360;
    const col = this.hslToHex(h, 80, 55);
    return col;
  }

  private drawMoneyDisplays(state: S2CState) {
    // Clear existing money displays
    this.moneyDisplays.removeChildren();
    
    // Draw money displays for other players
    for (const p of state.players) {
      if (p.id === this.myId) continue; // skip our own snake
      
      const money = this.playerMoney.get(p.id) || Math.floor(Math.random() * 1000) + 100; // placeholder money
      const head = this.worldToScreen(p.headX, p.headY);
      
      // Create money display
      const moneyText = new Text({
        text: `$${money.toLocaleString()}`,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 14,
          fill: 0xFFFFFF,
          fontWeight: 'bold',
          stroke: 0x000000,
          strokeThickness: 2,
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowBlur: 3,
          dropShadowAngle: Math.PI / 4,
          dropShadowDistance: 1,
        }
      });
      moneyText.anchor.set(0.5);
      moneyText.position.set(head.x, head.y - 35);
      
      // Create background
      const background = new Graphics();
      const bounds = moneyText.getBounds();
      const padding = 6;
      background.beginFill(0x000000, 0.7);
      background.drawRoundedRect(
        bounds.x - padding,
        bounds.y - padding,
        bounds.width + padding * 2,
        bounds.height + padding * 2,
        8
      );
      background.endFill();
      
      // Add to container
      this.moneyDisplays.addChild(background);
      this.moneyDisplays.addChild(moneyText);
    }
  }

  // Method to update player money (for server sync)
  setPlayerMoney(playerId: number, amount: number) {
    this.playerMoney.set(playerId, amount);
  }

  private hslToHex(h: number, s: number, l: number) {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const r = Math.round(255 * f(0));
    const g = Math.round(255 * f(8));
    const b = Math.round(255 * f(4));
    return (r << 16) | (g << 8) | b;
  }
}


