// Rutas y claves de los sprites de public/sprites/ (Microsoft Fluent Emoji 3D, MIT).
// Se descargan con scripts/fetch_assets.py.

export const SPRITE_BASE = 'sprites/';

export const itemSprite = (id: string) => `${SPRITE_BASE}items/${id}.png`;
export const decorSprite = (id: string) => `${SPRITE_BASE}decor/${id}.png`;
export const uiSprite = (name: UiSprite) => `${SPRITE_BASE}ui/${name}.png`;

export const UI_SPRITES = ['coin', 'truck', 'moneybag', 'bags', 'package', 'star', 'sparkles', 'angry', 'love', 'question', 'build', 'cart'] as const;
export type UiSprite = (typeof UI_SPRITES)[number];

const FIGURES = ['person', 'woman', 'man'];
const TONES = ['default', 'light', 'medium', 'dark'];
/** Las 12 combinaciones de figura y tono de piel; cada una tiene sprite caminando y de pie. */
export const PEOPLE = FIGURES.flatMap((f) => TONES.map((t) => `${f}-${t}`));
export const personSprite = (person: string, pose: 'walking' | 'standing') => `${SPRITE_BASE}people/${person}-${pose}.png`;

/** Las decoraciones sin sprite se dibujan con formas. */
export const DRAWN_DECOR = new Set(['rug']);
