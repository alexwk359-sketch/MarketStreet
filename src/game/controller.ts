import { DECOR, DISPLAYS, itemById, type DisplayKind, type UpgradeId } from '../sim/catalog';
import type { OfflineSummary } from '../sim/offline';
import type { FurnitureRef } from '../sim/path';
import { clearSave, saveGame } from '../sim/save';
import {
  buyDecor,
  buyDisplay,
  buyExpansion,
  buyRegister,
  buyUpgrade,
  moveFurniture,
  orderStock,
  rushOrder,
  sellFurniture,
  tick,
  useStyle,
  type ActionResult,
} from '../sim/sim';
import { createInitialState, type GameState, type SimEvent } from '../sim/state';
import { claimTask } from '../sim/tasks';
import { sfx } from './sound';

export type Mode =
  | { type: 'idle' }
  | { type: 'placeDisplay'; kind: DisplayKind }
  | { type: 'placeRegister' }
  | { type: 'placeDecor'; decorId: string }
  | { type: 'move'; ref: FurnitureRef };

export type PanelId = 'build' | 'decor' | 'tasks' | 'upgrades' | 'help';
export type Panel = null | PanelId | { furniture: FurnitureRef };

export type Modal = null | { type: 'levelUp'; level: number } | { type: 'offline'; summary: OfflineSummary };

export type ToastKind = 'info' | 'error' | 'good';

const MAX_STEP_MS = 100;
const AUTOSAVE_MS = 5000;

/** Une la simulación con el render (Phaser) y la interfaz (DOM). */
export class Controller {
  mode: Mode = { type: 'idle' };
  panel: Panel = null;
  modal: Modal = null;
  toast: (msg: string, kind?: ToastKind) => void = () => {};
  private listeners = new Set<() => void>();
  private lastSave = 0;

  constructor(
    public state: GameState,
    offline: OfflineSummary | null,
  ) {
    if (offline && offline.minutes >= 1) this.modal = { type: 'offline', summary: offline };
  }

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

  /** Devuelve los eventos de este frame; avisos y sonidos se gestionan aquí. */
  consumeEvents(): SimEvent[] {
    const events = this.state.events;
    this.state.events = [];
    for (const e of events) {
      switch (e.type) {
        case 'delivered':
          sfx.truck();
          break;
        case 'autoOrder':
          this.toast(`El reponedor pidió más ${itemById(e.itemId).name.toLowerCase()}`, 'info');
          break;
        case 'sale':
          if (e.tip > 0) sfx.tip();
          else sfx.coin();
          if (e.gem) this.toast('¡Un cliente VIP te dejó un diamante!', 'good');
          break;
        case 'unhappy':
          sfx.angry();
          break;
        case 'vipArrived':
          sfx.vip();
          this.toast(`Ha llegado un cliente VIP: busca ${itemById(e.itemId).name.toLowerCase()}`, 'good');
          break;
        case 'trend':
          this.toast(`Nueva tendencia: ${DISPLAYS[e.kind].category} (+25% de precio)`, 'good');
          break;
        case 'levelUp':
          sfx.levelUp();
          this.modal = { type: 'levelUp', level: e.level };
          this.save();
          break;
      }
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
    this.modal = null;
    this.notify();
  }

  /** Ejecuta una acción de la simulación: guarda si sale bien, avisa si no. */
  private act(result: ActionResult, onOk?: () => void): boolean {
    if (!result.ok) {
      sfx.error();
      this.toast(result.error, 'error');
    } else {
      onOk?.();
      this.save();
    }
    this.notify();
    return result.ok;
  }

  openPanel(panel: Panel) {
    this.panel = panel;
    this.mode = { type: 'idle' };
    this.notify();
  }

  closeModal() {
    this.modal = null;
    this.notify();
  }

  startPlacing(mode: Mode) {
    this.mode = mode;
    this.panel = null;
    this.notify();
  }

  cancelPlacing() {
    const mode = this.mode;
    this.mode = { type: 'idle' };
    // Al cancelar un movimiento volvemos a la ficha del mueble.
    if (mode.type === 'move') this.panel = { furniture: mode.ref };
    this.notify();
  }

  placementLabel(): string | null {
    const m = this.mode;
    if (m.type === 'placeDisplay') return `Colocar: ${DISPLAYS[m.kind].name}`;
    if (m.type === 'placeRegister') return 'Colocar: Caja registradora';
    if (m.type === 'placeDecor') return `Colocar: ${DECOR.find((d) => d.id === m.decorId)?.name ?? ''}`;
    if (m.type === 'move') return 'Elige la nueva casilla';
    return null;
  }

  tapTile(x: number, y: number) {
    const m = this.mode;
    if (m.type === 'idle') return;
    let result: ActionResult;
    if (m.type === 'placeDisplay') result = buyDisplay(this.state, m.kind, x, y);
    else if (m.type === 'placeRegister') result = buyRegister(this.state, x, y);
    else if (m.type === 'placeDecor') result = buyDecor(this.state, m.decorId, x, y);
    else result = moveFurniture(this.state, m.ref, x, y);
    this.act(result, () => {
      sfx.place();
      if (m.type === 'placeDisplay') {
        // Abrimos el expositor recién comprado para invitar a hacer el primer pedido.
        const d = this.state.displays[this.state.displays.length - 1];
        this.panel = { furniture: { kind: 'display', id: d.id } };
        this.mode = { type: 'idle' };
      } else if (m.type === 'placeDecor') {
        // La decoración se suele poner de varias en varias: seguimos en modo colocar.
      } else {
        this.mode = { type: 'idle' };
        if (m.type === 'move') this.panel = { furniture: m.ref };
      }
    });
  }

  selectFurniture(ref: FurnitureRef | null) {
    this.panel = ref ? { furniture: ref } : null;
    if (ref) sfx.click();
    this.notify();
  }

  order(displayId: number, itemId: string) {
    this.act(orderStock(this.state, displayId, itemId), () => sfx.pop());
  }

  rush(displayId: number) {
    this.act(rushOrder(this.state, displayId), () => sfx.vip());
  }

  startMove(ref: FurnitureRef) {
    this.startPlacing({ type: 'move', ref });
  }

  sell(ref: FurnitureRef) {
    this.act(sellFurniture(this.state, ref), () => {
      sfx.coin();
      this.panel = null;
    });
  }

  buyUpgrade(id: UpgradeId) {
    this.act(buyUpgrade(this.state, id), () => sfx.claim());
  }

  expand() {
    this.act(buyExpansion(this.state), () => {
      sfx.levelUp();
      this.toast('¡Tienda ampliada!', 'good');
    });
  }

  useStyle(id: string) {
    this.act(useStyle(this.state, id), () => sfx.place());
  }

  claim(taskId: string) {
    if (claimTask(this.state, taskId)) {
      sfx.claim();
      this.save();
    }
    this.notify();
  }
}
