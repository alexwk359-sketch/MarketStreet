// Pequeñas utilidades para construir la interfaz en HTML.
import { uiSprite, type UiSprite } from './sprites';

export const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
export const img = (src: string, cls = 'icon') => `<img class="${cls}" src="${src}" alt="" draggable="false">`;
export const ui = (name: UiSprite, cls?: string) => img(uiSprite(name), cls);
export const fmt = (n: number) => n.toLocaleString('es-ES');
export const coins = (n: number) => `${fmt(n)} ${ui('coin')}`;
export const gems = (n: number) => `${fmt(n)} ${ui('gem')}`;
/** Escapa texto del jugador (como el nombre de la tienda) antes de meterlo en HTML. */
export const esc = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
/** 12.900 → "12,9 mil"; para ejes y cifras grandes. */
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} mil` : fmt(n));
