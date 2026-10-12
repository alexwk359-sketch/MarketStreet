import { DECOR, ITEMS, itemById } from './catalog';
import { simulateOffline, type OfflineSummary } from './offline';
import type { Rng } from './rng';
import { xpForLevel } from './sim';
import {
  SAVE_VERSION,
  createInitialState,
  emptyStats,
  type Display,
  type GameState,
  type PlacedDecor,
} from './state';

const SAVE_KEY = 'market-street-save';

/** Los clientes son efímeros: no se guardan, y lo que tenían apartado vuelve al estante. */
export function serialize(state: GameState): string {
  const { customers: _c, events: _e, ...rest } = state;
  return JSON.stringify({ ...rest, displays: state.displays.map((d) => ({ ...d, reserved: 0 })) });
}

/** Convierte una partida de la versión 1 (prototipo) al formato actual. */
function migrateV1(data: any): any {
  const nextId = data.nextId ?? 100;
  return {
    ...data,
    version: SAVE_VERSION,
    gems: 3,
    xp: Math.max(data.xp ?? 0, xpForLevel(data.level ?? 1)),
    expansion: 0,
    registers: [{ id: nextId, x: 7, y: 5, serveTimer: 0 }],
    nextId: nextId + 1,
    floor: 'wood',
    wall: 'cream',
    ownedStyles: ['wood', 'cream'],
    upgrades: {},
    trend: null,
    claimedTasks: [],
    stats: { ...emptyStats(), sold: data.stats?.sold ?? 0, lost: data.stats?.lost ?? 0 },
  };
}

export function deserialize(json: string): GameState {
  let data = JSON.parse(json);
  if (data.version === 1) data = migrateV1(data);
  if (data.version !== SAVE_VERSION) throw new Error(`Versión de partida no soportada: ${data.version}`);

  // Partidas antiguas pueden tener artículos o decoración que ya no existen en el catálogo.
  const knownItem = (id: string | null) => id !== null && ITEMS.some((i) => i.id === id);
  const displays = (data.displays as Display[]).map((d) => ({
    ...d,
    reserved: 0,
    ...(knownItem(d.itemId) ? {} : { itemId: null, stock: 0 }),
    order:
      d.order && knownItem(d.order.itemId)
        ? { ...d.order, totalMs: d.order.totalMs ?? itemById(d.order.itemId).deliverySec * 1000 }
        : null,
  }));
  const decor = (data.decor as PlacedDecor[]).filter((d) => DECOR.some((x) => x.id === d.decorId));
  return { ...createInitialState(data.time), ...data, displays, decor, customers: [], events: [] };
}

export interface LoadResult {
  state: GameState;
  offline: OfflineSummary | null;
}

export function loadGame(now: number, rng: Rng): LoadResult {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) {
      const state = deserialize(json);
      const offline = simulateOffline(state, now, rng);
      return { state, offline };
    }
  } catch (err) {
    console.warn('No se pudo cargar la partida, empezando de cero', err);
  }
  return { state: createInitialState(now), offline: null };
}

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch (err) {
    console.warn('No se pudo guardar la partida', err);
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Sin almacenamiento disponible no hay nada que borrar.
  }
}
