import { describe, expect, it } from 'vitest';
import { DISPLAYS, itemById } from './catalog';
import { findPath, placementError } from './path';
import { seededRng } from './rng';
import {
  addXp,
  buyDecor,
  buyDisplay,
  buyExpansion,
  buyRegister,
  buyUpgrade,
  capacity,
  happiness,
  moveFurniture,
  orderStock,
  rushOrder,
  sellFurniture,
  spawnCustomer,
  tick,
  useStyle,
  xpForLevel,
} from './sim';
import { createInitialState, doorTile, storeSize, type GameState } from './state';

const T0 = 1_000_000;

function run(state: GameState, seconds: number, seed = 1) {
  const rng = seededRng(seed);
  for (let i = 0; i < seconds * 10; i++) tick(state, 100, rng);
}

/** Estado sin llegadas automáticas de clientes, para controlar cada escena. */
function quietState() {
  const s = createInitialState(T0);
  s.spawnTimer = Infinity;
  return s;
}

describe('pedidos', () => {
  it('cobra el pedido y entrega el stock al cumplirse el tiempo', () => {
    const s = createInitialState(T0);
    expect(orderStock(s, 1, 'tshirt')).toEqual({ ok: true });
    const item = itemById('tshirt');
    expect(s.coins).toBe(150 - item.batchCost);
    expect(s.stats.ordersPlaced).toBe(1);
    tick(s, item.deliverySec * 1000 - 1, seededRng(1));
    expect(s.displays[0].stock).toBe(0);
    tick(s, 1, seededRng(1));
    expect(s.displays[0]).toMatchObject({ itemId: 'tshirt', stock: item.batchSize, order: null });
    expect(s.events).toContainEqual({ type: 'delivered', displayId: 1, itemId: 'tshirt' });
  });

  it('rechaza pedidos inválidos', () => {
    const s = createInitialState(T0);
    expect(orderStock(s, 1, 'hammer')).toMatchObject({ ok: false }); // necesita estantería
    expect(orderStock(s, 1, 'jeans')).toMatchObject({ ok: false }); // nivel 2
    expect(orderStock(s, 99, 'tshirt')).toMatchObject({ ok: false });
    orderStock(s, 1, 'tshirt');
    expect(orderStock(s, 1, 'tshirt')).toMatchObject({ ok: false, error: 'Ya hay un pedido en camino' });
  });

  it('no deja mezclar artículos ni pasarse de capacidad', () => {
    const s = createInitialState(T0);
    s.level = 2;
    s.coins = 10_000;
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 5 });
    expect(orderStock(s, 1, 'jeans')).toMatchObject({ ok: false });
    s.displays[0].stock = DISPLAYS.rack.capacity - 5;
    expect(orderStock(s, 1, 'tshirt')).toMatchObject({ ok: false, error: 'No cabe más en el expositor' });
  });

  it('acelerar un pedido cuesta diamantes y lo entrega ya', () => {
    const s = createInitialState(T0);
    orderStock(s, 1, 'tshirt');
    expect(rushOrder(s, 1)).toEqual({ ok: true });
    expect(s.gems).toBe(2);
    tick(s, 0, seededRng(1));
    expect(s.displays[0].stock).toBeGreaterThan(0);
    s.gems = 0;
    orderStock(s, 1, 'tshirt');
    expect(rushOrder(s, 1)).toMatchObject({ ok: false });
  });
});

describe('construcción', () => {
  it('compra expositores hasta el límite del nivel', () => {
    const s = createInitialState(T0);
    expect(buyDisplay(s, 'shelf', 5, 2)).toEqual({ ok: true });
    expect(s.coins).toBe(110);
    expect(buyDisplay(s, 'fruit', 1, 1)).toEqual({ ok: true });
    expect(buyDisplay(s, 'shelf', 6, 2)).toMatchObject({ ok: false }); // nivel 1 → 3 expositores
    expect(buyDisplay(s, 'case', 6, 2)).toMatchObject({ ok: false }); // vitrina en nivel 2
  });

  it('no permite tapar la puerta, la caja ni dejar expositores inaccesibles', () => {
    const s = createInitialState(T0);
    s.level = 10;
    s.coins = 100_000;
    const door = doorTile(s);
    expect(placementError(s, 'display', door.x, door.y)).toMatch(/puerta/);
    expect(placementError(s, 'display', 7, 6)).toMatch(/puerta|cajas/); // delante de la caja
    // Encerrar el perchero (3,2) por sus cuatro lados.
    expect(buyDecor(s, 'plant', 2, 2).ok).toBe(true);
    expect(buyDecor(s, 'plant', 4, 2).ok).toBe(true);
    expect(buyDecor(s, 'plant', 3, 1).ok).toBe(true);
    expect(buyDecor(s, 'plant', 3, 3)).toMatchObject({ ok: false, error: 'Así bloquearías el paso de los clientes' });
    // La alfombra se pisa: no bloquea.
    expect(buyDecor(s, 'rug', 3, 3).ok).toBe(true);
  });

  it('mueve y vende muebles', () => {
    const s = createInitialState(T0);
    expect(moveFurniture(s, { kind: 'display', id: 1 }, 1, 1)).toEqual({ ok: true });
    expect(s.displays[0]).toMatchObject({ x: 1, y: 1 });
    expect(moveFurniture(s, { kind: 'register', id: 2 }, 5, 5)).toEqual({ ok: true });
    expect(sellFurniture(s, { kind: 'display', id: 1 })).toMatchObject({ ok: false }); // es el único
    buyDisplay(s, 'shelf', 6, 2);
    const coins = s.coins;
    expect(sellFurniture(s, { kind: 'display', id: 1 })).toEqual({ ok: true });
    expect(s.coins).toBe(coins + DISPLAYS.rack.price / 2);
    expect(sellFurniture(s, { kind: 'register', id: 2 })).toMatchObject({ ok: false });
  });

  it('las cajas extra se desbloquean por nivel', () => {
    const s = createInitialState(T0);
    s.coins = 10_000;
    expect(buyRegister(s, 2, 5)).toMatchObject({ ok: false });
    s.level = 4;
    expect(buyRegister(s, 2, 5)).toEqual({ ok: true });
    expect(s.registers).toHaveLength(2);
  });

  it('la decoración y el hilo musical suben la felicidad, con tope', () => {
    const s = createInitialState(T0);
    const before = happiness(s);
    buyDecor(s, 'plant', 0, 0);
    expect(happiness(s)).toBe(before + 4);
    s.coins = 10_000;
    s.level = 6;
    for (let x = 1; x < 10; x++) buyDecor(s, 'plant', x, 0);
    expect(happiness(s)).toBe(s.mood + 40);
    buyUpgrade(s, 'music');
    expect(happiness(s)).toBe(s.mood + 45);
  });

  it('ampliar la tienda mueve la puerta', () => {
    const s = createInitialState(T0);
    s.coins = 10_000;
    expect(buyExpansion(s)).toMatchObject({ ok: false });
    s.level = 3;
    expect(buyExpansion(s)).toEqual({ ok: true });
    expect(storeSize(s)).toEqual(expect.objectContaining({ w: 12, h: 9 }));
    expect(doorTile(s)).toEqual({ x: 11, y: 8 });
  });

  it('compra un estilo una vez y después se aplica gratis', () => {
    const s = createInitialState(T0);
    s.level = 2;
    expect(useStyle(s, 'tiles')).toEqual({ ok: true });
    expect(s.floor).toBe('tiles');
    const coins = s.coins;
    useStyle(s, 'wood');
    useStyle(s, 'tiles');
    expect(s.coins).toBe(coins);
    expect(s.stats.stylesBought).toBe(1);
  });
});

describe('mejoras', () => {
  it('se compran por niveles y tienen efecto', () => {
    const s = createInitialState(T0);
    s.coins = 100_000;
    expect(buyUpgrade(s, 'storage')).toMatchObject({ ok: false }); // nivel 4
    s.level = 10;
    expect(buyUpgrade(s, 'storage')).toEqual({ ok: true });
    expect(capacity(s, 'rack')).toBe(25);
    buyUpgrade(s, 'storage');
    expect(buyUpgrade(s, 'storage')).toMatchObject({ ok: false, error: 'Ya tienes esta mejora al máximo' });
    buyUpgrade(s, 'express');
    orderStock(s, 1, 'tshirt');
    expect(s.displays[0].order!.totalMs).toBe(itemById('tshirt').deliverySec * 800);
  });

  it('el reponedor repite el pedido cuando un expositor se vacía', () => {
    const s = quietState();
    s.level = 4;
    s.coins = 1000;
    buyUpgrade(s, 'stocker');
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 0 });
    tick(s, 100, seededRng(1));
    expect(s.displays[0].order?.itemId).toBe('tshirt');
    expect(s.events).toContainEqual({ type: 'autoOrder', displayId: 1, itemId: 'tshirt' });
  });
});

describe('clientes', () => {
  it('un cliente entra desde la acera, compra, paga y se va', () => {
    const s = quietState();
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
    const c = spawnCustomer(s, () => 0, false);
    expect(c.state).toBe('toDisplay');
    expect(c.y).toBe(storeSize(s).h);
    expect(s.displays[0].reserved).toBe(1);

    run(s, 40);
    expect(s.displays[0]).toMatchObject({ stock: 9, reserved: 0 });
    expect(s.coins).toBe(150 + itemById('tshirt').salePrice);
    expect(s.stats.sold).toBe(1);
    expect(s.customers).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'pickup', displayId: 1, customerId: c.id, itemId: 'tshirt' });
  });

  it('los clientes nunca pisan muebles', () => {
    const s = createInitialState(T0);
    s.level = 3;
    s.coins = 10_000;
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 20 });
    buyDisplay(s, 'shelf', 5, 3);
    Object.assign(s.displays[1], { itemId: 'hammer', stock: 20 });
    buyDecor(s, 'plant', 4, 4);
    const rng = seededRng(3);
    for (let i = 0; i < 600; i++) {
      tick(s, 100, rng);
      for (const c of s.customers) {
        const tx = Math.round(c.x);
        const ty = Math.round(c.y);
        expect(s.displays.some((d) => d.x === tx && d.y === ty)).toBe(false);
        expect(s.decor.some((d) => d.x === tx && d.y === ty)).toBe(false);
      }
    }
    expect(s.stats.sold).toBeGreaterThan(5);
  });

  it('si no encuentra lo que busca se va enfadado', () => {
    const s = quietState();
    const mood = s.mood;
    spawnCustomer(s, () => 0, false);
    run(s, 40);
    expect(s.stats.lost).toBe(1);
    expect(s.mood).toBeLessThan(mood);
    expect(s.events.some((e) => e.type === 'unhappy')).toBe(true);
  });

  it('los VIP pagan el triple', () => {
    const s = quietState();
    s.level = 3;
    s.trend = { kind: 'shelf', until: Infinity }; // sin tendencia en la ropa
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
    spawnCustomer(s, () => 0, true);
    run(s, 40);
    expect(s.stats.vipServed).toBe(1);
    expect(s.coins).toBe(150 + itemById('tshirt').salePrice * 3);
  });

  it('una tienda abastecida gana dinero con el tiempo', () => {
    const s = createInitialState(T0);
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 20 });
    run(s, 120, 42);
    expect(s.stats.sold).toBeGreaterThan(5);
    expect(s.coins).toBeGreaterThan(150);
    expect(s.displays[0].reserved).toBeGreaterThanOrEqual(0);
  });

  it('las tendencias suben el precio de su categoría', () => {
    const s = quietState();
    s.level = 2;
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
    tick(s, 100, seededRng(1));
    expect(s.trend?.kind).toBe('rack');
    spawnCustomer(s, () => 0, false);
    run(s, 40);
    expect(s.stats.trendSold).toBe(1);
    expect(s.coins).toBe(150 + Math.round(itemById('tshirt').salePrice * 1.25));
  });
});

describe('caminos', () => {
  it('rodea los obstáculos', () => {
    const s = createInitialState(T0);
    const path = findPath(s, { x: 2, y: 2 }, { x: 4, y: 2 })!;
    expect(path.some((p) => p.x === 3 && p.y === 2)).toBe(false);
    expect(path[path.length - 1]).toEqual({ x: 4, y: 2 });
  });
});

describe('progresión', () => {
  it('sube de nivel al alcanzar la XP y regala diamantes', () => {
    const s = createInitialState(T0);
    addXp(s, xpForLevel(3));
    expect(s.level).toBe(3);
    expect(s.gems).toBe(3 + 4);
    expect(s.events.filter((e) => e.type === 'levelUp')).toHaveLength(2);
  });
});
