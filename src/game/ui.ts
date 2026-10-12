import {
  DECOR,
  DISPLAYS,
  FURNITURE_DECOR,
  EXPANSIONS,
  FLOORS,
  ITEMS,
  REGISTERS,
  UPGRADES,
  WALLS,
  decorById,
  type Department,
  type DisplayKind,
  type StyleDef,
  type UpgradeId,
} from '../sim/catalog';
import type { FurnitureRef } from '../sim/path';
import {
  capacity,
  decorHappiness,
  deliveryMs,
  happiness,
  maxDisplays,
  maxRegisters,
  registerPrice,
  rushCost,
  salePrice,
  sellValue,
  serveSeconds,
  upgradeLevel,
  xpForLevel,
} from '../sim/sim';
import type { GameState } from '../sim/state';
import { orderStockAvailable } from '../sim/orders';
import { activeTasks, claimableCount, isTaskDone, TASKS } from '../sim/tasks';
import { dayPeriod, PERIODS, weatherOf, type DayPeriod, type WeatherKind } from '../sim/world';
import type { Controller, PanelId, ToastKind } from './controller';
import { formatTime } from './format';
import { sfx } from './sound';
import { decorSprite, furnitureSprite, itemSprite, uiSprite, type UiSprite } from './sprites';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const img = (src: string, cls = 'icon') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
const ui = (name: UiSprite, cls?: string) => img(uiSprite(name), cls);
const fmt = (n: number) => n.toLocaleString('es-ES');
const coins = (n: number) => `${fmt(n)} ${ui('coin')}`;
const gems = (n: number) => `${fmt(n)} ${ui('gem')}`;
/** El sprite 3D del mueble; en tamaño icono se recorta para que se vea grande. */
const displayIcon = (kind: DisplayKind) => furnitureSprite(kind);
const hex = (n: number) => n.toString(16).padStart(6, '0');
const swatch = (s: StyleDef) => `<span class="card-img swatch" style="--a:#${hex(s.colors[0])};--b:#${hex(s.colors[1])}"></span>`;

type DecorTab = 'items' | 'floors' | 'walls';

/** Estado propio de la interfaz (no se guarda en la partida). */
const view = {
  decorTab: 'items' as DecorTab,
  confirmSell: '',
  lastPanelHtml: '',
  lastModalHtml: '',
};

export function mountUi(controller: Controller) {
  const hud = $('#hud');
  const panel = $('#panel');
  const placing = $('#placing');
  const modal = $('#modal');

  controller.toast = (msg: string, kind: ToastKind = 'info') => {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    const box = $('#toasts');
    box.append(el);
    while (box.children.length > 3) box.firstElementChild!.remove();
    setTimeout(() => el.classList.add('hide'), 2600);
    setTimeout(() => el.remove(), 3000);
  };

  // El audio solo puede empezar tras una interacción.
  window.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });

  $('#toolbar').addEventListener('click', (e) => {
    const tool = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]')?.dataset.tool as PanelId | undefined;
    if (!tool) return;
    sfx.click();
    view.confirmSell = '';
    controller.openPanel(controller.panel === tool ? null : tool);
  });

  hud.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-action="sound"]')) return;
    sfx.toggle();
    sfx.click();
    render();
  });

  panel.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const { action, kind, id, display } = el.dataset;
    const ref = (): FurnitureRef => ({ kind: kind as FurnitureRef['kind'], id: Number(id) });
    switch (action) {
      case 'close':
        controller.openPanel(null);
        break;
      case 'placeDisplay':
        controller.startPlacing({ type: 'placeDisplay', kind: kind as DisplayKind });
        break;
      case 'placeRegister':
        controller.startPlacing({ type: 'placeRegister' });
        break;
      case 'placeDecor':
        controller.startPlacing({ type: 'placeDecor', decorId: id! });
        break;
      case 'expand':
        controller.expand();
        break;
      case 'style':
        controller.useStyle(id!);
        break;
      case 'tab':
        view.decorTab = id as DecorTab;
        sfx.click();
        render();
        break;
      case 'order':
        controller.order(Number(display), id!);
        break;
      case 'rush':
        controller.rush(Number(display));
        break;
      case 'move':
        controller.startMove(ref());
        break;
      case 'sell': {
        // Vender pide una segunda pulsación para confirmar.
        const key = `${kind}:${id}`;
        if (view.confirmSell !== key) {
          view.confirmSell = key;
          render();
        } else {
          view.confirmSell = '';
          controller.sell(ref());
        }
        break;
      }
      case 'upgrade':
        controller.buyUpgrade(id as UpgradeId);
        break;
      case 'claim':
        controller.claim(id!);
        break;
      case 'reset':
        if (confirm('¿Seguro que quieres borrar la partida y empezar de cero?')) controller.reset();
        break;
    }
  });

  placing.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-action="cancel"]')) controller.cancelPlacing();
  });

  modal.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-action="close-modal"]') || e.target === modal) {
      sfx.click();
      controller.closeModal();
    }
  });

  const order = $('#order');
  order.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!action || (action as HTMLButtonElement).disabled) return;
    if (action.dataset.action === 'fulfill-order') controller.fulfillOrder();
    if (action.dataset.action === 'decline-order') controller.declineOrder();
  });
  let lastOrderHtml = '';

  const render = () => {
    const s = controller.state;
    hud.innerHTML = hudHtml(s);
    const orderCard = orderHtml(s);
    order.hidden = !orderCard;
    if (orderCard !== lastOrderHtml) {
      order.innerHTML = orderCard;
      lastOrderHtml = orderCard;
    }

    const label = controller.placementLabel();
    placing.hidden = !label;
    if (label) {
      const decor = controller.mode.type === 'placeDecor';
      placing.innerHTML = `<span>${label}${decor ? ' · puedes colocar varias' : ''}</span> <button data-action="cancel">${decor ? 'Listo' : 'Cancelar'}</button>`;
    }

    const html = panelHtml(controller);
    panel.hidden = !html;
    // Solo reescribimos el panel si cambió, para no perder clics a medio pulsar ni el scroll.
    if (html !== view.lastPanelHtml) {
      const scroll = panel.scrollTop;
      panel.innerHTML = html ? `<button class="close" data-action="close" aria-label="Cerrar">✕</button>${html}` : '';
      panel.scrollTop = scroll;
      view.lastPanelHtml = html;
    }

    const modalHtml = modalContent(controller);
    modal.hidden = !modalHtml;
    if (modalHtml !== view.lastModalHtml) {
      modal.innerHTML = modalHtml;
      view.lastModalHtml = modalHtml;
    }

    const claimable = claimableCount(s);
    const badge = $('#tasks-badge');
    badge.hidden = claimable === 0;
    badge.textContent = String(claimable);
    document.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === controller.panel));
  };

  controller.onChange(() => {
    if (typeof controller.panel !== 'object' || controller.panel === null) view.confirmSell = '';
    render();
  });
  setInterval(render, 250);
  render();
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function hudHtml(s: GameState): string {
  const hap = Math.round(happiness(s));
  const xpFrom = xpForLevel(s.level);
  const xpTo = xpForLevel(s.level + 1);
  const weather = weatherOf(s);
  const period = dayPeriod(s.time);
  const world = `<span class="chip world" title="${weather.name}: ${weather.hint}">${ui(WEATHER_ICONS[weather.kind])}${ui(PERIOD_ICONS[period])}
      <span>${weather.name} · ${PERIODS[period].name}</span></span>`;
  const viral = s.time < s.boostUntil
    ? `<span class="chip viral" title="Un crítico habló bien de la tienda: llegan más clientes">${ui('hundred')} Viral <small>${formatTime(s.boostUntil - s.time)}</small></span>`
    : '';
  const trend = s.trend
    ? `<span class="chip trend" title="Esta categoría se vende un 25% más cara y atrae más clientes">
        ${ui('fire')} ${DISPLAYS[s.trend.kind].category} <small>${formatTime(s.trend.until - s.time)}</small></span>`
    : '';
  return `
    <span class="stat" title="Monedas">${ui('coin')} <b>${fmt(s.coins)}</b></span>
    <span class="stat" title="Diamantes">${ui('gem')} <b>${s.gems}</b></span>
    <span class="stat" title="Nivel · experiencia: ${fmt(s.xp)} / ${fmt(xpTo)}">${ui('star')} <b>${s.level}</b>
      <span class="bar"><span style="width:${((s.xp - xpFrom) / (xpTo - xpFrom)) * 100}%"></span></span></span>
    <span class="stat" title="Felicidad de la clientela">${ui(hap >= 50 ? 'love' : 'angry')} <b>${hap}%</b>
      <span class="bar happy"><span style="width:${hap}%"></span></span></span>
    ${world}${viral}${trend}
    <button class="sound" data-action="sound" title="Sonido">${ui(sfx.muted ? 'mute' : 'sound')}</button>`;
}

const WEATHER_ICONS: Record<WeatherKind, UiSprite> = { sunny: 'sun', cloudy: 'cloudsun', rain: 'rain', heat: 'hot', snow: 'snow' };
const PERIOD_ICONS: Record<DayPeriod, UiSprite> = { morning: 'sunrise', day: 'sun', evening: 'sunset', night: 'moon' };

/** Tarjeta del encargo especial en curso. */
function orderHtml(s: GameState): string {
  const o = s.specialOrder;
  if (!o) return '';
  const item = ITEMS.find((i) => i.id === o.itemId)!;
  const have = Math.min(o.qty, orderStockAvailable(s, o.itemId));
  const ready = have >= o.qty;
  return `<div class="order-card">
    <div class="order-head">${ui('memo')} <b>Encargo</b> <small>${o.client}</small>
      <button class="x" data-action="decline-order" title="Rechazar">✕</button></div>
    <div class="order-body">${img(itemSprite(item.id), 'order-item')}
      <span><b>${o.qty} ${item.name.toLowerCase()}</b>
      <span class="task-bar small"><span style="width:${(have / o.qty) * 100}%"></span></span> ${have}/${o.qty} en estantes</span></div>
    <div class="order-foot"><span>${ui('hourglass')} ${formatTime(o.expiresAt - s.time)}</span>
      <span class="reward">${coins(o.reward.coins)} ${gems(o.reward.gems)}</span>
      <button data-action="fulfill-order" ${ready ? '' : 'disabled'}>${ready ? 'Entregar' : 'Faltan'}</button></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Paneles
// ---------------------------------------------------------------------------

function panelHtml(c: Controller): string {
  const s = c.state;
  const p = c.panel;
  if (p === null) return '';
  if (p === 'build') return buildPanel(s);
  if (p === 'decor') return decorPanel(s);
  if (p === 'tasks') return tasksPanel(s);
  if (p === 'upgrades') return upgradesPanel(s);
  if (p === 'help') return HELP_HTML;
  const ref = p.furniture;
  if (ref.kind === 'display') return displayPanel(s, ref.id);
  if (ref.kind === 'register') return registerPanel(s, ref.id);
  return decorItemPanel(s, ref.id);
}

/** Motivo por el que no se puede comprar algo, o '' si se puede. */
function blocker(s: GameState, unlockLevel: number, price: number, extra = '', useGems = false) {
  if (unlockLevel > s.level) return `Nivel ${unlockLevel}`;
  if (extra) return extra;
  if (useGems ? s.gems < price : s.coins < price) return useGems ? 'Faltan diamantes' : 'Faltan monedas';
  return '';
}

function button(action: string, label: string, reason: string, data: Record<string, string | number> = {}) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ');
  return `<button data-action="${action}" ${attrs} ${reason ? 'disabled' : ''}>${reason || label}</button>`;
}

function buildPanel(s: GameState): string {
  const max = maxDisplays(s.level);
  const full = s.displays.length >= max;
  const displayCards = (department: Department) =>
    Object.values(DISPLAYS)
      .filter((d) => d.department === department)
      .map((d) => {
        const items = ITEMS.filter((i) => i.display === d.kind).map((i) => img(itemSprite(i.id), 'mini')).join('');
        return card(img(displayIcon(d.kind), 'card-img furniture'), d.name, `<span class="minis">${items}</span>${d.category} · caben ${capacity(s, d.kind)}`,
          coins(d.price), button('placeDisplay', 'Colocar', blocker(s, d.unlockLevel, d.price, full ? 'Sin hueco' : ''), { kind: d.kind }), d.unlockLevel > s.level);
      })
      .join('');

  const nextReg = REGISTERS[s.registers.length];
  const register = nextReg
    ? card(ui('bell', 'card-img'), 'Caja registradora', 'Más cajas, colas más cortas', coins(registerPrice(s)),
        button('placeRegister', 'Colocar', blocker(s, nextReg.unlockLevel, nextReg.price)), nextReg.unlockLevel > s.level)
    : '<p class="muted">Tienes todas las cajas disponibles.</p>';

  const next = EXPANSIONS[s.expansion + 1];
  const size = EXPANSIONS[s.expansion];
  const expansion = next
    ? card(ui('store', 'card-img'), 'Ampliar la tienda', `De ${size.w}×${size.h} a ${next.w}×${next.h} casillas`, coins(next.price),
        button('expand', 'Ampliar', blocker(s, next.unlockLevel, next.price)), next.unlockLevel > s.level)
    : '<p class="muted">La tienda ya tiene el tamaño máximo.</p>';

  return `<h2>${ui('build')} Construir</h2>
    <p class="muted">Expositores: <b>${s.displays.length} / ${max}</b>${full ? ' · sube de nivel para tener más hueco' : ''}</p>
    <h3>Tienda</h3>${displayCards('store')}
    <h3>Alimentación</h3>${displayCards('food')}
    <h3>Cajas <small>${s.registers.length} / ${maxRegisters(s.level)}</small></h3>${register}
    <h3>Local</h3>${expansion}`;
}

function decorPanel(s: GameState): string {
  const tab = (id: DecorTab, label: string) => `<button class="tab ${view.decorTab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${label}</button>`;
  let body: string;
  if (view.decorTab === 'items') {
    body = `<p class="muted">Felicidad por decoración: ${decorHappiness(s)}% de un máximo de 40%.</p>` +
      DECOR.map((d) => {
        const picture = img(decorSprite(d.id), FURNITURE_DECOR.has(d.id) ? 'card-img furniture' : 'card-img');
        return card(picture, d.name, `+${d.happiness}% felicidad`, d.gems ? gems(d.price) : coins(d.price),
          button('placeDecor', 'Colocar', blocker(s, d.unlockLevel, d.price, '', d.gems), { id: d.id }), d.unlockLevel > s.level);
      }).join('');
  } else {
    const styles = view.decorTab === 'floors' ? FLOORS : WALLS;
    const current = view.decorTab === 'floors' ? s.floor : s.wall;
    body = styles.map((st) => {
      const owned = s.ownedStyles.includes(st.id);
      const action = st.id === current
        ? '<button disabled>En uso</button>'
        : button('style', owned ? 'Usar' : 'Comprar', owned ? '' : blocker(s, st.unlockLevel, st.price), { id: st.id });
      return card(swatch(st), st.name, owned ? 'Ya es tuyo' : '', owned ? '' : coins(st.price), action, st.unlockLevel > s.level);
    }).join('');
  }
  return `<h2>${ui('palette')} Decorar</h2>
    <div class="tabs">${tab('items', 'Objetos')}${tab('floors', 'Suelos')}${tab('walls', 'Paredes')}</div>${body}`;
}

function tasksPanel(s: GameState): string {
  const tasks = activeTasks(s);
  const done = s.claimedTasks.length;
  const list = tasks.map((t) => {
    const progress = Math.min(t.target, t.progress(s));
    const complete = isTaskDone(s, t);
    const reward = [t.reward.coins && coins(t.reward.coins), t.reward.gems && gems(t.reward.gems), t.reward.xp && `${t.reward.xp} ${ui('star')}`]
      .filter(Boolean)
      .join(' ');
    return `<div class="task ${complete ? 'complete' : ''}">
      <div class="task-head"><b>${t.text}</b><span class="reward">${reward}</span></div>
      <div class="task-bar"><span style="width:${(progress / t.target) * 100}%"></span><em>${fmt(progress)} / ${fmt(t.target)}</em></div>
      ${complete ? `<button data-action="claim" data-id="${t.id}">${ui('gift')} Reclamar</button>` : ''}
    </div>`;
  });
  const empty = done === TASKS.length
    ? `<p>${ui('trophy')} ¡Has completado todas las tareas!</p>`
    : '<p class="muted">Sube de nivel para desbloquear más tareas.</p>';
  return `<h2>${ui('clipboard')} Tareas del encargado</h2>
    <p class="muted">Completadas: ${done} / ${TASKS.length}</p>${tasks.length ? list.join('') : empty}`;
}

const UPGRADE_ICONS: Record<UpgradeId, UiSprite> = {
  cashier: 'bell', stocker: 'cart', ads: 'megaphone', express: 'rocket', storage: 'package', music: 'sound',
};

function upgradesPanel(s: GameState): string {
  const cards = UPGRADES.map((u) => {
    const lvl = upgradeLevel(s, u.id);
    const maxed = lvl >= u.costs.length;
    const pips = u.costs.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    const detail = maxed ? `${u.effects[lvl - 1]} · <b>al máximo</b>` : `Siguiente: ${u.effects[lvl]}`;
    const action = maxed ? '<button disabled>Máximo</button>' : button('upgrade', 'Mejorar', blocker(s, u.levels[lvl], u.costs[lvl]), { id: u.id });
    return card(ui(UPGRADE_ICONS[u.id], 'card-img'), `${u.name} <span class="pips">${pips}</span>`, detail,
      maxed ? '' : coins(u.costs[lvl]), action, !maxed && u.levels[lvl] > s.level);
  });
  return `<h2>${ui('chart')} Mejoras</h2>${cards.join('')}`;
}

function furnitureActions(s: GameState, ref: FurnitureRef) {
  const key = `${ref.kind}:${ref.id}`;
  const sellLabel = view.confirmSell === key ? `¿Seguro? +${fmt(sellValue(s, ref))}` : 'Vender';
  return `<div class="actions">
    <button class="ghost" data-action="move" data-kind="${ref.kind}" data-id="${ref.id}">${ui('build')} Mover</button>
    <button class="ghost danger" data-action="sell" data-kind="${ref.kind}" data-id="${ref.id}">${ui('trash')} ${sellLabel}</button>
  </div>`;
}

function displayPanel(s: GameState, id: number): string {
  const d = s.displays.find((x) => x.id === id);
  if (!d) return '';
  const def = DISPLAYS[d.kind];
  const cap = capacity(s, d.kind);
  const current = d.itemId && d.stock > 0 ? ITEMS.find((i) => i.id === d.itemId)! : null;
  let status = current ? `${img(itemSprite(current.id))} ${current.name}: <b>${d.stock}</b> / ${cap}` : 'Vacío: ¡pide mercancía!';
  if (d.order) {
    const coming = ITEMS.find((i) => i.id === d.order!.itemId)!;
    const left = d.order.readyAt - s.time;
    const cost = rushCost(s, d);
    status += `<span class="order">${ui('truck')} ${coming.name} en <b>${formatTime(left)}</b>
      <span class="task-bar small"><span style="width:${(1 - left / d.order.totalMs) * 100}%"></span></span>
      <button data-action="rush" data-display="${d.id}" ${s.gems < cost ? 'disabled' : ''}>${ui('rocket')} Ya · ${gems(cost)}</button></span>`;
  }
  const trending = s.trend?.kind === d.kind;
  const items = ITEMS.filter((i) => i.display === d.kind).map((i) => {
    const busy = d.order ? 'En camino' : d.stock > 0 && d.itemId !== i.id ? 'Vende lo actual' : d.stock + i.batchSize > cap ? 'Lleno' : '';
    const price = salePrice(s, i);
    const profit = i.batchSize * price - i.batchCost;
    return card(img(itemSprite(i.id), 'card-img'), i.name,
      `${i.batchSize} uds · ${ui('truck')} ${formatTime(deliveryMs(s, i))} · vende a ${price}${trending ? ` ${ui('fire')}` : ''} · ganas ${fmt(profit)}`,
      coins(i.batchCost), button('order', 'Pedir', blocker(s, i.unlockLevel, i.batchCost, busy), { display: d.id, id: i.id }), i.unlockLevel > s.level);
  });
  return `<h2>${img(displayIcon(d.kind), 'icon furniture')} ${def.name}${trending ? ` <span class="chip trend">${ui('fire')} En tendencia</span>` : ''}</h2>
    <p>${status}</p>${furnitureActions(s, { kind: 'display', id: d.id })}${items.join('')}`;
}

function registerPanel(s: GameState, id: number): string {
  if (!s.registers.some((r) => r.id === id)) return '';
  const waiting = s.customers.filter((c) => c.registerId === id).length;
  return `<h2>${ui('bell')} Caja registradora</h2>
    <p>Cobra en ${serveSeconds(s).toFixed(1)} s por cliente. En cola: <b>${waiting}</b>.</p>
    <p class="muted">Si la cola es larga, los clientes se cansan y se van. Compra más cajas o la mejora «Cajeros rápidos».</p>
    ${furnitureActions(s, { kind: 'register', id })}`;
}

function decorItemPanel(s: GameState, id: number): string {
  const d = s.decor.find((x) => x.id === id);
  if (!d) return '';
  const def = decorById(d.decorId);
  const picture = img(decorSprite(d.decorId));
  return `<h2>${picture} ${def.name}</h2><p>+${def.happiness}% de felicidad.</p>
    ${def.gems ? '<p class="muted">Se compró con diamantes: venderla no devuelve nada.</p>' : ''}
    ${furnitureActions(s, { kind: 'decor', id })}`;
}

function card(picture: string, name: string, detail: string, price: string, action: string, locked: boolean) {
  return `<div class="card ${locked ? 'locked' : ''}">
    <span class="card-icon">${picture}${locked ? '<span class="lock">🔒</span>' : ''}</span>
    <span class="card-body"><b>${name}</b><small>${detail}</small></span>
    <span class="card-buy">${price ? `<span class="price">${price}</span>` : ''}${action}</span>
  </div>`;
}

const HELP_HTML = `
  <h2>¿Cómo se juega?</h2>
  <ol class="help">
    <li><b>Toca un expositor</b> y pide mercancía. El camión tarda un rato; con diamantes llega al momento.</li>
    <li>Los <b>clientes</b> llegan por la acera, buscan un artículo, lo cogen y pagan en la caja.</li>
    <li>Si no encuentran lo que buscan o la cola es muy larga, se van enfadados y baja la <b>felicidad</b>.</li>
    <li>La felicidad atrae más clientes y, por encima del 70%, te dejan <b>propinas</b>. Decora para subirla.</li>
    <li>Atento a la <b>tendencia</b>: esa categoría se vende un 25% más cara.</li>
    <li>Los clientes <b>VIP</b> (con corona) pagan el triple y a veces dejan un diamante.</li>
    <li>Completa las <b>tareas</b> del encargado y compra <b>mejoras</b> para crecer más rápido.</li>
    <li>Hay muchos tipos de cliente: <b>con lista</b> (compran varias cosas), <b>niños</b>, <b>abuelos</b> (lentos pero pacientes), <b>turistas</b> (pagan más) y <b>críticos</b>: si salen contentos, la tienda se hace viral.</li>
    <li>¡Ojo con los <b>ladrones</b>! Si ves a uno huyendo con la sirena encima, tócalo para atraparlo.</li>
    <li>El <b>tiempo</b> y la <b>hora</b> cambian la clientela: con calor se venden helados; con lluvia, ropa y pan; de noche viene menos gente.</li>
    <li>Atiende los <b>encargos especiales</b>: pide muchas unidades a tiempo y entrégalas desde la tarjeta para una gran recompensa.</li>
    <li>Toca un mueble para <b>moverlo o venderlo</b>. Arrastra para mover la vista; usa la rueda o pellizca para hacer zoom.</li>
  </ol>
  <p class="muted">La partida se guarda sola en este navegador. Mientras no juegas, los pedidos llegan y la tienda sigue vendiendo (más despacio).</p>
  <button data-action="reset" class="danger">Reiniciar partida</button>
`;

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------

function modalContent(c: Controller): string {
  const m = c.modal;
  if (!m) return '';
  if (m.type === 'offline') {
    const { minutes, sold, coins: earned } = m.summary;
    const time = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
    const result = sold > 0
      ? `<p>Tu tienda vendió <b>${fmt(sold)}</b> artículos y ganó <b>${coins(earned)}</b>.</p>`
      : '<p>No había mercancía en los expositores, así que no se vendió nada. ¡Haz pedidos antes de irte!</p>';
    return `<div class="dialog">${ui('store', 'hero')}<h2>¡Bienvenido de vuelta!</h2>
      <p>Has estado fuera ${time}.</p>${result}
      <button data-action="close-modal">¡A trabajar!</button></div>`;
  }
  const level = m.level;
  const unlock = (src: string, name: string, furniture = false) => `<div>${img(src, furniture ? 'unlock furniture' : 'unlock')}<span>${name}</span></div>`;
  const unlocks = [
    ...Object.values(DISPLAYS).filter((d) => d.unlockLevel === level).map((d) => unlock(displayIcon(d.kind), d.name, true)),
    ...ITEMS.filter((i) => i.unlockLevel === level).map((i) => unlock(itemSprite(i.id), i.name)),
    ...DECOR.filter((d) => d.unlockLevel === level).map((d) => unlock(decorSprite(d.id), d.name, FURNITURE_DECOR.has(d.id))),
    ...(EXPANSIONS.some((e) => e.unlockLevel === level) ? [unlock(uiSprite('store'), 'Ampliación')] : []),
    ...(REGISTERS.some((r) => r.unlockLevel === level) ? [unlock(uiSprite('bell'), 'Otra caja')] : []),
  ];
  return `<div class="dialog">${ui('star', 'hero')}<h2>¡Nivel ${level}!</h2>
    <p>Recompensa: ${gems(2)} y un hueco más para expositores.</p>
    ${unlocks.length ? `<h3>Desbloqueado</h3><div class="unlocks">${unlocks.join('')}</div>` : ''}
    <button data-action="close-modal">¡Genial!</button></div>`;
}
