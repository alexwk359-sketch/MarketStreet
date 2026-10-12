import { DECOR, DISPLAYS, ITEMS, type DisplayKind } from '../sim/catalog';
import { happiness, maxDisplays, xpForLevel } from '../sim/sim';
import type { Controller, ToastKind } from './controller';
import { formatTime } from './format';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const HELP_HTML = `
  <h2>¿Cómo se juega?</h2>
  <ol class="help">
    <li><b>Toca un expositor</b> y pide mercancía. El camión tarda un rato en llegar.</li>
    <li>Los <b>clientes</b> entran buscando un artículo, lo cogen y pagan en la caja 💰.</li>
    <li>Si no encuentran lo que buscan se van enfadados 😠 y baja la <b>felicidad</b>.</li>
    <li>La felicidad atrae más clientes. La <b>decoración</b> 🪴 la sube.</li>
    <li>Cada venta da <b>experiencia</b>: al subir de nivel se desbloquean artículos y huecos para expositores.</li>
  </ol>
  <p class="muted">La partida se guarda sola en este navegador. Los pedidos siguen llegando aunque cierres el juego.</p>
  <button data-action="reset" class="danger">Reiniciar partida</button>
`;

export function mountUi(controller: Controller) {
  const hud = $('#hud');
  const panel = $('#panel');
  const placing = $('#placing');
  let helpOpen = false;
  let lastPanelHtml = '';

  controller.toast = (msg: string, kind: ToastKind = 'info') => {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => el.classList.add('hide'), 2600);
    setTimeout(() => el.remove(), 3000);
  };

  $('#toolbar').addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]')?.dataset.tool;
    if (!action) return;
    const current = controller.panel;
    helpOpen = action === 'help' ? !helpOpen : false;
    if (action === 'build') controller.openPanel(current === 'build' ? null : 'build');
    else if (action === 'decor') controller.openPanel(current === 'decor' ? null : 'decor');
    else controller.openPanel(null);
  });

  panel.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const { action, kind, id, display } = el.dataset;
    if (action === 'close') {
      helpOpen = false;
      controller.openPanel(null);
    } else if (action === 'placeDisplay') controller.startPlacing({ type: 'placeDisplay', kind: kind as DisplayKind });
    else if (action === 'placeDecor') controller.startPlacing({ type: 'placeDecor', decorId: id! });
    else if (action === 'order') controller.order(Number(display), id!);
    else if (action === 'reset' && confirm('¿Seguro que quieres borrar la partida y empezar de cero?')) {
      helpOpen = false;
      controller.reset();
    }
  });

  placing.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-action="cancel"]')) controller.cancelPlacing();
  });

  const render = () => {
    const s = controller.state;
    const hap = Math.round(happiness(s));
    const xpFrom = xpForLevel(s.level);
    const xpTo = xpForLevel(s.level + 1);
    hud.innerHTML = `
      <span class="stat" title="Monedas">🪙 <b>${s.coins}</b></span>
      <span class="stat" title="Experiencia: ${s.xp} / ${xpTo}">⭐ Nivel <b>${s.level}</b>
        <span class="bar"><span style="width:${((s.xp - xpFrom) / (xpTo - xpFrom)) * 100}%"></span></span></span>
      <span class="stat" title="Felicidad de la tienda">${hap >= 60 ? '😊' : hap >= 30 ? '😐' : '😟'} <b>${hap}%</b>
        <span class="bar happy"><span style="width:${hap}%"></span></span></span>
      <span class="stat muted" title="Ventas / clientes perdidos">🛍️ ${s.stats.sold} · 😠 ${s.stats.lost}</span>`;

    const label = controller.placementLabel();
    placing.hidden = !label;
    if (label) placing.innerHTML = `Toca una casilla libre para colocar: <b>${label}</b> <button data-action="cancel">Cancelar</button>`;

    const html = helpOpen ? HELP_HTML : panelHtml(controller);
    panel.hidden = !html;
    // Solo reescribimos el panel si cambió, para no perder clics a medio pulsar.
    if (html && html !== lastPanelHtml) panel.innerHTML = `<button class="close" data-action="close" aria-label="Cerrar">✕</button>${html}`;
    lastPanelHtml = html;

    document.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => {
      const tool = b.dataset.tool;
      b.classList.toggle('active', helpOpen ? tool === 'help' : tool === controller.panel);
    });
  };

  controller.onChange(render);
  setInterval(render, 250);
  render();
}

function panelHtml(c: Controller): string {
  const s = c.state;
  const panel = c.panel;
  if (panel === 'build') {
    const max = maxDisplays(s.level);
    const full = s.displays.length >= max;
    const cards = Object.values(DISPLAYS).map((d) => {
      const items = ITEMS.filter((i) => i.display === d.kind).map((i) => i.icon).join(' ');
      const locked = d.unlockLevel > s.level;
      const reason = locked ? `Nivel ${d.unlockLevel}` : full ? 'Sin hueco' : s.coins < d.price ? 'Faltan monedas' : '';
      return card(d.icon, d.name, `Vende: ${items} · Capacidad ${d.capacity}`, d.price,
        `<button data-action="placeDisplay" data-kind="${d.kind}" ${reason ? 'disabled' : ''}>${reason || 'Colocar'}</button>`, locked);
    });
    return `<h2>Expositores <small>${s.displays.length} / ${max}</small></h2>
      ${full ? '<p class="muted">Sube de nivel para tener más hueco.</p>' : ''}${cards.join('')}`;
  }

  if (panel === 'decor') {
    const cards = DECOR.map((d) => {
      const locked = d.unlockLevel > s.level;
      const reason = locked ? `Nivel ${d.unlockLevel}` : s.coins < d.price ? 'Faltan monedas' : '';
      return card(d.icon, d.name, `+${d.happiness}% felicidad`, d.price,
        `<button data-action="placeDecor" data-id="${d.id}" ${reason ? 'disabled' : ''}>${reason || 'Colocar'}</button>`, locked);
    });
    return `<h2>Decoración</h2><p class="muted">La decoración suma hasta un +40% de felicidad.</p>${cards.join('')}`;
  }

  if (panel && typeof panel === 'object') {
    const d = s.displays.find((x) => x.id === panel.displayId);
    if (!d) return '';
    const def = DISPLAYS[d.kind];
    const current = d.itemId && d.stock > 0 ? ITEMS.find((i) => i.id === d.itemId)! : null;
    let status = current ? `${current.icon} ${current.name}: <b>${d.stock}</b> / ${def.capacity}` : 'Vacío: ¡pide mercancía!';
    if (d.order) {
      const coming = ITEMS.find((i) => i.id === d.order!.itemId)!;
      status += `<br>🚚 ${coming.name} llegan en <b>${formatTime(d.order.readyAt - s.time)}</b>`;
    }
    const cards = ITEMS.filter((i) => i.display === d.kind).map((i) => {
      const locked = i.unlockLevel > s.level;
      const reason = locked ? `Nivel ${i.unlockLevel}`
        : d.order ? 'En camino'
        : d.stock > 0 && d.itemId !== i.id ? 'Vende lo actual'
        : d.stock + i.batchSize > def.capacity ? 'Lleno'
        : s.coins < i.batchCost ? 'Faltan monedas' : '';
      const profit = i.batchSize * i.salePrice - i.batchCost;
      return card(i.icon, i.name,
        `${i.batchSize} uds · ⏱ ${formatTime(i.deliverySec * 1000)} · vende a ${i.salePrice}🪙 (+${profit}🪙)`, i.batchCost,
        `<button data-action="order" data-display="${d.id}" data-id="${i.id}" ${reason ? 'disabled' : ''}>${reason || 'Pedir'}</button>`, locked);
    });
    return `<h2>${def.icon} ${def.name}</h2><p>${status}</p>${cards.join('')}`;
  }
  return '';
}

function card(icon: string, name: string, detail: string, price: number, button: string, locked: boolean) {
  return `<div class="card ${locked ? 'locked' : ''}">
    <span class="card-icon">${locked ? '🔒' : icon}</span>
    <span class="card-body"><b>${name}</b><small>${detail}</small></span>
    <span class="card-buy"><span class="price">${price} 🪙</span>${button}</span>
  </div>`;
}
