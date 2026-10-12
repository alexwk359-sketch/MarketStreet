import { describe, expect, it } from 'vitest';
import { itemById } from './catalog';
import { simulateOffline } from './offline';
import { seededRng } from './rng';
import { deserialize, serialize } from './save';
import { orderStock, spawnCustomer } from './sim';
import { createInitialState } from './state';
import { activeTasks, claimTask, claimableCount } from './tasks';

const T0 = 1_000_000;

describe('tareas', () => {
  it('muestra tres tareas y se reclaman al completarlas', () => {
    const s = createInitialState(T0);
    expect(activeTasks(s).map((t) => t.id)).toEqual(['first-order', 'sell-5', 'fruit-stand']);
    expect(claimTask(s, 'first-order')).toBe(false);
    orderStock(s, 1, 'tshirt');
    expect(claimableCount(s)).toBe(1);
    const coins = s.coins;
    expect(claimTask(s, 'first-order')).toBe(true);
    expect(s.coins).toBe(coins + 20);
    expect(activeTasks(s).map((t) => t.id)).toEqual(['sell-5', 'fruit-stand', 'first-decor']);
  });
});

describe('guardado', () => {
  it('descarta clientes y libera reservas', () => {
    const s = createInitialState(T0);
    Object.assign(s.displays[0], { itemId: 'tshirt', stock: 10 });
    spawnCustomer(s, () => 0, 'regular');
    const loaded = deserialize(serialize(s));
    expect(loaded.customers).toEqual([]);
    expect(loaded.displays[0].reserved).toBe(0);
  });

  it('migra partidas del prototipo (versión 1)', () => {
    const v1 = {
      version: 1,
      time: T0,
      coins: 300,
      xp: 25,
      level: 2,
      mood: 50,
      displays: [{ id: 1, kind: 'rack', x: 3, y: 2, itemId: 'drill', stock: 5, reserved: 2, order: { itemId: 'tshirt', readyAt: T0 } }],
      decor: [{ id: 5, decorId: 'neon', x: 0, y: 0 }, { id: 6, decorId: 'plant', x: 1, y: 0 }],
      queue: [],
      serveTimer: 0,
      spawnTimer: 1,
      nextId: 7,
      stats: { sold: 12, lost: 3 },
    };
    const s = deserialize(JSON.stringify(v1));
    expect(s.version).toBe(2);
    expect(s.registers).toEqual([{ id: 7, x: 7, y: 5, serveTimer: 0 }]);
    expect(s.displays[0]).toMatchObject({ itemId: null, stock: 0, reserved: 0 });
    expect(s.displays[0].order).toMatchObject({ itemId: 'tshirt', totalMs: itemById('tshirt').deliverySec * 1000 });
    expect(s.decor.map((d) => d.decorId)).toEqual(['plant']);
    expect(s.stats).toMatchObject({ sold: 12, lost: 3, earned: 0 });
    expect(s.gems).toBe(3);
  });
});

describe('sin jugar', () => {
  it('entrega pedidos y vende a medio ritmo mientras no estás', () => {
    const s = createInitialState(T0);
    orderStock(s, 1, 'tshirt');
    const summary = simulateOffline(s, T0 + 30 * 60_000, seededRng(1));
    expect(summary.minutes).toBe(30);
    expect(summary.sold).toBe(itemById('tshirt').batchSize); // vendió todo lo que llegó
    expect(s.displays[0].stock).toBe(0);
    expect(s.time).toBe(T0 + 30 * 60_000);
  });

  it('no simula más de 4 horas', () => {
    const s = createInitialState(T0);
    const summary = simulateOffline(s, T0 + 48 * 3600_000, seededRng(1));
    expect(summary.minutes).toBe(240);
    expect(s.time).toBe(T0 + 48 * 3600_000);
  });
});
