import type { Vec2 } from '@packages/proto';
import { SnakeBody } from './SnakeBody';
import { SnakeRenderer } from './SnakeRenderer';
import { ClientSim } from '../net/ClientSim';
import { Camera } from '../view/Camera';

export class Snake {
  public body = new SnakeBody();
  public renderer: SnakeRenderer;
  public sim = new ClientSim();
  public position: Vec2 = { x: 0, y: 0 };
  public angle = 0;
  public score = 20;
  public money = 0;

  constructor(app: any, initialMoney: number = 0) {
    this.renderer = new SnakeRenderer(app, initialMoney);
    this.money = initialMoney;
    this.body.maxLenFromScore = this.score * 8;
  }

  update(dt: number, targetAngle: number, boost: boolean, camera?: Camera) {
    // Update client simulation
    this.sim.update(dt, targetAngle, boost);
    
    // Get predicted state
    const state = this.sim.getState();
    this.position = state.position;
    this.angle = state.angle;
    this.score = state.score;
    
    // Update money in renderer to keep it in sync
    this.renderer.setMoney(this.money);
    
    // Calculate velocity for eye direction
    const speed = boost ? 180 : 140;
    const velocity = {
      x: Math.cos(this.angle) * speed,
      y: Math.sin(this.angle) * speed
    };
    
    // Update body with predicted points (already evenly spaced)
    this.body.points = [...state.body];
    this.body.maxLenFromScore = this.score * 8;
    
    // Update renderer with camera and velocity
    const headCarry = this.sim.getHeadCarry();
    this.renderer.updateBody(this.body.points, this.score, camera, velocity, headCarry);
    
    // Update renderer tick for money display
    this.renderer.tick(dt);
  }
  
  reconcile(serverState: any, myId: number) {
    this.sim.reconcile(serverState, myId);
    
    // Update local state from reconciled simulation
    const state = this.sim.getState();
    this.position = state.position;
    this.angle = state.angle;
    this.score = state.score;
    
    // Update body
    this.body.points = state.body;
    this.body.maxLenFromScore = this.score * 8;
    
    // Update renderer
    this.renderer.updateBody(this.body.points, this.score);
  }

  getGraphics() {
    return this.renderer.getGraphics();
  }
  
  getMaterial() {
    return this.renderer.getMaterial();
  }

  // Money management methods
  addMoney(amount: number): void {
    this.money += amount;
    this.renderer.addMoney(amount);
  }

  spendMoney(amount: number): boolean {
    if (this.money >= amount) {
      this.money -= amount;
      this.renderer.setMoney(this.money);
      return true;
    }
    return false;
  }

  getMoney(): number {
    return this.money;
  }

  setMoney(amount: number): void {
    this.money = amount;
    this.renderer.setMoney(amount);
  }

  showMoneyDisplay(): void {
    this.renderer.showMoneyDisplay();
  }
}
