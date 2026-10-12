import { describe, expect, it } from 'vitest';
import { itemById } from './catalog';
import { claimDaily, dailyReward, dailyStatus } from './daily';
import { dayIndex, updateDay } from './days';
import { displayPrice, salePrice, setPriceLevel, setStoreName, spawnCustomer, tick } from './sim';
import { createInitialState, type GameState } from './state';
import { DAY_MS } from './world';

function store() {
  const s = createInitialState(1000);
  s.spawnTimer = Infinity;
  s.weather = { kind: 'sunny', until: Infinity };
  s.nextOrderAt = Infinity;
  Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
  return s;
}

const runWith = (s: GameState, seconds: number, value: number) => {
  for (let i = 0; i < seconds * 10; i++) tick(s, 100, () => value);
};

describe('precios por expositor', () => {
  it('caro cobra más y barato menos', () => {
    const s = store();
    const item = itemById('tshirt');
    setPriceLevel(s, 1, 1);
    expect(displayPrice(s, item, s.displays[0])).toBeCloseTo(salePrice(s, item) * 1.3);
    setPriceLevel(s, 1, -1);
    expect(displayPrice(s, item, s.displays[0])).toBeCloseTo(salePrice(s, item) * 0.8);
  });

  it('en un expositor caro el cliente paga más... si se decide a comprar', () => {
    const s = store();
    setPriceLevel(s, 1, 1);
    spawnCustomer(s, () => 0, 'regular');
    const coins = s.coins;
    runWith(s, 40, 0.99); // nunca se echa atrás
    expect(s.coins - coins).toBe(Math.round(salePrice(s, itemById('tshirt')) * 1.3));
  });

  it('a veces el precio alto le echa para atrás', () => {
    const s = store();
    setPriceLevel(s, 1, 1);
    spawnCustomer(s, () => 0, 'regular');
    runWith(s, 40, 0); // siempre se echa atrás
    expect(s.stats.sold).toBe(0);
    expect(s.stats.lost).toBe(1);
    expect(s.displays[0]).toMatchObject({ stock: 10, reserved: 0 });
  });

  it('comprar barato pone más contenta a la clientela', () => {
    const normal = store();
    spawnCustomer(normal, () => 0, 'regular');
    runWith(normal, 40, 0.99);
    const cheap = store();
    setPriceLevel(cheap, 1, -1);
    spawnCustomer(cheap, () => 0, 'regular');
    runWith(cheap, 40, 0.99);
    expect(cheap.mood).toBeGreaterThan(normal.mood);
  });
});

describe('días de juego', () => {
  it('al amanecer se cierra el día con un resumen', () => {
    const s = store();
    updateDay(s);
    s.stats.sold += 7;
    s.stats.earned += 100;
    s.stats.soldByItem.tshirt = 7;
    s.time = (dayIndex(s.time) + 1) * DAY_MS;
    updateDay(s);
    const e = s.events.find((x) => x.type === 'dayEnd');
    expect(e).toMatchObject({ summary: { day: 1, sold: 7, earned: 100, best: { itemId: 'tshirt', count: 7 } } });
    expect(s.history).toHaveLength(1);
  });

  it('si se salta varios días sin jugar, no hay resumen', () => {
    const s = store();
    updateDay(s);
    s.time += DAY_MS * 5;
    updateDay(s);
    expect(s.events.some((x) => x.type === 'dayEnd')).toBe(false);
  });
});

describe('premio diario', () => {
  it('se reclama una vez al día y la racha crece si se juega seguido', () => {
    const s = store();
    expect(dailyStatus(s, '2026-10-12', '2026-10-11')).toEqual({ available: true, streakDay: 1 });
    const first = claimDaily(s, '2026-10-12', '2026-10-11')!;
    expect(first).toEqual(dailyReward(1, 1));
    expect(claimDaily(s, '2026-10-12', '2026-10-11')).toBeNull();
    claimDaily(s, '2026-10-13', '2026-10-12');
    expect(s.daily.streak).toBe(2);
    // Un día sin jugar rompe la racha.
    claimDaily(s, '2026-10-15', '2026-10-14');
    expect(s.daily.streak).toBe(1);
  });
});

describe('nombre de la tienda', () => {
  it('se limpia y se limita', () => {
    const s = store();
    expect(setStoreName(s, '   ')).toMatchObject({ ok: false });
    setStoreName(s, '  La   tienda de   Alex  ');
    expect(s.storeName).toBe('La tienda de Alex');
    setStoreName(s, 'x'.repeat(50));
    expect(s.storeName.length).toBe(22);
  });
});
