import type { ArchetypeDef } from '../sim/archetypes';
import { FURNITURE_DECOR } from '../sim/catalog';

// Rutas y claves de los sprites de public/sprites/. Los productos, iconos y vehículos son
// Microsoft Fluent Emoji 3D (MIT, scripts/fetch_assets.py); muebles, quesos y personajes
// se modelan en 3D para el juego (scripts/render_furniture.mjs).

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
  'sun', 'cloudsun', 'rain', 'snow', 'hot', 'moon', 'sunrise', 'sunset', 'memo', 'notepad', 'siren', 'hourglass',
  'hundred', 'flash',
] as const;
export type UiSprite = (typeof UI_SPRITES)[number];

/**
 * Personajes 3D propios (scripts/furniture/characters.js), en hojas de 100×150 px por fotograma
 * (2,5 veces el tamaño de juego). Clientes: fila 0 de frente, fila 1 de espaldas; las columnas
 * están en POSE. Cajeros: una fila; 0-1 reposo, 2-4 escanear, 5-6 saludar.
 */
export const CASHIER_VARIANTS = 6;
export const CHARACTER_FRAME = { frameWidth: 100, frameHeight: 150 };
export const CHARACTER_SCALE = 1 / 2.5;
export const CUSTOMER_COLUMNS = 14;
/** Columna de cada pose (coincide con CUSTOMER_POSE_COLUMNS de characters.js). */
export const POSE = { idle: 8, reach: 9, idle2: 10, cheer: 11, angry: 12, pay: 13 } as const;
export const cashierSheet = (i: number) => `${SPRITE_BASE}people/cashier-${i}.png`;

/** Hojas de clientes por tipo (coinciden con CHARACTER_SETS de characters.js). */
export const CHARACTER_SHEETS: Record<ArchetypeDef['sheet'], number> = {
  customer: 36,
  kid: 8,
  senior: 6,
  tourist: 6,
  critic: 2,
  thief: 3,
};
export const characterSheet = (sheet: string, i: number) => `${SPRITE_BASE}people/${sheet}-${i}.png`;
/** Clave de textura (y prefijo de animaciones) de una variante. */
export const characterKey = (sheet: string, i: number) => `char:${sheet}:${i}`;

export const STREET_SPRITES = ['tree', 'pine', 'car', 'taxi', 'bus', 'suv', 'moto'] as const;
export const STREET_VEHICLES = ['car', 'taxi', 'bus', 'suv', 'moto'];
export const streetSprite = (name: string) => `${SPRITE_BASE}street/${name}.png`;

/** Muebles renderizados en 3D con scripts/render_furniture.mjs (256 px = 2 casillas de ancho). */
export const FURNITURE_SPRITES = [
  'register', 'rack', 'shelf', 'case', 'case-glass', 'table', 'boutique', 'sports',
  'fruit', 'veggie', 'bakery', 'bakery-glass', 'butcher', 'butcher-glass', 'cheese',
  'fridge', 'fridge-glass', 'freezer', 'freezer-glass',
] as const;
export const furnitureSprite = (name: string) => `${SPRITE_BASE}furniture/${name}.png`;
