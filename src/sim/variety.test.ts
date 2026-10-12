import { describe, expect, it } from 'vitest';
import { itemById } from './catalog';
import { declineOrder, fulfillOrder, orderStockAvailable, updateOrders } from './orders';
import { seededRng } from './rng';
import { buyDisplay, catchThief, salePrice, spawnCustomer, spawnInterval, tick } from './sim';
import { createInitialState, type GameState } from './state';
import { darkness, dayPeriod, DAY_MS, weatherDemand } from './world';

const T0 = 0; // amanecer del primer día

function run(state: GameState, seconds: number, seed = 1) {
  const rng = seededRng(seed);
  for (let i = 0; i < seconds * 10; i++) tick(state, 100, rng);
}

/** Tienda con perchero y estantería llenos, sin llegadas automáticas ni clima cambiante. */
function stockedStore() {
  const s = createInitialState(1000);
  s.level = 4;
  s.coins = 1000;
  s.spawnTimer = Infinity;
  s.weather = { kind: 'sunny', until: Infinity };
  s.trend = { kind: 'rack', until: Infinity }; // la ropa está en tendencia
  s.nextOrderAt = Infinity;
  Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
  buyDisplay(s, 'shelf', 5, 2);
  Object.assign(s.displays[1], { itemId: 'hammer', stock: 10 });
  return s;
}

describe('tipos de cliente', () => {
  it('el cliente con lista coge varios artículos y paga todo junto', () => {
    const s = stockedStore();
    const c = spawnCustomer(s, () => 0, 'list');
    c.wants = ['hammer'];
    const coins = s.coins;
    run(s, 60);
    expect(s.stats.listServed).toBe(1);
    expect(s.stats.sold).toBe(2);
    expect(s.coins).toBe(coins + salePrice(s, itemById('tshirt')) + salePrice(s, itemById('hammer')));
  });

  it('los abuelos caminan más despacio y los niños más deprisa', () => {
    const s = stockedStore();
    const senior = spawnCustomer(s, () => 0, 'senior');
    const kid = spawnCustomer(s, () => 0, 'kid');
    expect(senior.speed).toBeLessThan(kid.speed);
  });

  it('el turista paga más', () => {
    const s = stockedStore();
    spawnCustomer(s, () => 0, 'tourist');
    const coins = s.coins;
    run(s, 40);
    expect(s.coins - coins).toBe(Math.round(salePrice(s, itemById('tshirt')) * 1.5));
  });

  it('el ladrón roba y huye si nadie lo para', () => {
    const s = stockedStore();
    spawnCustomer(s, () => 0, 'thief');
    expect(s.events.some((e) => e.type === 'thiefArrived')).toBe(true);
    run(s, 60);
    expect(s.stats.stolen).toBe(1);
    expect(s.displays[0].stock + s.displays[1].stock).toBe(19);
    expect(s.customers).toHaveLength(0);
  });

  it('atrapar al ladrón devuelve lo robado y da recompensa', () => {
    const s = stockedStore();
    const thief = spawnCustomer(s, () => 0, 'thief');
    const rng = seededRng(1);
    while (thief.state !== 'fleeing') tick(s, 100, rng);
    const coins = s.coins;
    expect(catchThief(s, thief.id)).toEqual({ ok: true });
    expect(s.coins).toBeGreaterThan(coins);
    expect(s.stats.thievesCaught).toBe(1);
    expect(s.displays[0].stock + s.displays[1].stock).toBe(20);
    expect(catchThief(s, thief.id)).toMatchObject({ ok: false });
    run(s, 30);
    expect(s.stats.stolen).toBe(0);
  });

  it('un crítico contento hace la tienda viral', () => {
    const s = stockedStore();
    const before = spawnInterval(s);
    spawnCustomer(s, () => 0, 'critic');
    run(s, 40);
    expect(s.stats.criticsHappy).toBe(1);
    expect(s.boostUntil).toBeGreaterThan(s.time);
    expect(spawnInterval(s)).toBeLessThan(before);
  });

  it('un crítico decepcionado baja mucho el ánimo', () => {
    const s = stockedStore();
    s.displays.forEach((d) => (d.stock = 0));
    const mood = s.mood;
    spawnCustomer(s, () => 0.99, 'critic');
    run(s, 40);
    expect(s.mood).toBeLessThanOrEqual(mood - 15);
  });
});

describe('clima y hora', () => {
  it('el calor dispara la demanda de helados y la lluvia trae menos gente', () => {
    const s = stockedStore();
    s.weather = { kind: 'heat', until: Infinity };
    expect(weatherDemand(s, 'freezer')).toBeGreaterThan(1);
    const heat = spawnInterval(s);
    s.weather = { kind: 'rain', until: Infinity };
    expect(spawnInterval(s)).toBeGreaterThan(heat);
  });

  it('el tiempo cambia solo pasado un rato', () => {
    const s = createInitialState(T0);
    s.level = 5;
    tick(s, 100, seededRng(2));
    const first = s.weather!;
    expect(first).not.toBeNull();
    tick(s, first.until - s.time + 1, seededRng(3));
    expect(s.weather!.kind).not.toBe(first.kind);
    expect(s.events.some((e) => e.type === 'weather')).toBe(true);
  });

  it('el día pasa por mañana, mediodía, tarde y noche', () => {
    expect(dayPeriod(0)).toBe('morning');
    expect(dayPeriod(DAY_MS * 0.3)).toBe('day');
    expect(dayPeriod(DAY_MS * 0.6)).toBe('evening');
    expect(dayPeriod(DAY_MS * 0.9)).toBe('night');
    expect(darkness(DAY_MS * 0.3)).toBe(0);
    expect(darkness(DAY_MS * 0.9)).toBe(1);
  });
});

describe('encargos', () => {
  it('llega un encargo y se cumple con lo que hay en los estantes', () => {
    const s = stockedStore();
    s.nextOrderAt = 1;
    updateOrders(s, () => 0);
    const order = s.specialOrder!;
    expect(order).not.toBeNull();
    const item = itemById(order.itemId);
    s.displays.forEach((d) => (d.stock = 0));
    expect(fulfillOrder(s)).toMatchObject({ ok: false });
    const d = s.displays.find((x) => x.kind === item.display)!;
    Object.assign(d, { itemId: item.id, stock: order.qty });
    expect(orderStockAvailable(s, item.id)).toBe(order.qty);
    const coins = s.coins;
    expect(fulfillOrder(s)).toEqual({ ok: true });
    expect(s.coins).toBe(coins + order.reward.coins);
    expect(d.stock).toBe(0);
    expect(s.stats.ordersDone).toBe(1);
    expect(s.specialOrder).toBeNull();
  });

  it('caduca si no se entrega a tiempo y se puede rechazar', () => {
    const s = stockedStore();
    s.nextOrderAt = 1;
    updateOrders(s, () => 0);
    s.time = s.specialOrder!.expiresAt;
    updateOrders(s, () => 0);
    expect(s.specialOrder).toBeNull();
    expect(s.events.some((e) => e.type === 'orderExpired')).toBe(true);
    s.time = s.nextOrderAt;
    updateOrders(s, () => 0);
    declineOrder(s);
    expect(s.specialOrder).toBeNull();
  });
});
