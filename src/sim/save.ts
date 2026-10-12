import { DECOR, ITEMS } from './catalog';
import { createInitialState, type Display, type GameState, type PlacedDecor } from './state';

const SAVE_KEY = 'market-street-save';

/** Los clientes son efímeros: no se guardan, y lo que tenían apartado vuelve al estante. */
export function serialize(state: GameState): string {
  const { customers: _c, queue: _q, events: _e, ...rest } = state;
  return JSON.stringify({ ...rest, displays: state.displays.map((d) => ({ ...d, reserved: 0 })) });
}

export function deserialize(json: string, now: number): GameState {
  const data = JSON.parse(json);
  if (data.version !== 1) throw new Error(`Versión de partida no soportada: ${data.version}`);
  // Partidas antiguas pueden tener artículos o decoración que ya no existen en el catálogo.
  const knownItem = (id: string | null) => id !== null && ITEMS.some((i) => i.id === id);
  const displays = (data.displays as Display[]).map((d) => ({
    ...d,
    ...(knownItem(d.itemId) ? {} : { itemId: null, stock: 0 }),
    order: d.order && knownItem(d.order.itemId) ? d.order : null,
  }));
  const decor = (data.decor as PlacedDecor[]).filter((d) => DECOR.some((x) => x.id === d.decorId));
  // El reloj avanza hasta "ahora" para que los pedidos lleguen aunque no estuvieras jugando.
  return { ...data, displays, decor, time: Math.max(data.time, now), customers: [], queue: [], events: [], serveTimer: 0 };
}

export function loadGame(now: number): GameState {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) return deserialize(json, now);
  } catch (err) {
    console.warn('No se pudo cargar la partida, empezando de cero', err);
  }
  return createInitialState(now);
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
