import { encodeJoin, encodePing, encodeInput, decodeWelcome, decodeState, MsgType, type S2CState } from '@packages/proto';
import { ClientSim } from './net/ClientSim';

export type NetOptions = { serverUrl?: string };

export class Net {
  private ws: WebSocket | null = null;
  private seq = 0;
  private angle = 0;
  private boost = false;
  private pingTimer: number | undefined;
  private inputTimer: number | undefined;
  private lastPingSent = 0;
  private clientSim = new ClientSim();
  public onWelcome: ((m: ReturnType<typeof decodeWelcome>) => void) | null = null;
  public onState: ((m: S2CState) => void) | null = null;
  public onPong: ((rttMs: number) => void) | null = null;

  constructor(private opts: NetOptions = {}) {}

  setControls(angle: number, boost: boolean) {
    this.angle = angle;
    this.boost = boost;
  }

  connect(name: string = 'Player') {
    const url = this.resolveServerUrl();
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => {
      this.ws!.send(encodeJoin(name));
      this.pingTimer = window.setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.lastPingSent = performance.now();
          this.ws.send(encodePing(Date.now() >>> 0));
        }
      }, 2000);
      this.inputTimer = window.setInterval(() => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.seq = (this.seq + 1) & 0xffff;
        
        // Add input to client simulation
        this.clientSim.addInput({
          timestamp: performance.now(),
          angle: this.angle,
          boost: this.boost,
          seq: this.seq
        });
        
        this.ws.send(encodeInput(this.seq, this.angle, this.boost));
      }, 1000 / 60);
    };
    this.ws.onmessage = (ev) => {
      const buf = new Uint8Array(ev.data as ArrayBuffer);
      const first = buf[0] & 0x7f; // small varint
      try {
        switch (first) {
          case MsgType.S2C_Welcome: { const m = decodeWelcome(buf); this.onWelcome?.(m as any); break; }
          case MsgType.S2C_State: { 
            const m = decodeState(buf); 
            // Reconcile client simulation with server state
            this.clientSim.reconcile(m, 1); // TODO: get actual player ID
            this.onState?.(m); 
            break; 
          }
          case MsgType.S2C_Pong: { const rtt = performance.now() - this.lastPingSent; this.onPong?.(rtt); break; }
          default:
            console.log('[net] other msg', first);
        }
      } catch (e) {
        console.warn('decode error', e);
      }
    };
    this.ws.onclose = () => {
      if (this.pingTimer) window.clearInterval(this.pingTimer);
      if (this.inputTimer) window.clearInterval(this.inputTimer);
      this.pingTimer = undefined;
      this.inputTimer = undefined;
      console.log('[net] disconnected');
    };
  }

  private resolveServerUrl() {
    const param = new URLSearchParams(location.search).get('server');
    const env = import.meta.env.VITE_SERVER_URL as string | undefined;
    const url = param || env || `ws://${location.hostname}:8080`;
    return url;
  }
}


