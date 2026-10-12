import { EXPANSIONS, type DisplayKind, type UpgradeId } from './catalog';

export const SAVE_VERSION = 2;

export interface Point {
  x: number;
  y: number;
}

export interface StockOrder {
  itemId: string;
  readyAt: number;
  /** Duración total, para dibujar la barra de progreso. */
  totalMs: number;
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

export interface Register {
  id: number;
  x: number;
  y: number;
  /** Segundos que lleva cobrando al primero de la cola. */
  serveTimer: number;
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
  /** Puntos de paso pendientes; el último es el destino. */
  path: Point[];
  state: CustomerState;
  itemId: string;
  displayId: number | null;
  registerId: number | null;
  carrying: boolean;
  vip: boolean;
  /** Segundos restantes de la acción actual (mirar, quejarse...). */
  timer: number;
  /** Segundos esperando en la cola. */
  waited: number;
  /** Segundos desde que apareció, para el fundido de entrada. */
  age: number;
  look: number;
}

export type SimEvent =
  | { type: 'sale'; amount: number; tip: number; vip: boolean; gem: boolean; registerId: number; x: number; y: number }
  | { type: 'unhappy'; x: number; y: number; reason: 'missing' | 'queue' }
  | { type: 'pickup'; displayId: number; customerId: number; itemId: string }
  | { type: 'delivered'; displayId: number; itemId: string }
  | { type: 'autoOrder'; displayId: number; itemId: string }
  | { type: 'vipArrived'; itemId: string }
  | { type: 'trend'; kind: DisplayKind }
  | { type: 'levelUp'; level: number };

export interface Stats {
  sold: number;
  lost: number;
  earned: number;
  tips: number;
  ordersPlaced: number;
  vipServed: number;
  trendSold: number;
  upgradesBought: number;
  stylesBought: number;
  soldByItem: Record<string, number>;
}

export interface GameState {
  version: typeof SAVE_VERSION;
  /** Reloj de la simulación en ms (alineado con Date.now()). */
  time: number;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  /** Ánimo de la clientela (0-100); la decoración y el hilo musical se suman aparte. */
  mood: number;
  /** Índice en EXPANSIONS. */
  expansion: number;
  displays: Display[];
  registers: Register[];
  decor: PlacedDecor[];
  floor: string;
  wall: string;
  ownedStyles: string[];
  upgrades: Partial<Record<UpgradeId, number>>;
  trend: { kind: DisplayKind; until: number } | null;
  claimedTasks: string[];
  customers: Customer[];
  spawnTimer: number;
  nextId: number;
  stats: Stats;
  /** Eventos pendientes para que el render los muestre; se vacían cada frame. */
  events: SimEvent[];
}

export const storeSize = (state: GameState) => EXPANSIONS[state.expansion];

/** Casilla de la puerta: la esquina inferior de la tienda, que da a la acera. */
export const doorTile = (state: GameState): Point => {
  const { w, h } = storeSize(state);
  return { x: w - 1, y: h - 1 };
};

/** Fila de la acera (justo fuera de la tienda). */
export const sidewalkY = (state: GameState) => storeSize(state).h;

/** Cada caja se atiende desde la casilla de delante (+y). */
export const registerFront = (r: Point): Point => ({ x: r.x, y: r.y + 1 });

export const emptyStats = (): Stats => ({
  sold: 0,
  lost: 0,
  earned: 0,
  tips: 0,
  ordersPlaced: 0,
  vipServed: 0,
  trendSold: 0,
  upgradesBought: 0,
  stylesBought: 0,
  soldByItem: {},
});

export function createInitialState(now: number): GameState {
  return {
    version: SAVE_VERSION,
    time: now,
    coins: 150,
    gems: 3,
    xp: 0,
    level: 1,
    mood: 50,
    expansion: 0,
    displays: [{ id: 1, kind: 'rack', x: 3, y: 2, itemId: null, stock: 0, reserved: 0, order: null }],
    registers: [{ id: 2, x: 7, y: 5, serveTimer: 0 }],
    decor: [],
    floor: 'wood',
    wall: 'cream',
    ownedStyles: ['wood', 'cream'],
    upgrades: {},
    trend: null,
    claimedTasks: [],
    customers: [],
    spawnTimer: 2,
    nextId: 3,
    stats: emptyStats(),
    events: [],
  };
}
