import type { DisplayKind } from './catalog';

export const GRID_W = 10;
export const GRID_H = 8;

/** Casilla de la caja registradora (fija en el prototipo). */
export const REGISTER = { x: 7, y: 5 };
/** Donde aparecen y desaparecen los clientes (justo fuera de la tienda). */
export const ENTRANCE = { x: 9, y: 8.4 };

/** Casillas donde no se puede construir: caja, cola y puerta. */
export const RESERVED_TILES = [
  { x: 7, y: 5 },
  { x: 7, y: 6 },
  { x: 8, y: 6 },
  { x: 9, y: 6 },
  { x: 9, y: 7 },
];

export interface StockOrder {
  itemId: string;
  readyAt: number;
}

export interface Display {
  id: number;
  kind: DisplayKind;
  x: number;
  y: number;
  itemId: string | null;
  stock: number;
  /** Unidades ya apartadas por clientes que van de camino. */
  reserved: number;
  order: StockOrder | null;
}

export interface PlacedDecor {
  id: number;
  decorId: string;
  x: number;
  y: number;
}

export type CustomerState = 'toDisplay' | 'browsing' | 'queue' | 'lost' | 'leaving';

export interface Customer {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  state: CustomerState;
  itemId: string;
  displayId: number | null;
  carrying: boolean;
  /** Segundos restantes de la acción actual (mirar, quejarse...). */
  timer: number;
  look: number;
}

export type SimEvent =
  | { type: 'sale'; amount: number; x: number; y: number }
  | { type: 'unhappy'; x: number; y: number }
  | { type: 'pickup'; displayId: number; customerId: number; itemId: string }
  | { type: 'delivered'; displayId: number; itemId: string }
  | { type: 'levelUp'; level: number };

export interface GameState {
  version: 1;
  /** Reloj de la simulación en ms (alineado con Date.now()). */
  time: number;
  coins: number;
  xp: number;
  level: number;
  /** Ánimo de la clientela (0-100); la decoración se suma aparte. */
  mood: number;
  displays: Display[];
  decor: PlacedDecor[];
  customers: Customer[];
  /** Ids de clientes en la cola de la caja, el primero es el que paga. */
  queue: number[];
  serveTimer: number;
  spawnTimer: number;
  nextId: number;
  stats: { sold: number; lost: number };
  /** Eventos pendientes para que el render los muestre; se vacían cada frame. */
  events: SimEvent[];
}

export function createInitialState(now: number): GameState {
  return {
    version: 1,
    time: now,
    coins: 150,
    xp: 0,
    level: 1,
    mood: 40,
    displays: [{ id: 1, kind: 'rack', x: 3, y: 2, itemId: null, stock: 0, reserved: 0, order: null }],
    decor: [],
    customers: [],
    queue: [],
    serveTimer: 0,
    spawnTimer: 2,
    nextId: 2,
    stats: { sold: 0, lost: 0 },
    events: [],
  };
}
