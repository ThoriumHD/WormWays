// varint (u32) – LEB128 style, 7-bit groups
export function writeVarUint(value, bytes) {
    let v = value >>> 0;
    while (v >= 0x80) {
        bytes.push((v & 0x7f) | 0x80);
        v >>>= 7;
    }
    bytes.push(v);
}
export function readVarUint(view, offset) {
    let result = 0;
    let shift = 0;
    let pos = offset;
    while (true) {
        const b = view.getUint8(pos++);
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0)
            break;
        shift += 7;
    }
    return { value: result >>> 0, next: pos };
}
const te = new TextEncoder();
const td = new TextDecoder();
export function writeString(s, bytes) {
    const arr = te.encode(s);
    writeVarUint(arr.length, bytes);
    for (let i = 0; i < arr.length; i++)
        bytes.push(arr[i]);
}
export function readString(view, offset) {
    const { value: len, next } = readVarUint(view, offset);
    const buf = new Uint8Array(view.buffer, view.byteOffset + next, len);
    return { value: td.decode(buf), next: next + len };
}
// Message types
export var MsgType;
(function (MsgType) {
    MsgType[MsgType["C2S_Join"] = 1] = "C2S_Join";
    MsgType[MsgType["C2S_Input"] = 2] = "C2S_Input";
    MsgType[MsgType["C2S_Respawn"] = 3] = "C2S_Respawn";
    MsgType[MsgType["C2S_Ping"] = 4] = "C2S_Ping";
    MsgType[MsgType["S2C_Welcome"] = 10] = "S2C_Welcome";
    MsgType[MsgType["S2C_State"] = 11] = "S2C_State";
    MsgType[MsgType["S2C_Pong"] = 12] = "S2C_Pong";
})(MsgType || (MsgType = {}));
export function encodeJoin(name) {
    const out = [];
    writeVarUint(MsgType.C2S_Join, out);
    writeString(name, out);
    return Uint8Array.from(out);
}
export function decodeJoin(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = 0;
    const { value: type, next } = readVarUint(view, pos);
    pos = next;
    const { value: name, next: n2 } = readString(view, pos);
    return { type: type, name };
}
export function encodeInput(seq, angle, boost) {
    const out = [];
    writeVarUint(MsgType.C2S_Input, out);
    const buf = new Uint8Array(2 + 4 + 1);
    const dv = new DataView(buf.buffer);
    dv.setUint16(0, seq, true);
    dv.setFloat32(2, angle, true);
    dv.setUint8(6, boost ? 1 : 0);
    return Uint8Array.from([...out, ...buf]);
}
export function decodeInput(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = 0;
    const { value: type, next } = readVarUint(view, pos);
    pos = next;
    const seq = view.getUint16(pos, true);
    pos += 2;
    const angle = view.getFloat32(pos, true);
    pos += 4;
    const boost = view.getUint8(pos) === 1;
    return { type: type, seq, angle, boost };
}
export function encodeRespawn() {
    const out = [];
    writeVarUint(MsgType.C2S_Respawn, out);
    return Uint8Array.from(out);
}
export function decodeRespawn(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const { value: type } = readVarUint(view, 0);
    return { type: type };
}
export function encodePing(t) {
    const out = [];
    writeVarUint(MsgType.C2S_Ping, out);
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, t >>> 0, true);
    return Uint8Array.from([...out, ...buf]);
}
export function decodePing(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = 0;
    const { value: type, next } = readVarUint(view, pos);
    pos = next;
    const t = view.getUint32(pos, true);
    return { type: type, t };
}
export function encodeWelcome(playerId, worldSize) {
    const out = [];
    writeVarUint(MsgType.S2C_Welcome, out);
    const buf = new Uint8Array(4);
    const dv = new DataView(buf.buffer);
    dv.setUint16(0, playerId, true);
    dv.setUint16(2, worldSize, true);
    return Uint8Array.from([...out, ...buf]);
}
export function decodeWelcome(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = 0;
    const { value: type, next } = readVarUint(view, pos);
    pos = next;
    const playerId = view.getUint16(pos, true);
    pos += 2;
    const worldSize = view.getUint16(pos, true);
    return { type: type, playerId, worldSize };
}
export function encodeState(tick, players, food) {
    const head = [];
    writeVarUint(MsgType.S2C_State, head);
    const fixed = new Uint8Array(4);
    new DataView(fixed.buffer).setUint32(0, tick >>> 0, true);
    const dyn = [];
    writeVarUint(players.length, dyn);
    for (const p of players) {
        const buf = new Uint8Array(2 + 2 + 4 + 4 + 2 + 1);
        const dv = new DataView(buf.buffer);
        dv.setUint16(0, p.id, true);
        dv.setUint16(2, p.len, true);
        dv.setFloat32(4, p.headX, true);
        dv.setFloat32(8, p.headY, true);
        dv.setUint16(12, p.color, true);
        dv.setUint8(14, p.alive ? 1 : 0);
        dyn.push(...buf);
    }
    writeVarUint(food.length, dyn);
    for (const f of food) {
        const buf = new Uint8Array(8);
        const dv = new DataView(buf.buffer);
        dv.setFloat32(0, f.x, true);
        dv.setFloat32(4, f.y, true);
        dyn.push(...buf);
    }
    return Uint8Array.from([...head, ...fixed, ...dyn]);
}
export function decodeState(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = 0;
    const { value: type, next } = readVarUint(view, pos);
    pos = next;
    const tick = view.getUint32(pos, true);
    pos += 4;
    const playersLen = readVarUint(view, pos);
    pos = playersLen.next;
    const players = [];
    for (let i = 0; i < playersLen.value; i++) {
        const id = view.getUint16(pos, true);
        pos += 2;
        const len = view.getUint16(pos, true);
        pos += 2;
        const headX = view.getFloat32(pos, true);
        pos += 4;
        const headY = view.getFloat32(pos, true);
        pos += 4;
        const color = view.getUint16(pos, true);
        pos += 2;
        const alive = view.getUint8(pos++) === 1;
        players.push({ id, len, headX, headY, color, alive });
    }
    const foodLen = readVarUint(view, pos);
    pos = foodLen.next;
    const food = [];
    for (let i = 0; i < foodLen.value; i++) {
        const x = view.getFloat32(pos, true);
        pos += 4;
        const y = view.getFloat32(pos, true);
        pos += 4;
        food.push({ x, y });
    }
    return { type: type, tick, players, food };
}
export function encodePong(t) {
    const out = [];
    writeVarUint(MsgType.S2C_Pong, out);
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, t >>> 0, true);
    return Uint8Array.from([...out, ...buf]);
}
export function decodePong(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let pos = 0;
    const { value: type, next } = readVarUint(view, pos);
    pos = next;
    const t = view.getUint32(pos, true);
    return { type: type, t };
}
