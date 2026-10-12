// Tipos de cliente: cada uno con su ritmo, su paciencia, lo que suele comprar y su aspecto.
import type { DisplayKind } from './catalog';
import type { Rng } from './rng';

export type CustomerKind = 'regular' | 'list' | 'kid' | 'senior' | 'tourist' | 'vip' | 'critic' | 'thief';

export interface ArchetypeDef {
  kind: CustomerKind;
  name: string;
  minLevel: number;
  /** Peso relativo al elegir quién llega. */
  weight: number;
  /** Casillas por segundo. */
  speed: number;
  /** Multiplicador de la paciencia en la cola. */
  patience: number;
  /** Multiplicador de lo que paga. */
  price: number;
  /** Categorías que prefiere (las busca el triple). */
  prefers: DisplayKind[];
  /** Hoja de personajes que usa en el render. */
  sheet: 'customer' | 'kid' | 'senior' | 'tourist' | 'critic' | 'thief';
}

export const ARCHETYPES: Record<CustomerKind, ArchetypeDef> = {
  regular: { kind: 'regular', name: 'Cliente', minLevel: 1, weight: 55, speed: 2.2, patience: 1, price: 1, prefers: [], sheet: 'customer' },
  list: { kind: 'list', name: 'Con lista de la compra', minLevel: 2, weight: 14, speed: 2.2, patience: 1.3, price: 1, prefers: [], sheet: 'customer' },
  kid: { kind: 'kid', name: 'Niño', minLevel: 1, weight: 8, speed: 2.7, patience: 0.7, price: 1, prefers: ['table', 'bakery', 'freezer', 'fruit', 'sports'], sheet: 'kid' },
  senior: { kind: 'senior', name: 'Abuelo', minLevel: 1, weight: 8, speed: 1.4, patience: 1.8, price: 1, prefers: ['fruit', 'veggie', 'bakery', 'cheese', 'butcher'], sheet: 'senior' },
  tourist: { kind: 'tourist', name: 'Turista', minLevel: 3, weight: 6, speed: 1.9, patience: 1, price: 1.5, prefers: ['boutique', 'sports', 'case', 'cheese', 'bakery'], sheet: 'tourist' },
  vip: { kind: 'vip', name: 'VIP', minLevel: 3, weight: 5, speed: 2.2, patience: 0.65, price: 3, prefers: [], sheet: 'customer' },
  critic: { kind: 'critic', name: 'Crítico', minLevel: 4, weight: 1.5, speed: 2, patience: 0.8, price: 1, prefers: [], sheet: 'critic' },
  thief: { kind: 'thief', name: 'Ladrón', minLevel: 3, weight: 1.8, speed: 2.2, patience: 1, price: 0, prefers: [], sheet: 'thief' },
};

/** Velocidad del ladrón cuando huye con el botín. */
export const THIEF_FLEE_SPEED = 3.3;

/** Quién llega: según el nivel, y nunca dos ladrones o dos críticos a la vez. */
export function pickArchetype(level: number, present: Set<CustomerKind>, rng: Rng): CustomerKind {
  const options = Object.values(ARCHETYPES).filter(
    (a) => a.minLevel <= level && !((a.kind === 'thief' || a.kind === 'critic') && present.has(a.kind)),
  );
  let r = rng() * options.reduce((sum, a) => sum + a.weight, 0);
  for (const a of options) {
    r -= a.weight;
    if (r <= 0) return a.kind;
  }
  return 'regular';
}
