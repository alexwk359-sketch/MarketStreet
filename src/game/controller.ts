import { DECOR, DISPLAYS, itemById, type DisplayKind } from '../sim/catalog';
import { clearSave, saveGame } from '../sim/save';
import { buyDecor, buyDisplay, orderStock, tick } from '../sim/sim';
import { createInitialState, type GameState, type SimEvent } from '../sim/state';

export type Mode =
  | { type: 'idle' }
  | { type: 'placeDisplay'; kind: DisplayKind }
  | { type: 'placeDecor'; decorId: string };

export type Panel = null | 'build' | 'decor' | { displayId: number };

export type ToastKind = 'info' | 'error' | 'good';

const MAX_STEP_MS = 100;
const AUTOSAVE_MS = 5000;

/** Une la simulación con el render (Phaser) y la interfaz (DOM). */
export class Controller {
  mode: Mode = { type: 'idle' };
  panel: Panel = null;
  toast: (msg: string, kind?: ToastKind) => void = () => {};
  private listeners = new Set<() => void>();
  private lastSave = 0;

  constructor(public state: GameState) {}

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  update(deltaMs: number, now: number) {
    // Si la pestaña estuvo oculta, saltamos el reloj hasta "ahora" (los pedidos
    // llegan igual) pero solo simulamos clientes durante un paso corto.
    const step = Math.min(deltaMs, MAX_STEP_MS);
    const behind = now - this.state.time;
    if (behind > 1000) this.state.time += behind - step;
    tick(this.state, step, Math.random);
    if (now - this.lastSave > AUTOSAVE_MS) this.save(now);
  }

  /** Devuelve los eventos de este frame y muestra los que van como aviso. */
  consumeEvents(): SimEvent[] {
    const events = this.state.events;
    this.state.events = [];
    for (const e of events) {
      if (e.type === 'delivered') this.toast(`🚚 Llegaron ${itemById(e.itemId).name.toLowerCase()}`, 'good');
      if (e.type === 'levelUp') this.toast(`⭐ ¡Nivel ${e.level}! Nuevos artículos y espacio para un expositor más`, 'good');
    }
    if (events.length > 0) this.notify();
    return events;
  }

  save(now = Date.now()) {
    this.lastSave = now;
    saveGame(this.state);
  }

  reset() {
    clearSave();
    this.state = createInitialState(Date.now());
    this.mode = { type: 'idle' };
    this.panel = null;
    this.notify();
  }

  openPanel(panel: Panel) {
    this.panel = panel;
    this.mode = { type: 'idle' };
    this.notify();
  }

  startPlacing(mode: Mode) {
    this.mode = mode;
    this.panel = null;
    this.notify();
  }

  cancelPlacing() {
    this.mode = { type: 'idle' };
    this.notify();
  }

  placementLabel(): string | null {
    if (this.mode.type === 'placeDisplay') return DISPLAYS[this.mode.kind].name;
    if (this.mode.type === 'placeDecor') {
      const id = this.mode.decorId;
      return DECOR.find((d) => d.id === id)?.name ?? null;
    }
    return null;
  }

  tapTile(x: number, y: number) {
    const mode = this.mode;
    if (mode.type === 'idle') return;
    const result =
      mode.type === 'placeDisplay'
        ? buyDisplay(this.state, mode.kind, x, y)
        : buyDecor(this.state, mode.decorId, x, y);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.mode = { type: 'idle' };
    if (mode.type === 'placeDisplay') {
      // Abrimos el expositor recién comprado para invitar a hacer el primer pedido.
      this.panel = { displayId: this.state.displays[this.state.displays.length - 1].id };
    }
    this.save();
    this.notify();
  }

  selectDisplay(id: number | null) {
    this.panel = id === null ? null : { displayId: id };
    this.notify();
  }

  order(displayId: number, itemId: string) {
    const result = orderStock(this.state, displayId, itemId);
    if (!result.ok) this.toast(result.error, 'error');
    else this.save();
    this.notify();
  }
}
