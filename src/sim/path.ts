// Cuadrícula de la tienda: qué casillas están ocupadas, caminos para los clientes
// y validación de que ningún mueble deje zonas de la tienda inaccesibles.
import { doorTile, registerFront, storeSize, type GameState, type Point } from './state';

export type FurnitureKind = 'display' | 'register' | 'decor';

export interface FurnitureRef {
  kind: FurnitureKind;
  id: number;
}

/** Decoraciones que se pueden pisar. */
export const WALKABLE_DECOR = new Set(['rug']);

const key = (x: number, y: number) => `${x},${y}`;

export const inBounds = (state: GameState, x: number, y: number) => {
  const { w, h } = storeSize(state);
  return x >= 0 && y >= 0 && x < w && y < h;
};

/** Casillas que bloquean el paso; `exclude` permite simular que un mueble se ha quitado. */
export function blockedTiles(state: GameState, exclude?: FurnitureRef): Set<string> {
  const blocked = new Set<string>();
  const skip = (kind: FurnitureKind, id: number) => exclude?.kind === kind && exclude.id === id;
  for (const d of state.displays) if (!skip('display', d.id)) blocked.add(key(d.x, d.y));
  for (const r of state.registers) if (!skip('register', r.id)) blocked.add(key(r.x, r.y));
  for (const d of state.decor) {
    if (!skip('decor', d.id) && !WALKABLE_DECOR.has(d.decorId)) blocked.add(key(d.x, d.y));
  }
  return blocked;
}

/** Casillas ocupadas por cualquier mueble, incluida la decoración que se pisa. */
export function occupiedTiles(state: GameState, exclude?: FurnitureRef): Set<string> {
  const occupied = blockedTiles(state, exclude);
  for (const d of state.decor) {
    if (!(exclude?.kind === 'decor' && exclude.id === d.id)) occupied.add(key(d.x, d.y));
  }
  return occupied;
}

/** Puerta y casillas delante de las cajas: tienen que quedar libres. */
export function reservedTiles(state: GameState, exclude?: FurnitureRef): Set<string> {
  const door = doorTile(state);
  const reserved = new Set([key(door.x, door.y)]);
  for (const r of state.registers) {
    if (exclude?.kind === 'register' && exclude.id === r.id) continue;
    const f = registerFront(r);
    reserved.add(key(f.x, f.y));
  }
  return reserved;
}

const walkable = (state: GameState, blocked: Set<string>, x: number, y: number) =>
  inBounds(state, x, y) && !blocked.has(key(x, y));

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function neighbors(state: GameState, blocked: Set<string>, x: number, y: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [dx, dy] of DIRS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!walkable(state, blocked, nx, ny)) continue;
    // En diagonal solo si no se "corta" la esquina de un mueble.
    if (dx !== 0 && dy !== 0 && (!walkable(state, blocked, x + dx, y) || !walkable(state, blocked, x, y + dy))) continue;
    out.push([nx, ny, dx !== 0 && dy !== 0 ? Math.SQRT2 : 1]);
  }
  return out;
}

/**
 * Camino más corto (Dijkstra) entre dos casillas. La de salida puede estar bloqueada
 * (un cliente atrapado al colocar un mueble encima puede salir). Devuelve las casillas
 * a recorrer sin incluir la de salida, o null si no hay camino.
 */
export function findPath(state: GameState, from: Point, to: Point, blocked = blockedTiles(state)): Point[] | null {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  if (start.x === to.x && start.y === to.y) return [];
  if (!walkable(state, blocked, to.x, to.y)) return null;
  const dist = new Map<string, number>([[key(start.x, start.y), 0]]);
  const prev = new Map<string, string>();
  const open: { x: number; y: number; d: number }[] = [{ ...start, d: 0 }];
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].d < open[best].d) best = i;
    const cur = open.splice(best, 1)[0];
    if (cur.x === to.x && cur.y === to.y) break;
    if (cur.d > (dist.get(key(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [nx, ny, cost] of neighbors(state, blocked, cur.x, cur.y)) {
      const nd = cur.d + cost;
      const k = key(nx, ny);
      if (nd >= (dist.get(k) ?? Infinity)) continue;
      dist.set(k, nd);
      prev.set(k, key(cur.x, cur.y));
      open.push({ x: nx, y: ny, d: nd });
    }
  }
  const goal = key(to.x, to.y);
  if (!dist.has(goal)) return null;
  const path: Point[] = [];
  for (let k: string | undefined = goal; k && k !== key(start.x, start.y); k = prev.get(k)) {
    const [x, y] = k.split(',').map(Number);
    path.unshift({ x, y });
  }
  return path;
}

/** Todas las casillas a las que se llega andando desde la puerta. */
export function reachableFromDoor(state: GameState, blocked = blockedTiles(state)): Set<string> {
  const door = doorTile(state);
  const seen = new Set<string>();
  if (!walkable(state, blocked, door.x, door.y)) return seen;
  const stack = [door];
  seen.add(key(door.x, door.y));
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const [nx, ny] of neighbors(state, blocked, cur.x, cur.y)) {
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/** Casillas libres pegadas (en cruz) a un mueble, desde donde se le puede atender. */
export function accessTiles(state: GameState, p: Point, blocked = blockedTiles(state)): Point[] {
  return [
    { x: p.x, y: p.y + 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y - 1 },
  ].filter((t) => walkable(state, blocked, t.x, t.y));
}

/** Comprueba que la puerta, todas las cajas y todos los expositores son accesibles. */
export function layoutIsValid(state: GameState, blocked: Set<string>, displays: Point[], registers: Point[]): boolean {
  const reach = reachableFromDoor(state, blocked);
  if (reach.size === 0) return false;
  for (const r of registers) {
    const f = registerFront(r);
    if (!reach.has(key(f.x, f.y))) return false;
  }
  return displays.every((d) => accessTiles(state, d, blocked).some((t) => reach.has(key(t.x, t.y))));
}

/**
 * ¿Se puede poner un mueble de tipo `kind` en (x, y)? Devuelve el motivo si no.
 * `moving` es el mueble que se está moviendo (no cuenta como obstáculo).
 */
export function placementError(
  state: GameState,
  kind: FurnitureKind,
  x: number,
  y: number,
  options: { moving?: FurnitureRef; decorId?: string } = {},
): string | null {
  const { moving, decorId } = options;
  if (!inBounds(state, x, y)) return 'Fuera de la tienda';
  if (occupiedTiles(state, moving).has(key(x, y))) return 'Esa casilla está ocupada';
  const reserved = reservedTiles(state, moving);
  const isRug = kind === 'decor' && decorId !== undefined && WALKABLE_DECOR.has(decorId);
  if (!isRug && reserved.has(key(x, y))) return 'Hay que dejar libre la puerta y el paso a las cajas';

  if (kind === 'register') {
    const f = registerFront({ x, y });
    if (!inBounds(state, f.x, f.y)) return 'La caja necesita espacio delante';
    if (occupiedTiles(state, moving).has(key(f.x, f.y))) return 'La caja necesita espacio delante';
    const door = doorTile(state);
    if (f.x === door.x && f.y === door.y) return 'La caja no puede dar a la puerta';
  }
  if (isRug) return null;

  const blocked = blockedTiles(state, moving);
  blocked.add(key(x, y));
  const displays = state.displays.filter((d) => !(moving?.kind === 'display' && moving.id === d.id)).map((d) => ({ x: d.x, y: d.y }));
  const registers = state.registers.filter((r) => !(moving?.kind === 'register' && moving.id === r.id)).map((r) => ({ x: r.x, y: r.y }));
  if (kind === 'display') displays.push({ x, y });
  if (kind === 'register') registers.push({ x, y });
  if (!layoutIsValid(state, blocked, displays, registers)) return 'Así bloquearías el paso de los clientes';
  return null;
}
