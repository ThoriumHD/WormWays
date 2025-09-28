export type Vec2 = {
    x: number;
    y: number;
};
export declare function writeVarUint(value: number, bytes: number[]): void;
export declare function readVarUint(view: DataView, offset: number): {
    value: number;
    next: number;
};
export declare function writeString(s: string, bytes: number[]): void;
export declare function readString(view: DataView, offset: number): {
    value: string;
    next: number;
};
export declare enum MsgType {
    C2S_Join = 1,
    C2S_Input = 2,
    C2S_Respawn = 3,
    C2S_Ping = 4,
    S2C_Welcome = 10,
    S2C_State = 11,
    S2C_Pong = 12
}
export type C2SJoin = {
    type: MsgType.C2S_Join;
    name: string;
};
export declare function encodeJoin(name: string): Uint8Array;
export declare function decodeJoin(buf: Uint8Array): C2SJoin;
export type C2SInput = {
    type: MsgType.C2S_Input;
    seq: number;
    angle: number;
    boost: boolean;
};
export declare function encodeInput(seq: number, angle: number, boost: boolean): Uint8Array;
export declare function decodeInput(buf: Uint8Array): C2SInput;
export type C2SRespawn = {
    type: MsgType.C2S_Respawn;
};
export declare function encodeRespawn(): Uint8Array;
export declare function decodeRespawn(buf: Uint8Array): C2SRespawn;
export type C2SPing = {
    type: MsgType.C2S_Ping;
    t: number;
};
export declare function encodePing(t: number): Uint8Array;
export declare function decodePing(buf: Uint8Array): C2SPing;
export type S2CWelcome = {
    type: MsgType.S2C_Welcome;
    playerId: number;
    worldSize: number;
};
export declare function encodeWelcome(playerId: number, worldSize: number): Uint8Array;
export declare function decodeWelcome(buf: Uint8Array): S2CWelcome;
export type S2CStatePlayer = {
    id: number;
    len: number;
    headX: number;
    headY: number;
    color: number;
    alive: boolean;
};
export type S2CState = {
    type: MsgType.S2C_State;
    tick: number;
    players: S2CStatePlayer[];
    food: Vec2[];
};
export declare function encodeState(tick: number, players: S2CStatePlayer[], food: Vec2[]): Uint8Array;
export declare function decodeState(buf: Uint8Array): S2CState;
export type S2CPong = {
    type: MsgType.S2C_Pong;
    t: number;
};
export declare function encodePong(t: number): Uint8Array;
export declare function decodePong(buf: Uint8Array): S2CPong;
//# sourceMappingURL=index.d.ts.map