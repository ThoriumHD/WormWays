import type { Vec2 } from '@packages/proto';
import { SnakeBody } from './SnakeBody';
import { SnakeRenderer } from './SnakeRenderer';
import { ClientSim } from '../net/ClientSim';
import { Camera } from '../view/Camera';

export class Snake {
  public body = new SnakeBody();
  public renderer = new SnakeRenderer();
  public sim = new ClientSim();
  public position: Vec2 = { x: 0, y: 0 };
  public angle = 0;
  public score = 20;

  constructor() {
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
}
