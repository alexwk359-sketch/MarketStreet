import { FURNITURE_DECOR } from '../sim/catalog';

// Rutas y claves de los sprites de public/sprites/ (Microsoft Fluent Emoji 3D, MIT).
// Se descargan con scripts/fetch_assets.py.

export const SPRITE_BASE = 'sprites/';

export const itemSprite = (id: string) => `${SPRITE_BASE}items/${id}.png`;
/** La decoración que es mueble tiene sprite 3D propio; el resto viene de Fluent Emoji. */
export const decorSprite = (id: string) =>
  FURNITURE_DECOR.has(id) ? `${SPRITE_BASE}furniture/decor-${id}.png` : `${SPRITE_BASE}decor/${id}.png`;
export const uiSprite = (name: UiSprite) => `${SPRITE_BASE}ui/${name}.png`;

export const UI_SPRITES = [
  'coin', 'gem', 'truck', 'moneybag', 'bags', 'package', 'star', 'sparkles', 'angry', 'love', 'question', 'build',
  'cart', 'crown', 'clipboard', 'fire', 'party', 'gift', 'sound', 'mute', 'trash', 'rocket', 'megaphone', 'check',
  'trophy', 'chart', 'store', 'bell', 'clock', 'gear', 'bolt', 'heart', 'brush', 'palette',
] as const;
export type UiSprite = (typeof UI_SPRITES)[number];

const FIGURES = ['person', 'woman', 'man'];
const TONES = ['default', 'light', 'medium', 'dark'];
/** Las 12 combinaciones de figura y tono de piel; cada una tiene sprite caminando y de pie. */
export const PEOPLE = FIGURES.flatMap((f) => TONES.map((t) => `${f}-${t}`));
export const personSprite = (person: string, pose: 'walking' | 'standing') => `${SPRITE_BASE}people/${person}-${pose}.png`;

export const STREET_SPRITES = ['tree', 'pine', 'car', 'taxi', 'bus', 'suv', 'moto'] as const;
export const STREET_VEHICLES = ['car', 'taxi', 'bus', 'suv', 'moto'];
export const streetSprite = (name: string) => `${SPRITE_BASE}street/${name}.png`;

/** Cajeros: 3 figuras x 4 tonos, atendiendo (idle) o cobrando (serve). */
export const STAFF = FIGURES.flatMap((f) => TONES.map((t) => `${f}-${t}`));
export const staffSprite = (name: string, pose: 'idle' | 'serve') => `${SPRITE_BASE}staff/${name}-${pose}.png`;

/** Muebles renderizados en 3D con scripts/render_furniture.mjs (256 px = 2 casillas de ancho). */
export const FURNITURE_SPRITES = [
  'register', 'rack', 'shelf', 'case', 'case-glass', 'table', 'boutique', 'sports',
  'fruit', 'veggie', 'bakery', 'bakery-glass', 'butcher', 'butcher-glass', 'cheese',
  'fridge', 'fridge-glass', 'freezer', 'freezer-glass',
] as const;
export const furnitureSprite = (name: string) => `${SPRITE_BASE}furniture/${name}.png`;
