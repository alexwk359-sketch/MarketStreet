import {
  DECOR,
  DISPLAYS,
  EXPANSIONS,
  FLOORS,
  ITEMS,
  REGISTERS,
  UPGRADES,
  WALLS,
  decorById,
  itemById,
  type DisplayKind,
  type ItemDef,
  type UpgradeId,
} from './catalog';
import {
  accessTiles,
  blockedTiles,
  findPath,
  placementError,
  reachableFromDoor,
  type FurnitureRef,
} from './path';
import type { Rng } from './rng';
import {
  doorTile,
  registerFront,
  sidewalkY,
  storeSize,
  type Customer,
  type Display,
  type GameState,
  type Point,
  type Register,
} from './state';

export type ActionResult = { ok: true } | { ok: false; error: string };

const WALK_SPEED = 2.2; // casillas por segundo
const BROWSE_SEC = 1.2;
const COMPLAIN_SEC = 1.5;
const PATIENCE_SEC = 35;
const VIP_PATIENCE_SEC = 22;
const MAX_CUSTOMERS = 14;
const MAX_DECOR_BONUS = 40;
const LOST_MOOD_PENALTY = 2;
const QUEUE_MOOD_PENALTY = 3;
const SALE_MOOD_BONUS = 1;
const VIP_CHANCE = 0.06;
const VIP_PRICE_MULTIPLIER = 3;
const TREND_BONUS = 0.25;
const TREND_MS = 4 * 60_000;
const TIP_HAPPINESS = 70;
const SELL_REFUND = 0.5;
/** Desplazamiento hacia el mueble al pararse delante, para que se vea que lo miran. */
const LEAN = 0.3;

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * XP total necesaria para alcanzar `level`. Cada nivel pide un 60% más que el anterior:
 * crece algo más rápido que lo que se gana por venta, así cada nivel cuesta un poco más.
 */
export const xpForLevel = (level: number) => (level <= 1 ? 0 : Math.round((50 * (Math.pow(1.6, level - 1) - 1)) / 0.6));

export const maxDisplays = (level: number) => level + 2;
export const maxRegisters = (level: number) => REGISTERS.filter((r) => r.unlockLevel <= level).length;
export const upgradeLevel = (state: GameState, id: UpgradeId) => state.upgrades[id] ?? 0;

export const capacity = (state: GameState, kind: DisplayKind) =>
  Math.round(DISPLAYS[kind].capacity * (1 + 0.25 * upgradeLevel(state, 'storage')));

export const serveSeconds = (state: GameState) => [1.6, 1.2, 0.9, 0.8][upgradeLevel(state, 'cashier')];

export const deliveryMs = (state: GameState, item: ItemDef) =>
  Math.round(item.deliverySec * 1000 * (1 - 0.2 * upgradeLevel(state, 'express')));

export const decorHappiness = (state: GameState) =>
  Math.min(MAX_DECOR_BONUS, state.decor.reduce((sum, d) => sum + decorById(d.decorId).happiness, 0));

export const happiness = (state: GameState) =>
  clamp(state.mood + decorHappiness(state) + 5 * upgradeLevel(state, 'music'), 0, 100);

/** Segundos entre clientes: más felicidad y publicidad, más clientela. */
export const spawnInterval = (state: GameState) =>
  (9 - 5 * (happiness(state) / 100)) / (1 + 0.2 * upgradeLevel(state, 'ads'));

export const isTrending = (state: GameState, item: ItemDef) => state.trend?.kind === item.display;

export const salePrice = (state: GameState, item: ItemDef) =>
  Math.round(item.salePrice * (isTrending(state, item) ? 1 + TREND_BONUS : 1));

export const available = (d: Display) => d.stock - d.reserved;

export const unlockedItems = (level: number) => ITEMS.filter((i) => i.unlockLevel <= level);

/** Diamantes para que un pedido llegue ya: 1 por cada 2 minutos que falten. */
export const rushCost = (state: GameState, d: Display) =>
  d.order ? Math.max(1, Math.ceil((d.order.readyAt - state.time) / 120_000)) : 0;

export const registerPrice = (state: GameState) => REGISTERS[state.registers.length]?.price ?? Infinity;

const displayById = (state: GameState, id: number | null) => state.displays.find((d) => d.id === id);
const registerById = (state: GameState, id: number | null) => state.registers.find((r) => r.id === id);

// ---------------------------------------------------------------------------
// Acciones del jugador
// ---------------------------------------------------------------------------

function spend(state: GameState, price: number, gems = false): ActionResult {
  if (gems ? state.gems < price : state.coins < price) return fail(gems ? 'No tienes suficientes diamantes' : 'No tienes suficientes monedas');
  if (gems) state.gems -= price;
  else state.coins -= price;
  return ok;
}

export function buyDisplay(state: GameState, kind: DisplayKind, x: number, y: number): ActionResult {
  const def = DISPLAYS[kind];
  if (def.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${def.unlockLevel}`);
  if (state.displays.length >= maxDisplays(state.level)) return fail('Sube de nivel para tener más expositores');
  if (state.coins < def.price) return fail('No tienes suficientes monedas');
  const error = placementError(state, 'display', x, y);
  if (error) return fail(error);
  spend(state, def.price);
  state.displays.push({ id: state.nextId++, kind, x, y, itemId: null, stock: 0, reserved: 0, order: null });
  return ok;
}

export function buyRegister(state: GameState, x: number, y: number): ActionResult {
  if (state.registers.length >= maxRegisters(state.level)) {
    const next = REGISTERS[state.registers.length];
    return fail(next ? `Otra caja se desbloquea en el nivel ${next.unlockLevel}` : 'Ya tienes todas las cajas');
  }
  const price = registerPrice(state);
  if (state.coins < price) return fail('No tienes suficientes monedas');
  const error = placementError(state, 'register', x, y);
  if (error) return fail(error);
  spend(state, price);
  state.registers.push({ id: state.nextId++, x, y, serveTimer: 0 });
  return ok;
}

export function buyDecor(state: GameState, decorId: string, x: number, y: number): ActionResult {
  const def = DECOR.find((d) => d.id === decorId);
  if (!def) return fail('Decoración desconocida');
  if (def.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${def.unlockLevel}`);
  if (def.gems ? state.gems < def.price : state.coins < def.price) {
    return fail(def.gems ? 'No tienes suficientes diamantes' : 'No tienes suficientes monedas');
  }
  const error = placementError(state, 'decor', x, y, { decorId });
  if (error) return fail(error);
  spend(state, def.price, def.gems);
  state.decor.push({ id: state.nextId++, decorId, x, y });
  return ok;
}

function furniture(state: GameState, ref: FurnitureRef): Point | undefined {
  if (ref.kind === 'display') return displayById(state, ref.id);
  if (ref.kind === 'register') return registerById(state, ref.id);
  return state.decor.find((d) => d.id === ref.id);
}

export function moveFurniture(state: GameState, ref: FurnitureRef, x: number, y: number): ActionResult {
  const target = furniture(state, ref);
  if (!target) return fail('No se encuentra el mueble');
  if (target.x === x && target.y === y) return ok;
  const decorId = ref.kind === 'decor' ? state.decor.find((d) => d.id === ref.id)!.decorId : undefined;
  const error = placementError(state, ref.kind, x, y, { moving: ref, decorId });
  if (error) return fail(error);
  target.x = x;
  target.y = y;
  return ok;
}

/** Cuánto devuelve vender un mueble (la mitad de su precio en monedas). */
export function sellValue(state: GameState, ref: FurnitureRef): number {
  if (ref.kind === 'display') {
    const d = displayById(state, ref.id);
    return d ? Math.floor(DISPLAYS[d.kind].price * SELL_REFUND) : 0;
  }
  if (ref.kind === 'register') return Math.floor(250 * SELL_REFUND);
  const decor = state.decor.find((d) => d.id === ref.id);
  if (!decor) return 0;
  const def = decorById(decor.decorId);
  return def.gems ? 0 : Math.floor(def.price * SELL_REFUND);
}

export function sellFurniture(state: GameState, ref: FurnitureRef): ActionResult {
  const target = furniture(state, ref);
  if (!target) return fail('No se encuentra el mueble');
  if (ref.kind === 'register' && state.registers.length <= 1) return fail('Necesitas al menos una caja');
  if (ref.kind === 'display' && state.displays.length <= 1) return fail('Necesitas al menos un expositor');
  state.coins += sellValue(state, ref);
  if (ref.kind === 'display') {
    state.displays = state.displays.filter((d) => d.id !== ref.id);
    // Quien iba a por algo de ese expositor se da la vuelta sin enfadarse.
    for (const c of state.customers) if (c.state === 'toDisplay' && c.displayId === ref.id) leave(state, c);
  } else if (ref.kind === 'register') {
    state.registers = state.registers.filter((r) => r.id !== ref.id);
    for (const c of state.customers) if (c.registerId === ref.id) c.registerId = shortestQueue(state).id;
  } else {
    state.decor = state.decor.filter((d) => d.id !== ref.id);
  }
  return ok;
}

export function orderStock(state: GameState, displayId: number, itemId: string): ActionResult {
  const display = displayById(state, displayId);
  if (!display) return fail('Expositor no encontrado');
  const item = itemById(itemId);
  if (item.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${item.unlockLevel}`);
  if (item.display !== display.kind) return fail(`${item.name} necesita: ${DISPLAYS[item.display].name}`);
  if (display.order) return fail('Ya hay un pedido en camino');
  if (display.stock > 0 && display.itemId !== itemId) return fail('Vende primero lo que hay en el expositor');
  if (display.stock + item.batchSize > capacity(state, display.kind)) return fail('No cabe más en el expositor');
  const paid = spend(state, item.batchCost);
  if (!paid.ok) return paid;
  const totalMs = deliveryMs(state, item);
  display.order = { itemId, readyAt: state.time + totalMs, totalMs };
  state.stats.ordersPlaced++;
  return ok;
}

export function rushOrder(state: GameState, displayId: number): ActionResult {
  const display = displayById(state, displayId);
  if (!display?.order) return fail('No hay ningún pedido en camino');
  const paid = spend(state, rushCost(state, display), true);
  if (!paid.ok) return paid;
  display.order.readyAt = state.time;
  return ok;
}

export function buyUpgrade(state: GameState, id: UpgradeId): ActionResult {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return fail('Mejora desconocida');
  const current = upgradeLevel(state, id);
  if (current >= def.costs.length) return fail('Ya tienes esta mejora al máximo');
  if (def.levels[current] > state.level) return fail(`Se desbloquea en el nivel ${def.levels[current]}`);
  const paid = spend(state, def.costs[current]);
  if (!paid.ok) return paid;
  state.upgrades[id] = current + 1;
  state.stats.upgradesBought++;
  return ok;
}

export function buyExpansion(state: GameState): ActionResult {
  const next = EXPANSIONS[state.expansion + 1];
  if (!next) return fail('La tienda ya tiene el tamaño máximo');
  if (next.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${next.unlockLevel}`);
  const paid = spend(state, next.price);
  if (!paid.ok) return paid;
  state.expansion++;
  // La puerta se mueve a la nueva esquina: quien estaba dentro sigue su camino desde donde está.
  for (const c of state.customers) if (c.state === 'leaving') leave(state, c);
  return ok;
}

/** Aplica un suelo o pared; si no se tiene, lo compra. */
export function useStyle(state: GameState, id: string): ActionResult {
  const floor = FLOORS.find((s) => s.id === id);
  const def = floor ?? WALLS.find((s) => s.id === id);
  if (!def) return fail('Estilo desconocido');
  if (!state.ownedStyles.includes(id)) {
    if (def.unlockLevel > state.level) return fail(`Se desbloquea en el nivel ${def.unlockLevel}`);
    const paid = spend(state, def.price);
    if (!paid.ok) return paid;
    state.ownedStyles.push(id);
    state.stats.stylesBought++;
  }
  if (floor) state.floor = id;
  else state.wall = id;
  return ok;
}

export function addXp(state: GameState, amount: number) {
  state.xp += amount;
  while (state.xp >= xpForLevel(state.level + 1)) {
    state.level++;
    state.gems += 2;
    state.events.push({ type: 'levelUp', level: state.level });
  }
}

// ---------------------------------------------------------------------------
// Simulación
// ---------------------------------------------------------------------------

export function tick(state: GameState, dtMs: number, rng: Rng): void {
  state.time += dtMs;
  const dt = dtMs / 1000;
  updateDeliveries(state);
  updateTrend(state, rng);
  updateSpawning(state, dt, rng);
  const queues = buildQueues(state);
  for (const c of [...state.customers]) updateCustomer(state, c, dt, queues);
  updateRegisters(state, dt, queues, rng);
  autoRestock(state);
}

export function updateDeliveries(state: GameState) {
  for (const d of state.displays) {
    if (!d.order || state.time < d.order.readyAt) continue;
    const item = itemById(d.order.itemId);
    d.itemId = item.id;
    d.stock = Math.min(capacity(state, d.kind), d.stock + item.batchSize);
    d.order = null;
    state.events.push({ type: 'delivered', displayId: d.id, itemId: item.id });
  }
}

/** Con el reponedor contratado, se repite el pedido en cuanto cabe otro lote en el expositor. */
export function autoRestock(state: GameState) {
  if (upgradeLevel(state, 'stocker') === 0) return;
  for (const d of state.displays) {
    if (d.order || !d.itemId) continue;
    if (d.stock + itemById(d.itemId).batchSize > capacity(state, d.kind)) continue;
    if (orderStock(state, d.id, d.itemId).ok) state.events.push({ type: 'autoOrder', displayId: d.id, itemId: d.itemId });
  }
}

function updateTrend(state: GameState, rng: Rng) {
  if (state.level < 2) return;
  if (state.trend && state.time < state.trend.until) return;
  const owned = [...new Set(state.displays.map((d) => d.kind))];
  const kinds = owned.length > 1 ? owned.filter((k) => k !== state.trend?.kind) : owned;
  if (kinds.length === 0) return;
  const kind = pick(kinds, rng);
  state.trend = { kind, until: state.time + TREND_MS };
  state.events.push({ type: 'trend', kind });
}

function updateSpawning(state: GameState, dt: number, rng: Rng) {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = spawnInterval(state) * (0.75 + rng() * 0.5);
  if (state.customers.length >= MAX_CUSTOMERS) return;
  spawnCustomer(state, rng);
}

/**
 * Qué busca un cliente. Casi siempre algo que hay en los estantes; a veces algo que la
 * tienda suele vender pero se ha agotado (castiga dejar estantes vacíos), la tendencia
 * del momento o, rara vez, cualquier cosa de las categorías que vendes.
 */
function chooseDesire(state: GameState, vip: boolean, rng: Rng): string {
  const stocked = [...new Set(state.displays.filter((d) => available(d) > 0).map((d) => d.itemId!))];
  const carried = [...new Set(state.displays.filter((d) => d.itemId).map((d) => d.itemId!))];
  const ownedKinds = new Set(state.displays.map((d) => d.kind));
  const sellable = unlockedItems(state.level).filter((i) => ownedKinds.has(i.display)).map((i) => i.id);
  const any = sellable.length > 0 ? sellable : unlockedItems(state.level).map((i) => i.id);
  const trending = state.trend ? unlockedItems(state.level).filter((i) => i.display === state.trend!.kind).map((i) => i.id) : [];
  const trendingStocked = stocked.filter((id) => trending.includes(id));

  if (vip) return pick(stocked.length > 0 && rng() < 0.6 ? stocked : any, rng);
  if (trending.length > 0 && rng() < 0.3) return pick(trendingStocked.length > 0 && rng() < 0.85 ? trendingStocked : trending, rng);
  const r = rng();
  if (stocked.length > 0 && r < 0.88) return pick(stocked, rng);
  if (carried.length > 0 && r < 0.97) return pick(carried, rng);
  return pick(any, rng);
}

export function spawnCustomer(state: GameState, rng: Rng, vip = state.level >= 3 && rng() < VIP_CHANCE): Customer {
  const { w } = storeSize(state);
  const sy = sidewalkY(state);
  const door = doorTile(state);
  // Aparecen por la acera a pocos pasos de la puerta (el render los hace aparecer con un fundido).
  const startX = Math.min(w + 1, door.x + (rng() < 0.5 ? -1 : 1) * (2 + rng() * 3));
  const customer: Customer = {
    id: state.nextId++,
    x: startX,
    y: sy,
    path: [],
    state: 'lost',
    itemId: chooseDesire(state, vip, rng),
    displayId: null,
    registerId: null,
    carrying: false,
    vip,
    timer: COMPLAIN_SEC,
    waited: 0,
    age: 0,
    look: Math.floor(rng() * 1000),
  };
  const entry = [{ x: door.x, y: sy }, door];
  const blocked = blockedTiles(state);

  // El expositor con ese artículo al que se llega antes.
  let best: { display: Display; path: Point[] } | null = null;
  for (const d of state.displays) {
    if (d.itemId !== customer.itemId || available(d) <= 0) continue;
    const path = pathToFurniture(state, door, d, blocked);
    if (path && (!best || path.length < best.path.length)) best = { display: d, path };
  }
  if (best) {
    best.display.reserved++;
    customer.state = 'toDisplay';
    customer.displayId = best.display.id;
    customer.path = [...entry, ...best.path];
  } else {
    // No lo encuentra: da una vuelta por la tienda buscándolo.
    const reach = [...reachableFromDoor(state, blocked)].map((k) => k.split(',').map(Number));
    const [tx, ty] = pick(reach.length > 0 ? reach : [[door.x, door.y]], rng);
    customer.path = [...entry, ...(findPath(state, door, { x: tx, y: ty }, blocked) ?? [])];
  }
  if (vip) state.events.push({ type: 'vipArrived', itemId: customer.itemId });
  state.customers.push(customer);
  return customer;
}

/** Camino hasta la casilla de acceso más cercana a un mueble, acabando inclinado hacia él. */
function pathToFurniture(state: GameState, from: Point, target: Point, blocked = blockedTiles(state)): Point[] | null {
  let best: Point[] | null = null;
  for (const access of accessTiles(state, target, blocked)) {
    const path = findPath(state, from, access, blocked);
    if (path && (!best || path.length < best.length)) best = path;
  }
  if (!best) return null;
  const end = best.length > 0 ? best[best.length - 1] : { x: Math.round(from.x), y: Math.round(from.y) };
  return [...best, { x: end.x + (target.x - end.x) * LEAN, y: end.y + (target.y - end.y) * LEAN }];
}

/** Avanza por el camino; devuelve true si ya ha llegado al final. */
function walk(c: Customer, dt: number): boolean {
  let step = WALK_SPEED * dt;
  while (step > 0 && c.path.length > 0) {
    const next = c.path[0];
    const dx = next.x - c.x;
    const dy = next.y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) {
      c.x = next.x;
      c.y = next.y;
      c.path.shift();
      step -= dist;
    } else {
      c.x += (dx / dist) * step;
      c.y += (dy / dist) * step;
      step = 0;
    }
  }
  return c.path.length === 0;
}

function leave(state: GameState, c: Customer) {
  if (c.state === 'toDisplay') {
    const d = displayById(state, c.displayId);
    if (d) d.reserved = Math.max(0, d.reserved - 1);
  }
  c.state = 'leaving';
  c.registerId = null;
  const door = doorTile(state);
  const sy = sidewalkY(state);
  const { w } = storeSize(state);
  const inside = c.y < sy - 0.5;
  const toDoor = inside ? findPath(state, c, door) ?? [door] : [];
  c.path = [...toDoor, ...(inside ? [{ x: door.x, y: sy }] : []), { x: c.look % 2 === 0 ? -2 : w + 1, y: sy }];
}

interface Queue {
  register: Register;
  customers: Customer[];
  slots: Point[];
}

function shortestQueue(state: GameState): Register {
  const sizes = new Map(state.registers.map((r) => [r.id, 0]));
  for (const c of state.customers) if (c.registerId !== null) sizes.set(c.registerId, (sizes.get(c.registerId) ?? 0) + 1);
  return [...state.registers].sort((a, b) => sizes.get(a.id)! - sizes.get(b.id)!)[0];
}

/** Casillas de la cola de una caja: delante de ella y luego las libres más cercanas. */
function queueSlots(state: GameState, r: Register, count: number, blocked: Set<string>, otherFronts: Set<string>): Point[] {
  const front = registerFront(r);
  const slots: Point[] = [front];
  const seen = new Set([`${front.x},${front.y}`]);
  const door = doorTile(state);
  seen.add(`${door.x},${door.y}`);
  for (let i = 0; i < slots.length && slots.length < count; i++) {
    const cur = slots[i];
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      const k = `${n.x},${n.y}`;
      const { w, h } = storeSize(state);
      if (seen.has(k) || blocked.has(k) || otherFronts.has(k) || n.x < 0 || n.y < 0 || n.x >= w || n.y >= h) continue;
      seen.add(k);
      slots.push(n);
    }
  }
  return slots;
}

function buildQueues(state: GameState): Map<number, Queue> {
  const blocked = blockedTiles(state);
  const queues = new Map<number, Queue>();
  for (const r of state.registers) {
    const customers = state.customers.filter((c) => c.state === 'queue' && c.registerId === r.id).sort((a, b) => a.timer - b.timer);
    const otherFronts = new Set(state.registers.filter((o) => o.id !== r.id).map((o) => `${o.x},${o.y + 1}`));
    queues.set(r.id, { register: r, customers, slots: queueSlots(state, r, customers.length, blocked, otherFronts) });
  }
  return queues;
}

function updateCustomer(state: GameState, c: Customer, dt: number, queues: Map<number, Queue>) {
  c.age += dt;
  const arrived = walk(c, dt);
  switch (c.state) {
    case 'toDisplay': {
      const d = displayById(state, c.displayId);
      if (!d) return leave(state, c);
      if (!arrived) return;
      if (Math.abs(Math.round(c.x) - d.x) + Math.abs(Math.round(c.y) - d.y) > 1 || isBlockedAt(state, c)) {
        // El expositor se ha movido mientras venía: busca el nuevo camino.
        const path = pathToFurniture(state, c, d);
        if (!path) return leave(state, c);
        c.path = path;
        return;
      }
      c.state = 'browsing';
      c.timer = BROWSE_SEC;
      return;
    }
    case 'browsing': {
      c.timer -= dt;
      if (c.timer > 0) return;
      const d = displayById(state, c.displayId);
      if (!d) return leave(state, c);
      d.stock--;
      d.reserved = Math.max(0, d.reserved - 1);
      c.carrying = true;
      c.state = 'queue';
      c.registerId = shortestQueue(state).id;
      // `timer` sirve de turno en la cola: quien llegó antes, paga antes.
      c.timer = state.time;
      c.waited = 0;
      state.events.push({ type: 'pickup', displayId: d.id, customerId: c.id, itemId: c.itemId });
      return;
    }
    case 'queue': {
      const q = queues.get(c.registerId ?? -1);
      if (!q) {
        c.registerId = shortestQueue(state).id;
        return;
      }
      const idx = q.customers.indexOf(c);
      const slot = q.slots[Math.max(0, idx)] ?? q.slots[q.slots.length - 1];
      const dest = c.path.length > 0 ? c.path[c.path.length - 1] : { x: c.x, y: c.y };
      if (dest.x !== slot.x || dest.y !== slot.y) {
        const path = findPath(state, c, slot);
        // Un camino vacío significa que ya está en la casilla, pero quizá no en su centro.
        c.path = path && path.length > 0 ? path : [slot];
      }
      c.waited += dt;
      if (c.waited > (c.vip ? VIP_PATIENCE_SEC : PATIENCE_SEC) && idx > 0) {
        // Se cansa de esperar: deja el artículo y se va enfadado.
        const d = displayById(state, c.displayId);
        if (d && d.itemId === c.itemId) d.stock = Math.min(capacity(state, d.kind), d.stock + 1);
        c.carrying = false;
        state.mood = clamp(state.mood - QUEUE_MOOD_PENALTY, 0, 100);
        state.stats.lost++;
        state.events.push({ type: 'unhappy', x: c.x, y: c.y, reason: 'queue' });
        leave(state, c);
      }
      return;
    }
    case 'lost':
      if (!arrived) return;
      c.timer -= dt;
      if (c.timer > 0) return;
      state.mood = clamp(state.mood - LOST_MOOD_PENALTY, 0, 100);
      state.stats.lost++;
      state.events.push({ type: 'unhappy', x: c.x, y: c.y, reason: 'missing' });
      return leave(state, c);
    case 'leaving':
      if (arrived) state.customers = state.customers.filter((o) => o.id !== c.id);
      return;
  }
}

const isBlockedAt = (state: GameState, c: Customer) => blockedTiles(state).has(`${Math.round(c.x)},${Math.round(c.y)}`);

function updateRegisters(state: GameState, dt: number, queues: Map<number, Queue>, rng: Rng) {
  for (const q of queues.values()) {
    const r = q.register;
    const head = q.customers[0];
    const front = registerFront(r);
    if (!head || head.path.length > 0 || Math.round(head.x) !== front.x || Math.round(head.y) !== front.y) {
      r.serveTimer = 0;
      continue;
    }
    r.serveTimer += dt;
    if (r.serveTimer < serveSeconds(state)) continue;
    r.serveTimer = 0;
    completeSale(state, head, r, rng);
  }
}

function completeSale(state: GameState, c: Customer, r: Register, rng: Rng) {
  const item = itemById(c.itemId);
  const trending = isTrending(state, item);
  const amount = salePrice(state, item) * (c.vip ? VIP_PRICE_MULTIPLIER : 1);
  const tip = happiness(state) >= TIP_HAPPINESS && rng() < 0.25 ? Math.ceil(amount * 0.25) : 0;
  const gem = c.vip && rng() < 0.5;
  state.coins += amount + tip;
  if (gem) state.gems++;
  state.mood = clamp(state.mood + (c.vip ? 3 : SALE_MOOD_BONUS), 0, 100);
  const s = state.stats;
  s.sold++;
  s.earned += amount;
  s.tips += tip;
  s.soldByItem[item.id] = (s.soldByItem[item.id] ?? 0) + 1;
  if (c.vip) s.vipServed++;
  if (trending) s.trendSold++;
  state.events.push({ type: 'sale', amount, tip, vip: c.vip, gem, registerId: r.id, x: c.x, y: c.y });
  addXp(state, item.xp * (c.vip ? 2 : 1));
  c.carrying = false;
  leave(state, c);
}
