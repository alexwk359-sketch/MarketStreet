// Contenido del juego: artículos, expositores y decoración.
// Los tiempos de entrega están acortados para el prototipo.

export type DisplayKind = 'rack' | 'shelf' | 'case';

export interface DisplayDef {
  kind: DisplayKind;
  name: string;
  icon: string;
  price: number;
  capacity: number;
  unlockLevel: number;
  color: number;
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  display: DisplayKind;
  batchCost: number;
  batchSize: number;
  deliverySec: number;
  salePrice: number;
  xp: number;
  unlockLevel: number;
}

export interface DecorDef {
  id: string;
  name: string;
  icon: string;
  price: number;
  happiness: number;
  unlockLevel: number;
}

export const DISPLAYS: Record<DisplayKind, DisplayDef> = {
  rack: { kind: 'rack', name: 'Perchero', icon: '👕', price: 40, capacity: 20, unlockLevel: 1, color: 0xc0874f },
  shelf: { kind: 'shelf', name: 'Estantería', icon: '🧰', price: 40, capacity: 20, unlockLevel: 1, color: 0x7a8b99 },
  case: { kind: 'case', name: 'Vitrina', icon: '📺', price: 150, capacity: 16, unlockLevel: 2, color: 0x6fb3c9 },
};

export const ITEMS: ItemDef[] = [
  { id: 'tshirt', name: 'Camisetas', icon: '👕', display: 'rack', batchCost: 20, batchSize: 10, deliverySec: 30, salePrice: 4, xp: 1, unlockLevel: 1 },
  { id: 'hammer', name: 'Martillos', icon: '🔨', display: 'shelf', batchCost: 30, batchSize: 10, deliverySec: 45, salePrice: 5, xp: 1, unlockLevel: 1 },
  { id: 'jeans', name: 'Jeans', icon: '👖', display: 'rack', batchCost: 60, batchSize: 10, deliverySec: 120, salePrice: 10, xp: 2, unlockLevel: 2 },
  { id: 'headphones', name: 'Auriculares', icon: '🎧', display: 'case', batchCost: 80, batchSize: 8, deliverySec: 90, salePrice: 15, xp: 2, unlockLevel: 2 },
  { id: 'drill', name: 'Taladros', icon: '🪛', display: 'shelf', batchCost: 120, batchSize: 8, deliverySec: 180, salePrice: 22, xp: 3, unlockLevel: 3 },
  { id: 'radio', name: 'Radios', icon: '📻', display: 'case', batchCost: 200, batchSize: 6, deliverySec: 300, salePrice: 50, xp: 4, unlockLevel: 4 },
];

export const DECOR: DecorDef[] = [
  { id: 'plant', name: 'Planta', icon: '🪴', price: 25, happiness: 4, unlockLevel: 1 },
  { id: 'lamp', name: 'Lámpara', icon: '💡', price: 60, happiness: 8, unlockLevel: 2 },
  { id: 'rug', name: 'Alfombra', icon: '🟥', price: 100, happiness: 12, unlockLevel: 3 },
];

export const itemById = (id: string): ItemDef => {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Artículo desconocido: ${id}`);
  return item;
};

export const decorById = (id: string): DecorDef => {
  const decor = DECOR.find((d) => d.id === id);
  if (!decor) throw new Error(`Decoración desconocida: ${id}`);
  return decor;
};
