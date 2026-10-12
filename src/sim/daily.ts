// Premio por jugar días seguidos (días reales del calendario, no del juego).
import type { GameState } from './state';

/** Premios de una semana de racha; después vuelve a empezar el ciclo. */
export const DAILY_REWARDS = [
  { coins: 100, gems: 0 },
  { coins: 150, gems: 1 },
  { coins: 200, gems: 1 },
  { coins: 300, gems: 2 },
  { coins: 400, gems: 2 },
  { coins: 500, gems: 3 },
  { coins: 800, gems: 5 },
];

/** Las monedas escalan con el nivel para que el premio siga mereciendo la pena. */
export function dailyReward(streakDay: number, level: number) {
  const base = DAILY_REWARDS[(streakDay - 1) % DAILY_REWARDS.length];
  return { coins: Math.round(base.coins * (1 + (level - 1) * 0.5)), gems: base.gems };
}

/** ¿Hay premio hoy? Y si lo hay, qué día de la racha sería (1 = empieza de nuevo). */
export function dailyStatus(state: GameState, today: string, yesterday: string) {
  const { lastClaim, streak } = state.daily;
  if (lastClaim === today) return { available: false, streakDay: streak };
  const streakDay = lastClaim === yesterday ? streak + 1 : 1;
  return { available: true, streakDay };
}

export function claimDaily(state: GameState, today: string, yesterday: string) {
  const status = dailyStatus(state, today, yesterday);
  if (!status.available) return null;
  const reward = dailyReward(status.streakDay, state.level);
  state.coins += reward.coins;
  state.gems += reward.gems;
  state.daily = { lastClaim: today, streak: status.streakDay };
  return reward;
}

/** Fecha local en formato AAAA-MM-DD. */
export function localDate(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
