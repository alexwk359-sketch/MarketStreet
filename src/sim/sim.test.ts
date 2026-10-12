import { describe, expect, it } from 'vitest';
import { ITEMS, DISPLAYS } from './catalog';
import { seededRng } from './rng';
import { deserialize, serialize } from './save';
import {
  addXp,
  buyDecor,
  buyDisplay,
  happiness,
  isTileFree,
  orderStock,
  spawnCustomer,
  tick,
  xpForLevel,
} from './sim';
import { REGISTER, createInitialState, type GameState } from './state';

const T0 = 1_000_000;

function run(state: GameState, seconds: number, seed = 1) {
  const rng = seededRng(seed);
  for (let i = 0; i < seconds * 10; i++) tick(state, 100, rng);
}

describe('pedidos', () => {
  it('cobra el pedido y entrega el stock al cumplirse el tiempo', () => {
    const s = createInitialState(T0);
    expect(orderStock(s, 1, 'tshirt')).toEqual({ ok: true });
    expect(s.coins).toBe(130);
    expect(s.displays[0].order).not.toBeNull();

    tick(s, 29_000, seededRng(1));
    expect(s.displays[0].stock).toBe(0);
    tick(s, 1_000, seededRng(1));
    expect(s.displays[0]).toMatchObject({ itemId: 'tshirt', stock: 10, order: null });
    expect(s.events).toContainEqual({ type: 'delivered', displayId: 1, itemId: 'tshirt' });
  });

  it('rechaza pedidos inválidos', () => {
    const s = createInitialState(T0);
    expect(orderStock(s, 1, 'hammer')).toMatchObject({ ok: false }); // estantería requerida
    expect(orderStock(s, 1, 'jeans')).toMatchObject({ ok: false }); // nivel 2
    expect(orderStock(s, 99, 'tshirt')).toMatchObject({ ok: false });
    orderStock(s, 1, 'tshirt');
    expect(orderStock(s, 1, 'tshirt')).toMatchObject({ ok: false, error: 'Ya hay un pedido en camino' });
    s.coins = 0;
    s.displays[0].order = null;
    expect(orderStock(s, 1, 'tshirt')).toMatchObject({ ok: false, error: 'No tienes suficientes monedas' });
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
});

describe('construcción', () => {
  it('compra expositores hasta el límite del nivel', () => {
    const s = createInitialState(T0);
    expect(buyDisplay(s, 'shelf', 5, 2)).toEqual({ ok: true });
    expect(s.coins).toBe(110);
    expect(buyDisplay(s, 'shelf', 6, 2)).toMatchObject({ ok: false }); // nivel 1 → 2 expositores
    expect(buyDisplay(s, 'case', 6, 2)).toMatchObject({ ok: false }); // vitrina en nivel 2
  });

  it('no permite construir sobre casillas ocupadas o reservadas', () => {
    const s = createInitialState(T0);
    expect(isTileFree(s, 3, 2)).toBe(false); // perchero inicial
    expect(isTileFree(s, REGISTER.x, REGISTER.y)).toBe(false);
    expect(isTileFree(s, -1, 0)).toBe(false);
    expect(buyDecor(s, 'plant', 3, 2)).toMatchObject({ ok: false });
  });

  it('la decoración sube la felicidad con un tope', () => {
    const s = createInitialState(T0);
    const before = happiness(s);
    buyDecor(s, 'plant', 0, 0);
    expect(happiness(s)).toBe(before + 4);
    s.coins = 10_000;
    for (let x = 0; x < 10; x++) buyDecor(s, 'plant', x, 1);
    expect(happiness(s)).toBe(s.mood + 40);
  });
});

describe('clientes', () => {
  it('un cliente compra, paga en la caja y se va', () => {
    const s = createInitialState(T0);
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
    s.spawnTimer = Infinity; // controlamos la llegada a mano
    const c = spawnCustomer(s, () => 0);
    expect(c.state).toBe('toDisplay');
    expect(s.displays[0].reserved).toBe(1);

    run(s, 20);
    expect(s.displays[0]).toMatchObject({ stock: 9, reserved: 0 });
    expect(s.coins).toBe(150 + ITEMS[0].salePrice);
    expect(s.stats.sold).toBe(1);
    expect(s.customers).toHaveLength(0);
    expect(s.queue).toHaveLength(0);
  });

  it('si no encuentra lo que busca se va enfadado', () => {
    const s = createInitialState(T0);
    s.spawnTimer = Infinity;
    const mood = s.mood;
    spawnCustomer(s, () => 0);
    run(s, 20);
    expect(s.stats.lost).toBe(1);
    expect(s.mood).toBeLessThan(mood);
    expect(s.events.some((e) => e.type === 'unhappy')).toBe(true);
  });

  it('una tienda abastecida gana dinero con el tiempo', () => {
    const s = createInitialState(T0);
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 20 });
    run(s, 120, 42);
    expect(s.stats.sold).toBeGreaterThan(5);
    expect(s.coins).toBeGreaterThan(150);
    expect(s.displays[0].stock).toBeGreaterThanOrEqual(0);
    expect(s.displays[0].reserved).toBeGreaterThanOrEqual(0);
  });
});

describe('progresión', () => {
  it('sube de nivel al alcanzar la XP', () => {
    const s = createInitialState(T0);
    addXp(s, xpForLevel(3));
    expect(s.level).toBe(3);
    expect(s.events.filter((e) => e.type === 'levelUp')).toHaveLength(2);
  });
});

describe('guardado', () => {
  it('descarta clientes, libera reservas y adelanta el reloj', () => {
    const s = createInitialState(T0);
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
    orderStock(s, 1, 'tshirt');
    spawnCustomer(s, () => 0);
    const loaded = deserialize(serialize(s), T0 + 60_000);
    expect(loaded.customers).toEqual([]);
    expect(loaded.displays[0].reserved).toBe(0);
    expect(loaded.time).toBe(T0 + 60_000);
    tick(loaded, 0, seededRng(1));
    expect(loaded.displays[0].stock).toBe(20); // el pedido llegó mientras no jugábamos
  });
});
