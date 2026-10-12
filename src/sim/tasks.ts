// La libreta del encargado: objetivos que guían al jugador y dan recompensas.
import { ITEMS, type DisplayKind } from './catalog';
import { addXp, happiness } from './sim';
import type { GameState } from './state';

export interface TaskDef {
  id: string;
  text: string;
  target: number;
  progress: (s: GameState) => number;
  reward: { coins?: number; gems?: number; xp?: number };
  unlockLevel?: number;
}

const sold = (s: GameState) => s.stats.sold;
const displaysOf = (kind: DisplayKind) => (s: GameState) => s.displays.filter((d) => d.kind === kind).length;
/** Unidades vendidas de todos los artículos de un tipo de expositor. */
const soldOf = (kind: DisplayKind) => (s: GameState) =>
  ITEMS.filter((i) => i.display === kind).reduce((sum, i) => sum + (s.stats.soldByItem[i.id] ?? 0), 0);

export const TASKS: TaskDef[] = [
  { id: 'first-order', text: 'Pide mercancía para el perchero', target: 1, progress: (s) => s.stats.ordersPlaced, reward: { coins: 20, xp: 5 } },
  { id: 'sell-5', text: 'Vende 5 artículos', target: 5, progress: sold, reward: { coins: 30, xp: 5 } },
  { id: 'fruit-stand', text: 'Coloca una frutería', target: 1, progress: displaysOf('fruit'), reward: { coins: 40, xp: 5 } },
  { id: 'first-decor', text: 'Decora la tienda', target: 1, progress: (s) => s.decor.length, reward: { coins: 25, gems: 1 } },
  { id: 'sell-tshirt', text: 'Vende 10 camisetas', target: 10, progress: (s) => s.stats.soldByItem.tshirt ?? 0, reward: { coins: 50, xp: 10 } },
  { id: 'sell-fruit', text: 'Vende 15 piezas de fruta', target: 15, progress: soldOf('fruit'), reward: { coins: 60, xp: 10 } },
  { id: 'happy-60', text: 'Llega al 60% de felicidad', target: 60, progress: (s) => Math.round(happiness(s)), reward: { coins: 60, gems: 1 } },
  { id: 'earn-500', text: 'Gana 500 monedas en ventas', target: 500, progress: (s) => s.stats.earned, reward: { coins: 80, xp: 20 } },
  { id: 'upgrade-1', text: 'Compra una mejora', target: 1, progress: (s) => s.stats.upgradesBought, reward: { coins: 100, gems: 1 }, unlockLevel: 2 },
  { id: 'case', text: 'Coloca una vitrina', target: 1, progress: displaysOf('case'), reward: { coins: 100, xp: 20 }, unlockLevel: 2 },
  { id: 'style', text: 'Cambia el suelo o las paredes', target: 1, progress: (s) => s.stats.stylesBought, reward: { coins: 80, gems: 1 }, unlockLevel: 2 },
  { id: 'sell-50', text: 'Vende 50 artículos', target: 50, progress: sold, reward: { coins: 150, xp: 30 } },
  { id: 'vip-1', text: 'Atiende a un cliente VIP', target: 1, progress: (s) => s.stats.vipServed, reward: { coins: 150, gems: 2 }, unlockLevel: 3 },
  { id: 'expand-1', text: 'Amplía la tienda', target: 1, progress: (s) => s.expansion, reward: { coins: 200, gems: 2 }, unlockLevel: 3 },
  { id: 'table', text: 'Coloca una mesa de juguetes', target: 1, progress: displaysOf('table'), reward: { coins: 150, xp: 40 }, unlockLevel: 3 },
  { id: 'trend-10', text: 'Vende 10 artículos en tendencia', target: 10, progress: (s) => s.stats.trendSold, reward: { coins: 200, xp: 40 }, unlockLevel: 3 },
  { id: 'register-2', text: 'Abre una segunda caja', target: 2, progress: (s) => s.registers.length, reward: { coins: 200, gems: 1 }, unlockLevel: 4 },
  { id: 'decor-5', text: 'Ten 5 decoraciones', target: 5, progress: (s) => s.decor.length, reward: { coins: 150, gems: 1 }, unlockLevel: 4 },
  { id: 'tips-100', text: 'Recibe 100 monedas en propinas', target: 100, progress: (s) => s.stats.tips, reward: { coins: 300, xp: 60 }, unlockLevel: 4 },
  { id: 'sell-200', text: 'Vende 200 artículos', target: 200, progress: sold, reward: { coins: 500, gems: 3 }, unlockLevel: 4 },
  { id: 'bakery', text: 'Abre una panadería', target: 1, progress: displaysOf('bakery'), reward: { coins: 200, gems: 1 }, unlockLevel: 3 },
  { id: 'fridge', text: 'Instala una nevera', target: 1, progress: displaysOf('fridge'), reward: { coins: 250, xp: 60 }, unlockLevel: 4 },
  { id: 'cheese', text: 'Abre una quesería', target: 1, progress: displaysOf('cheese'), reward: { coins: 300, gems: 2 }, unlockLevel: 5 },
  { id: 'sell-cheese', text: 'Vende 30 quesos', target: 30, progress: soldOf('cheese'), reward: { coins: 400, xp: 100 }, unlockLevel: 5 },
  { id: 'butcher', text: 'Abre una carnicería', target: 1, progress: displaysOf('butcher'), reward: { coins: 400, gems: 2 }, unlockLevel: 6 },
  { id: 'freezer', text: 'Instala un congelador', target: 1, progress: displaysOf('freezer'), reward: { coins: 500, xp: 150 }, unlockLevel: 7 },
  { id: 'boutique', text: 'Coloca un tocador de accesorios', target: 1, progress: displaysOf('boutique'), reward: { coins: 300, xp: 80 }, unlockLevel: 5 },
  { id: 'happy-90', text: 'Llega al 90% de felicidad', target: 90, progress: (s) => Math.round(happiness(s)), reward: { coins: 400, gems: 2 }, unlockLevel: 5 },
  { id: 'expand-2', text: 'Amplía la tienda otra vez', target: 2, progress: (s) => s.expansion, reward: { coins: 800, gems: 3 }, unlockLevel: 6 },
  { id: 'sports', text: 'Coloca un rincón deportivo', target: 1, progress: displaysOf('sports'), reward: { coins: 500, xp: 150 }, unlockLevel: 7 },
  { id: 'earn-10000', text: 'Gana 10.000 monedas en ventas', target: 10_000, progress: (s) => s.stats.earned, reward: { coins: 1000, gems: 5 }, unlockLevel: 6 },
  { id: 'vip-20', text: 'Atiende a 20 clientes VIP', target: 20, progress: (s) => s.stats.vipServed, reward: { coins: 800, gems: 5 }, unlockLevel: 6 },
  { id: 'sell-1000', text: 'Vende 1.000 artículos', target: 1000, progress: sold, reward: { coins: 2000, gems: 10 }, unlockLevel: 8 },
  { id: 'expand-3', text: 'Ten la tienda más grande de la calle', target: 3, progress: (s) => s.expansion, reward: { coins: 3000, gems: 10 }, unlockLevel: 9 },
];

const ACTIVE_COUNT = 3;

/** Las próximas tareas sin reclamar que el nivel permite. */
export const activeTasks = (s: GameState) =>
  TASKS.filter((t) => !s.claimedTasks.includes(t.id) && (t.unlockLevel ?? 1) <= s.level).slice(0, ACTIVE_COUNT);

export const isTaskDone = (s: GameState, t: TaskDef) => t.progress(s) >= t.target;

export const claimableCount = (s: GameState) => activeTasks(s).filter((t) => isTaskDone(s, t)).length;

export function claimTask(s: GameState, id: string): boolean {
  const task = activeTasks(s).find((t) => t.id === id);
  if (!task || !isTaskDone(s, task)) return false;
  s.claimedTasks.push(id);
  s.coins += task.reward.coins ?? 0;
  s.gems += task.reward.gems ?? 0;
  if (task.reward.xp) addXp(s, task.reward.xp);
  return true;
}
