// El mundo de fuera: el tiempo que hace y la hora del día. Cambian cuánta gente viene
// y qué busca.
import type { DisplayKind } from './catalog';
import type { Rng } from './rng';
import type { GameState } from './state';

export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'heat' | 'snow';

export interface WeatherDef {
  kind: WeatherKind;
  name: string;
  /** Explicación breve para el jugador. */
  hint: string;
  minLevel: number;
  weight: number;
  /** Multiplicador de clientes. */
  customers: number;
  /** Multiplicador de demanda por categoría. */
  demand: Partial<Record<DisplayKind, number>>;
}

export const WEATHER: Record<WeatherKind, WeatherDef> = {
  sunny: { kind: 'sunny', name: 'Soleado', hint: 'Un día normal.', minLevel: 1, weight: 35, customers: 1, demand: {} },
  cloudy: { kind: 'cloudy', name: 'Nublado', hint: 'Algo menos de gente.', minLevel: 1, weight: 20, customers: 0.95, demand: {} },
  rain: {
    kind: 'rain',
    name: 'Lluvia',
    hint: 'Viene menos gente; se busca ropa y pan, y menos helado.',
    minLevel: 2,
    weight: 20,
    customers: 0.75,
    demand: { rack: 2, bakery: 1.5, fridge: 0.6, freezer: 0.4 },
  },
  heat: {
    kind: 'heat',
    name: 'Ola de calor',
    hint: 'Arrasan los helados, las bebidas y la fruta.',
    minLevel: 2,
    weight: 15,
    customers: 1.1,
    demand: { freezer: 3, fridge: 2.5, fruit: 1.8, sports: 1.5, rack: 0.6 },
  },
  snow: {
    kind: 'snow',
    name: 'Nevada',
    hint: 'Viene poca gente; quieren abrigo, pan y queso.',
    minLevel: 3,
    weight: 10,
    customers: 0.65,
    demand: { rack: 2.2, bakery: 2, cheese: 1.6, butcher: 1.3, freezer: 0.3 },
  },
};

const WEATHER_MIN_MS = 4 * 60_000;
const WEATHER_EXTRA_MS = 2 * 60_000;

export function updateWeather(state: GameState, rng: Rng) {
  if (state.weather && state.time < state.weather.until) return;
  const options = Object.values(WEATHER).filter((w) => w.minLevel <= state.level && w.kind !== state.weather?.kind);
  let r = rng() * options.reduce((sum, w) => sum + w.weight, 0);
  let kind: WeatherKind = 'sunny';
  for (const w of options) {
    r -= w.weight;
    if (r <= 0) {
      kind = w.kind;
      break;
    }
  }
  const first = state.weather === null;
  state.weather = { kind, until: state.time + WEATHER_MIN_MS + rng() * WEATHER_EXTRA_MS };
  if (!first) state.events.push({ type: 'weather', kind });
}

export const weatherOf = (state: GameState) => WEATHER[state.weather?.kind ?? 'sunny'];

// ---------------------------------------------------------------------------
// Día y noche
// ---------------------------------------------------------------------------

/** Un día completo dura 16 minutos de juego. */
export const DAY_MS = 16 * 60_000;

export type DayPeriod = 'morning' | 'day' | 'evening' | 'night';

/** Momento del día entre 0 y 1 (0 = amanecer). */
export const dayPhase = (time: number) => (((time / DAY_MS) % 1) + 1) % 1;

export function dayPeriod(time: number): DayPeriod {
  const p = dayPhase(time);
  if (p < 0.15) return 'morning';
  if (p < 0.55) return 'day';
  if (p < 0.7) return 'evening';
  return 'night';
}

export const PERIODS: Record<DayPeriod, { name: string; customers: number }> = {
  morning: { name: 'Mañana', customers: 0.9 },
  day: { name: 'Mediodía', customers: 1.15 },
  evening: { name: 'Tarde', customers: 1 },
  night: { name: 'Noche', customers: 0.6 },
};

/** Cuánto oscurece (0 de día, 1 en plena noche), con transiciones suaves. */
export function darkness(time: number): number {
  const p = dayPhase(time);
  const ramp = (from: number, to: number) => Math.min(1, Math.max(0, (p - from) / (to - from)));
  if (p < 0.12) return 1 - ramp(0, 0.12); // amanece
  if (p < 0.6) return 0;
  if (p < 0.75) return ramp(0.6, 0.75); // anochece
  return 1;
}

/** Multiplicador de la demanda de una categoría según el tiempo. */
export const weatherDemand = (state: GameState, kind: DisplayKind) => weatherOf(state).demand[kind] ?? 1;

/** Multiplicador de clientes por el tiempo y la hora. */
export const worldCustomers = (state: GameState) => weatherOf(state).customers * PERIODS[dayPeriod(state.time)].customers;
