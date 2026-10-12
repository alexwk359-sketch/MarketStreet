import { DECOR, DISPLAYS, itemById, type DisplayKind, type UpgradeId } from '../sim/catalog';
import type { OfflineSummary } from '../sim/offline';
import { declineOrder, fulfillOrder } from '../sim/orders';
import { WEATHER } from '../sim/world';
import type { FurnitureRef } from '../sim/path';
import { claimDaily, dailyReward, dailyStatus, localDate } from '../sim/daily';
import { clearSave, deserialize, saveGame, serialize } from '../sim/save';
import {
  buyDecor,
  buyDisplay,
  buyExpansion,
  buyRegister,
  buyUpgrade,
  catchThief,
  moveFurniture,
  orderStock,
  rushOrder,
  sellFurniture,
  setPriceLevel,
  setStoreName,
  tick,
  useStyle,
  type ActionResult,
} from '../sim/sim';
import { createInitialState, type DaySummary, type GameState, type PriceLevel, type SimEvent } from '../sim/state';
import { claimTask } from '../sim/tasks';
import { sfx } from './sound';

export type Mode =
  | { type: 'idle' }
  | { type: 'placeDisplay'; kind: DisplayKind }
  | { type: 'placeRegister' }
  | { type: 'placeDecor'; decorId: string }
  | { type: 'move'; ref: FurnitureRef };

export type PanelId = 'build' | 'decor' | 'tasks' | 'upgrades' | 'stats';
export type Panel = null | PanelId | { furniture: FurnitureRef };

export type Modal =
  | { type: 'levelUp'; level: number }
  | { type: 'offline'; summary: OfflineSummary }
  | { type: 'daily'; streakDay: number; reward: { coins: number; gems: number } }
  | { type: 'dayEnd'; summary: DaySummary };

export type ToastKind = 'info' | 'error' | 'good';

const MAX_STEP_MS = 100;
const AUTOSAVE_MS = 5000;

/** Une la simulación con el render (Phaser) y la interfaz (DOM). */
export class Controller {
  mode: Mode = { type: 'idle' };
  panel: Panel = null;
  /** Ventanas pendientes: se muestran de una en una. */
  modals: Modal[] = [];
  /** Con un menú abierto (inicio, ajustes...) la simulación se detiene. */
  paused = false;
  toast: (msg: string, kind?: ToastKind) => void = () => {};
  private listeners = new Set<() => void>();
  private lastSave = 0;

  constructor(
    public state: GameState,
    offline: OfflineSummary | null,
  ) {
    if (offline && offline.minutes >= 1) this.modals.push({ type: 'offline', summary: offline });
    this.checkDaily(Date.now());
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  get modal(): Modal | null {
    return this.modals[0] ?? null;
  }

  /** Si hoy hay premio diario sin reclamar, lo pone en la cola de ventanas. */
  checkDaily(now: number) {
    const today = localDate(now);
    const yesterday = localDate(now - 86_400_000);
    const status = dailyStatus(this.state, today, yesterday);
    if (!status.available || this.modals.some((m) => m.type === 'daily')) return;
    this.modals.push({ type: 'daily', streakDay: status.streakDay, reward: dailyReward(status.streakDay, this.state.level) });
  }

  claimDaily() {
    const now = Date.now();
    const reward = claimDaily(this.state, localDate(now), localDate(now - 86_400_000));
    if (reward) {
      sfx.claim();
      this.save();
    }
    this.closeModal();
  }

  update(deltaMs: number, now: number) {
    if (this.paused) return;
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
          if (e.critic) this.toast('El crítico se ha ido decepcionado: ¡mala reseña!', 'error');
          break;
        case 'thiefArrived':
          sfx.siren();
          this.toast('¡Cuidado, ha entrado un ladrón! Tócalo para atraparlo', 'error');
          break;
        case 'stolen':
          this.toast(`El ladrón escapó con ${itemById(e.itemId).name.toLowerCase()}`, 'error');
          break;
        case 'thiefCaught':
          sfx.caught();
          this.toast(`¡Ladrón atrapado! Recompensa: ${e.reward} monedas`, 'good');
          break;
        case 'criticHappy':
          sfx.levelUp();
          this.toast('¡Reseña de cinco estrellas! La tienda se hace viral: llegan más clientes', 'good');
          break;
        case 'weather': {
          const w = WEATHER[e.kind];
          this.toast(`${w.name}: ${w.hint}`, 'info');
          break;
        }
        case 'orderNew':
          sfx.order();
          this.toast('Nuevo encargo especial', 'good');
          break;
        case 'orderDone':
          sfx.claim();
          break;
        case 'dayEnd':
          this.modals.push({ type: 'dayEnd', summary: e.summary });
          this.save();
          break;
        case 'orderExpired':
          this.toast('El encargo ha caducado', 'error');
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
          this.modals.push({ type: 'levelUp', level: e.level });
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
    this.modals = [];
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
    this.modals.shift();
    this.notify();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.notify();
  }

  /** Empieza de cero con el nombre de tienda elegido. */
  newGame(storeName: string) {
    this.reset();
    setStoreName(this.state, storeName);
    this.checkDaily(Date.now());
    this.save();
    this.notify();
  }

  renameStore(name: string) {
    this.act(setStoreName(this.state, name), () => this.toast('Nombre de la tienda cambiado', 'good'));
  }

  setPriceLevel(displayId: number, level: PriceLevel) {
    this.act(setPriceLevel(this.state, displayId, level), () => sfx.click());
  }

  /** Código de la partida para copiarlo en otro navegador. */
  exportSave(): string {
    return btoa(unescape(encodeURIComponent(serialize(this.state))));
  }

  importSave(code: string): boolean {
    try {
      const state = deserialize(decodeURIComponent(escape(atob(code.trim()))));
      this.state = state;
      this.modals = [];
      this.panel = null;
      this.save();
      this.notify();
      return true;
    } catch {
      return false;
    }
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

  catchThief(customerId: number) {
    this.act(catchThief(this.state, customerId));
  }

  fulfillOrder() {
    this.act(fulfillOrder(this.state), () => this.toast('¡Encargo entregado!', 'good'));
  }

  declineOrder() {
    declineOrder(this.state);
    sfx.click();
    this.save();
    this.notify();
  }

  claim(taskId: string) {
    if (claimTask(this.state, taskId)) {
      sfx.claim();
      this.save();
    }
    this.notify();
  }
}
