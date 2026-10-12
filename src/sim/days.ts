// Días de juego (16 minutos): al amanecer se cierra el día anterior con un resumen.
import type { GameState } from './state';
import { DAY_MS } from './world';
import type { DayStart, DaySummary } from './state';

const HISTORY_DAYS = 14;

export const dayIndex = (time: number) => Math.floor(time / DAY_MS);

function snapshot(state: GameState, day: number): DayStart {
  const s = state.stats;
  return {
    day,
    sold: s.sold,
    earned: s.earned,
    tips: s.tips,
    lost: s.lost,
    ordersDone: s.ordersDone,
    thievesCaught: s.thievesCaught,
    soldByItem: { ...s.soldByItem },
  };
}

/** Lo que ha pasado desde `start` hasta ahora. */
export function summarize(state: GameState, start: DayStart, day: number): DaySummary {
  const s = state.stats;
  let best: DaySummary['best'] = null;
  for (const [itemId, total] of Object.entries(s.soldByItem)) {
    const count = total - (start.soldByItem[itemId] ?? 0);
    if (count > 0 && (!best || count > best.count)) best = { itemId, count };
  }
  return {
    day,
    sold: s.sold - start.sold,
    earned: s.earned - start.earned,
    tips: s.tips - start.tips,
    lost: s.lost - start.lost,
    ordersDone: s.ordersDone - start.ordersDone,
    thievesCaught: s.thievesCaught - start.thievesCaught,
    best,
  };
}

export function updateDay(state: GameState) {
  const day = dayIndex(state.time);
  if (!state.dayStart) {
    state.dayStart = snapshot(state, day);
    return;
  }
  if (day === state.dayStart.day) return;
  // Solo se resume el día que acaba de terminar jugando; si se saltan varios (sin jugar), no.
  if (day === state.dayStart.day + 1) {
    state.stats.daysClosed++;
    const summary = summarize(state, state.dayStart, state.stats.daysClosed);
    state.history = [...state.history, summary].slice(-HISTORY_DAYS);
    state.events.push({ type: 'dayEnd', summary });
  }
  state.dayStart = snapshot(state, day);
}

/** El día en curso, para el panel de estadísticas. */
export const todaySoFar = (state: GameState): DaySummary | null =>
  state.dayStart ? summarize(state, state.dayStart, state.stats.daysClosed + 1) : null;
