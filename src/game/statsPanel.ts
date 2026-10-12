// Panel de estadísticas: cifras de hoy frente a ayer, ingresos de los últimos días,
// lo más vendido y el historial de la tienda.
import { ITEMS } from '../sim/catalog';
import { todaySoFar } from '../sim/days';
import type { DaySummary, GameState } from '../sim/state';
import { compact, fmt, img, ui } from './html';
import { itemSprite } from './sprites';

const CHART_DAYS = 10;

/** Tarjeta de cifra con su variación respecto a ayer (`upIsGood` dice si subir es bueno). */
function tile(label: string, value: number, previous: number | undefined, upIsGood = true) {
  let delta = '';
  if (previous !== undefined) {
    const diff = value - previous;
    const good = diff === 0 ? 'flat' : diff > 0 === upIsGood ? 'good' : 'bad';
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
    delta = `<span class="delta ${good}">${sign}${fmt(Math.abs(diff))} <small>vs ayer</small></span>`;
  }
  return `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value">${fmt(value)}</span>${delta}</div>`;
}

/**
 * Columnas de ingresos por día. Una sola serie, así que sin leyenda: el título dice qué es.
 * Solo se rotula el máximo; el resto se ve con el ratón (o en la tabla).
 */
function incomeChart(days: { label: string; earned: number; sold: number; today: boolean }[]) {
  if (days.length === 0) return '<p class="muted">Aún no ha terminado ningún día. Vuelve al amanecer.</p>';
  const max = Math.max(...days.map((d) => d.earned), 1);
  const nice = niceMax(max);
  const best = days.reduce((a, b) => (b.earned > a.earned ? b : a));
  const cols = days.map((d) => {
    const h = (d.earned / nice) * 100;
    const label = d === best && d.earned > 0 ? `<span class="col-value">${compact(d.earned)}</span>` : '';
    return `<div class="col ${d.today ? 'today' : ''}" tabindex="0">
      <div class="col-track">${label}<span class="bar" style="height:${h}%"></span></div>
      <span class="col-label">${d.label}</span>
      <span class="tip"><b>${d.today ? 'Hoy (en curso)' : d.label}</b>${fmt(d.earned)} monedas · ${fmt(d.sold)} ventas</span>
    </div>`;
  });
  return `<div class="chart" role="img" aria-label="Ingresos por día">
    <div class="axis"><span>${compact(nice)}</span><span>${compact(nice / 2)}</span><span>0</span></div>
    <div class="cols">${cols.join('')}</div>
  </div>
  <details class="table-view"><summary>Ver como tabla</summary>
    <table><thead><tr><th>Día</th><th>Ingresos</th><th>Ventas</th></tr></thead>
    <tbody>${days.map((d) => `<tr><td>${d.today ? 'Hoy' : d.label}</td><td>${fmt(d.earned)}</td><td>${fmt(d.sold)}</td></tr>`).join('')}</tbody></table>
  </details>`;
}

/** Máximo del eje redondeado a un número limpio (1, 2, 2,5 o 5 por potencia de 10). */
function niceMax(n: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= n) return step * pow;
  return 10 * pow;
}

function bestSellers(s: GameState) {
  const top = Object.entries(s.stats.soldByItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (top.length === 0) return '<p class="muted">Todavía no has vendido nada.</p>';
  const max = top[0][1];
  return `<ol class="best">${top
    .map(([id, count]) => {
      const item = ITEMS.find((i) => i.id === id);
      if (!item) return '';
      return `<li>${img(itemSprite(id))}<span class="best-name">${item.name}</span>
        <span class="best-bar"><span style="width:${(count / max) * 100}%"></span></span><b>${fmt(count)}</b></li>`;
    })
    .join('')}</ol>`;
}

export function statsPanel(s: GameState): string {
  const today = todaySoFar(s);
  const yesterday: DaySummary | undefined = s.history[s.history.length - 1];
  const days = [
    ...s.history.slice(-(CHART_DAYS - 1)).map((d) => ({ label: `Día ${d.day}`, earned: d.earned, sold: d.sold, today: false })),
    ...(today ? [{ label: 'Hoy', earned: today.earned, sold: today.sold, today: true }] : []),
  ];
  const st = s.stats;
  const totals: [string, number][] = [
    ['Artículos vendidos', st.sold],
    ['Monedas ganadas', st.earned],
    ['Propinas', st.tips],
    ['Clientes perdidos', st.lost],
    ['Clientes VIP atendidos', st.vipServed],
    ['Clientes con lista', st.listServed],
    ['Buenas reseñas', st.criticsHappy],
    ['Encargos entregados', st.ordersDone],
    ['Ladrones atrapados', st.thievesCaught],
    ['Robos', st.stolen],
    ['Días cerrados', st.daysClosed],
  ];
  return `<h2>${ui('chart')} Estadísticas</h2>
    <h3>Hoy</h3>
    <div class="tiles">
      ${tile('Ventas', today?.sold ?? 0, yesterday?.sold)}
      ${tile('Ingresos', today?.earned ?? 0, yesterday?.earned)}
      ${tile('Perdidos', today?.lost ?? 0, yesterday?.lost, false)}
    </div>
    <h3>Ingresos por día</h3>${incomeChart(days)}
    <h3>Lo más vendido</h3>${bestSellers(s)}
    <h3>Desde que abriste</h3>
    <dl class="totals">${totals.map(([k, v]) => `<dt>${k}</dt><dd>${fmt(v)}</dd>`).join('')}</dl>`;
}
