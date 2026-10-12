import { DECOR, DISPLAYS, ITEMS, decorById, itemById, type DisplayKind } from './catalog';
import type { Rng } from './rng';
import {
  ENTRANCE,
  GRID_H,
  GRID_W,
  REGISTER,
  RESERVED_TILES,
  type Customer,
  type Display,
  type GameState,
} from './state';

export type ActionResult = { ok: true } | { ok: false; error: string };

const WALK_SPEED = 2.2; // casillas por segundo
const BROWSE_SEC = 1.2;
const SERVE_SEC = 1.5;
const COMPLAIN_SEC = 1.5;
const MAX_CUSTOMERS = 10;
const MAX_DECOR_BONUS = 40;
const LOST_MOOD_PENALTY = 4;
const SALE_MOOD_BONUS = 1;

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** XP total necesaria para alcanzar `level`. */
export const xpForLevel = (level: number) => 10 * level * (level - 1);

export const maxDisplays = (level: number) => level + 1;

export function happiness(state: GameState): number {
  const decorBonus = state.decor.reduce((sum, d) => sum + decorById(d.decorId).happiness, 0);
  return clamp(state.mood + Math.min(MAX_DECOR_BONUS, decorBonus), 0, 100);
}

/** Segundos entre clientes: más felicidad, más clientela. */
export const spawnInterval = (state: GameState) => 9 - 5 * (happiness(state) / 100);

export const available = (d: Display) => d.stock - d.reserved;

export function isTileFree(state: GameState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
  if (RESERVED_TILES.some((t) => t.x === x && t.y === y)) return false;
  if (state.displays.some((d) => d.x === x && d.y === y)) return false;
  return !state.decor.some((d) => d.x === x && d.y === y);
}

export const unlockedItems = (level: number) => ITEMS.filter((i) => i.unlockLevel <= level);

// ---------------------------------------------------------------------------
// Acciones del jugador
// ---------------------------------------------------------------------------

export function buyDisplay(state: GameState, kind: DisplayKind, x: number, y: number): ActionResult {
  const def = DISPLAYS[kind];
  if (def.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${def.unlockLevel}`);
  if (state.displays.length >= maxDisplays(state.level)) return fail('Sube de nivel para tener más expositores');
  if (state.coins < def.price) return fail('No tienes suficientes monedas');
  if (!isTileFree(state, x, y)) return fail('Esa casilla no está libre');
  state.coins -= def.price;
  state.displays.push({ id: state.nextId++, kind, x, y, itemId: null, stock: 0, reserved: 0, order: null });
  return ok;
}

export function buyDecor(state: GameState, decorId: string, x: number, y: number): ActionResult {
  const def = DECOR.find((d) => d.id === decorId);
  if (!def) return fail('Decoración desconocida');
  if (def.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${def.unlockLevel}`);
  if (state.coins < def.price) return fail('No tienes suficientes monedas');
  if (!isTileFree(state, x, y)) return fail('Esa casilla no está libre');
  state.coins -= def.price;
  state.decor.push({ id: state.nextId++, decorId, x, y });
  return ok;
}

export function orderStock(state: GameState, displayId: number, itemId: string): ActionResult {
  const display = state.displays.find((d) => d.id === displayId);
  if (!display) return fail('Expositor no encontrado');
  const item = itemById(itemId);
  if (item.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${item.unlockLevel}`);
  if (item.display !== display.kind) return fail(`${item.name} necesita: ${DISPLAYS[item.display].name}`);
  if (display.order) return fail('Ya hay un pedido en camino');
  if (display.stock > 0 && display.itemId !== itemId) return fail('Vende primero lo que hay en el expositor');
  if (display.stock + item.batchSize > DISPLAYS[display.kind].capacity) return fail('No cabe más en el expositor');
  if (state.coins < item.batchCost) return fail('No tienes suficientes monedas');
  state.coins -= item.batchCost;
  display.order = { itemId, readyAt: state.time + item.deliverySec * 1000 };
  return ok;
}

// ---------------------------------------------------------------------------
// Simulación
// ---------------------------------------------------------------------------

export function tick(state: GameState, dtMs: number, rng: Rng): void {
  state.time += dtMs;
  const dt = dtMs / 1000;
  updateDeliveries(state);
  updateSpawning(state, dt, rng);
  for (const c of [...state.customers]) updateCustomer(state, c, dt);
  updateRegister(state, dt);
}

function updateDeliveries(state: GameState) {
  for (const d of state.displays) {
    if (!d.order || state.time < d.order.readyAt) continue;
    const item = itemById(d.order.itemId);
    d.itemId = item.id;
    d.stock = Math.min(DISPLAYS[d.kind].capacity, d.stock + item.batchSize);
    d.order = null;
    state.events.push({ type: 'delivered', displayId: d.id, itemId: item.id });
  }
}

function updateSpawning(state: GameState, dt: number, rng: Rng) {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = spawnInterval(state) * (0.75 + rng() * 0.5);
  if (state.displays.length === 0 || state.customers.length >= MAX_CUSTOMERS) return;
  spawnCustomer(state, rng);
}

export function spawnCustomer(state: GameState, rng: Rng): Customer {
  // La mayoría busca algo que ya se vende; el resto pide cualquier cosa del
  // catálogo, así que la variedad y los estantes llenos se recompensan.
  const stocked = [...new Set(state.displays.filter((d) => available(d) > 0).map((d) => d.itemId!))];
  const pool = stocked.length > 0 && rng() < 0.7 ? stocked : unlockedItems(state.level).map((i) => i.id);
  const itemId = pool[Math.floor(rng() * pool.length)];

  const customer: Customer = {
    id: state.nextId++,
    x: ENTRANCE.x,
    y: ENTRANCE.y,
    tx: ENTRANCE.x,
    ty: ENTRANCE.y,
    state: 'lost',
    itemId,
    displayId: null,
    carrying: false,
    timer: COMPLAIN_SEC,
    look: Math.floor(rng() * 1000),
  };

  const candidates = state.displays.filter((d) => d.itemId === itemId && available(d) > 0);
  if (candidates.length > 0) {
    const display = candidates[Math.floor(rng() * candidates.length)];
    display.reserved++;
    customer.state = 'toDisplay';
    customer.displayId = display.id;
    setTarget(customer, display.x, display.y + 0.75);
  } else {
    setTarget(customer, 2 + rng() * 5, 3 + rng() * 3);
  }
  state.customers.push(customer);
  return customer;
}

function setTarget(c: Customer, x: number, y: number) {
  c.tx = x;
  c.ty = y;
}

/** Avanza hacia el objetivo; devuelve true si ya ha llegado. */
function walk(c: Customer, dt: number): boolean {
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const dist = Math.hypot(dx, dy);
  const step = WALK_SPEED * dt;
  if (dist <= step) {
    c.x = c.tx;
    c.y = c.ty;
    return true;
  }
  c.x += (dx / dist) * step;
  c.y += (dy / dist) * step;
  return false;
}

const queueSlot = (index: number) => ({ x: REGISTER.x + index * 0.75, y: REGISTER.y + 1 });

function updateCustomer(state: GameState, c: Customer, dt: number) {
  const arrived = walk(c, dt);
  switch (c.state) {
    case 'toDisplay':
      if (arrived) {
        c.state = 'browsing';
        c.timer = BROWSE_SEC;
      }
      break;
    case 'browsing': {
      c.timer -= dt;
      if (c.timer > 0) break;
      const display = state.displays.find((d) => d.id === c.displayId)!;
      display.stock--;
      display.reserved--;
      c.carrying = true;
      c.state = 'queue';
      state.events.push({ type: 'pickup', displayId: display.id, customerId: c.id, itemId: c.itemId });
      state.queue.push(c.id);
      break;
    }
    case 'queue': {
      const slot = queueSlot(state.queue.indexOf(c.id));
      setTarget(c, slot.x, slot.y);
      break;
    }
    case 'lost':
      if (!arrived) break;
      c.timer -= dt;
      if (c.timer > 0) break;
      state.mood = clamp(state.mood - LOST_MOOD_PENALTY, 0, 100);
      state.stats.lost++;
      state.events.push({ type: 'unhappy', x: c.x, y: c.y });
      leave(c);
      break;
    case 'leaving':
      if (arrived) state.customers = state.customers.filter((o) => o.id !== c.id);
      break;
  }
}

function leave(c: Customer) {
  c.state = 'leaving';
  setTarget(c, ENTRANCE.x, ENTRANCE.y);
}

function updateRegister(state: GameState, dt: number) {
  const head = state.customers.find((c) => c.id === state.queue[0]);
  if (!head || head.x !== head.tx || head.y !== head.ty) {
    state.serveTimer = 0;
    return;
  }
  state.serveTimer += dt;
  if (state.serveTimer < SERVE_SEC) return;
  state.serveTimer = 0;
  state.queue.shift();

  const item = itemById(head.itemId);
  state.coins += item.salePrice;
  state.mood = clamp(state.mood + SALE_MOOD_BONUS, 0, 100);
  state.stats.sold++;
  state.events.push({ type: 'sale', amount: item.salePrice, x: head.x, y: head.y });
  addXp(state, item.xp);
  head.carrying = false;
  leave(head);
}

export function addXp(state: GameState, amount: number) {
  state.xp += amount;
  while (state.xp >= xpForLevel(state.level + 1)) {
    state.level++;
    state.events.push({ type: 'levelUp', level: state.level });
  }
}
