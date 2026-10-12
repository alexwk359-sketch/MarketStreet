// Lo que pasa mientras el jugador no está: llegan los pedidos y la tienda sigue
// vendiendo, a medio ritmo, lo que haya en los expositores.
import { itemById } from './catalog';
import type { Rng } from './rng';
import { addXp, autoRestock, salePrice, spawnInterval, updateDeliveries } from './sim';
import type { GameState } from './state';

const MAX_OFFLINE_MS = 4 * 3600_000;
const STEP_MS = 60_000;
const OFFLINE_EFFICIENCY = 0.5;

export interface OfflineSummary {
  minutes: number;
  sold: number;
  coins: number;
}

export function simulateOffline(state: GameState, now: number, rng: Rng): OfflineSummary {
  const elapsed = Math.min(Math.max(0, now - state.time), MAX_OFFLINE_MS);
  const summary: OfflineSummary = { minutes: Math.floor(elapsed / 60_000), sold: 0, coins: 0 };
  let remaining = elapsed;
  while (remaining > 0) {
    const step = Math.min(STEP_MS, remaining);
    remaining -= step;
    state.time += step;
    updateDeliveries(state);
    autoRestock(state);
    let buyers = ((step / 1000) / spawnInterval(state)) * OFFLINE_EFFICIENCY;
    // Parte fraccionaria: se resuelve al azar para no perder ventas en pasos cortos.
    buyers = Math.floor(buyers) + (rng() < buyers % 1 ? 1 : 0);
    for (let i = 0; i < buyers; i++) {
      const stocked = state.displays.filter((d) => d.stock - d.reserved > 0 && d.itemId);
      if (stocked.length === 0) break;
      const d = stocked[Math.floor(rng() * stocked.length)];
      const item = itemById(d.itemId!);
      const price = salePrice(state, item);
      d.stock--;
      state.coins += price;
      state.stats.sold++;
      state.stats.earned += price;
      state.stats.soldByItem[item.id] = (state.stats.soldByItem[item.id] ?? 0) + 1;
      addXp(state, item.xp);
      summary.sold++;
      summary.coins += price;
    }
  }
  // Si estuvo fuera más del máximo, el reloj salta hasta ahora sin más ventas.
  state.time = Math.max(state.time, now);
  updateDeliveries(state);
  // Los eventos de entregas y pedidos automáticos no tienen sentido al volver; los de subir de nivel sí.
  state.events = state.events.filter((e) => e.type === 'levelUp');
  return summary;
}
