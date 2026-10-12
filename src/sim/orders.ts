// Encargos especiales: alguien del barrio pide muchas unidades de un artículo con plazo.
import { DISPLAYS, itemById } from './catalog';
import type { Rng } from './rng';
import { addXp, available, salePrice, unlockedItems, type ActionResult } from './sim';
import type { GameState } from './state';

export interface SpecialOrder {
  id: number;
  client: string;
  itemId: string;
  qty: number;
  reward: { coins: number; gems: number; xp: number };
  expiresAt: number;
}

const CLIENTS = [
  'El colegio del barrio',
  'Un restaurante',
  'La fiesta de la calle',
  'Un hotel',
  'El club deportivo',
  'Una boda',
  'La oficina de enfrente',
  'El hospital',
  'Un campamento de verano',
];

const ORDER_MS = 6 * 60_000;
const FIRST_ORDER_DELAY_MS = 60_000;
const BETWEEN_ORDERS_MS = 3 * 60_000;

/** Unidades del artículo del encargo que hay ahora mismo en los estantes. */
export const orderStockAvailable = (state: GameState, itemId: string) =>
  state.displays.filter((d) => d.itemId === itemId).reduce((sum, d) => sum + Math.max(0, available(d)), 0);

export function updateOrders(state: GameState, rng: Rng) {
  if (state.level < 2) return;
  const order = state.specialOrder;
  if (order && state.time >= order.expiresAt) {
    state.specialOrder = null;
    state.nextOrderAt = state.time + BETWEEN_ORDERS_MS;
    state.events.push({ type: 'orderExpired' });
    return;
  }
  if (order) return;
  if (state.nextOrderAt === 0) state.nextOrderAt = state.time + FIRST_ORDER_DELAY_MS;
  if (state.time < state.nextOrderAt) return;

  // Algo de lo que la tienda puede vender (tiene el mueble), para que sea posible cumplirlo.
  const owned = new Set(state.displays.map((d) => d.kind));
  const candidates = unlockedItems(state.level).filter((i) => owned.has(i.display));
  if (candidates.length === 0) return;
  const item = candidates[Math.floor(rng() * candidates.length)];
  const qty = Math.max(4, Math.round(item.batchSize * (1 + rng() * 1.5)));
  state.specialOrder = {
    id: state.nextId++,
    client: CLIENTS[Math.floor(rng() * CLIENTS.length)],
    itemId: item.id,
    qty: Math.min(qty, DISPLAYS[item.display].capacity),
    reward: {
      coins: Math.round(qty * salePrice(state, item) * 2),
      gems: rng() < 0.35 ? 2 : 1,
      xp: qty * item.xp,
    },
    expiresAt: state.time + ORDER_MS,
  };
  state.events.push({ type: 'orderNew' });
}

/** Entrega el encargo con lo que hay en los estantes. */
export function fulfillOrder(state: GameState): ActionResult {
  const order = state.specialOrder;
  if (!order) return { ok: false, error: 'No hay ningún encargo' };
  const have = orderStockAvailable(state, order.itemId);
  if (have < order.qty) {
    return { ok: false, error: `Te faltan ${order.qty - have} ${itemById(order.itemId).name.toLowerCase()} en los estantes` };
  }
  let left = order.qty;
  for (const d of state.displays) {
    if (d.itemId !== order.itemId || left === 0) continue;
    const take = Math.min(left, Math.max(0, available(d)));
    d.stock -= take;
    left -= take;
  }
  state.coins += order.reward.coins;
  state.gems += order.reward.gems;
  addXp(state, order.reward.xp);
  state.stats.ordersDone++;
  state.specialOrder = null;
  state.nextOrderAt = state.time + BETWEEN_ORDERS_MS;
  state.events.push({ type: 'orderDone', coins: order.reward.coins });
  return { ok: true };
}

export function declineOrder(state: GameState) {
  state.specialOrder = null;
  state.nextOrderAt = state.time + BETWEEN_ORDERS_MS;
}
