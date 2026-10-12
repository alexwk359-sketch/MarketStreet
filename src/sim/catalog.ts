// Contenido del juego: artículos, expositores y decoración.
// Los tiempos de entrega están acortados para el prototipo.

export type DisplayKind = 'rack' | 'shelf' | 'case' | 'table';

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
  table: { kind: 'table', name: 'Mesa', icon: '🧸', price: 120, capacity: 16, unlockLevel: 3, color: 0xd4a373 },
};

// Cada artículo tiene su sprite en public/sprites/items/<id>.png.
export const ITEMS: ItemDef[] = [
  // Ropa (perchero)
  { id: 'tshirt', name: 'Camisetas', icon: '👕', display: 'rack', batchCost: 20, batchSize: 10, deliverySec: 30, salePrice: 4, xp: 1, unlockLevel: 1 },
  { id: 'cap', name: 'Gorras', icon: '🧢', display: 'rack', batchCost: 30, batchSize: 10, deliverySec: 60, salePrice: 6, xp: 1, unlockLevel: 1 },
  { id: 'jeans', name: 'Jeans', icon: '👖', display: 'rack', batchCost: 60, batchSize: 10, deliverySec: 120, salePrice: 10, xp: 2, unlockLevel: 2 },
  { id: 'sneakers', name: 'Zapatillas', icon: '👟', display: 'rack', batchCost: 110, batchSize: 8, deliverySec: 240, salePrice: 24, xp: 3, unlockLevel: 4 },
  { id: 'dress', name: 'Vestidos', icon: '👗', display: 'rack', batchCost: 140, batchSize: 8, deliverySec: 300, salePrice: 30, xp: 3, unlockLevel: 5 },
  { id: 'coat', name: 'Abrigos', icon: '🧥', display: 'rack', batchCost: 220, batchSize: 6, deliverySec: 480, salePrice: 60, xp: 5, unlockLevel: 7 },
  // Ferretería (estantería)
  { id: 'hammer', name: 'Martillos', icon: '🔨', display: 'shelf', batchCost: 30, batchSize: 10, deliverySec: 45, salePrice: 5, xp: 1, unlockLevel: 1 },
  { id: 'wrench', name: 'Llaves inglesas', icon: '🔧', display: 'shelf', batchCost: 50, batchSize: 10, deliverySec: 90, salePrice: 8, xp: 2, unlockLevel: 2 },
  { id: 'screwdriver', name: 'Destornilladores', icon: '🪛', display: 'shelf', batchCost: 70, batchSize: 10, deliverySec: 150, salePrice: 12, xp: 2, unlockLevel: 3 },
  { id: 'toolbox', name: 'Cajas de herramientas', icon: '🧰', display: 'shelf', batchCost: 160, batchSize: 8, deliverySec: 360, salePrice: 36, xp: 4, unlockLevel: 6 },
  // Electrónica (vitrina)
  { id: 'headphones', name: 'Auriculares', icon: '🎧', display: 'case', batchCost: 80, batchSize: 8, deliverySec: 90, salePrice: 15, xp: 2, unlockLevel: 2 },
  { id: 'phone', name: 'Móviles', icon: '📱', display: 'case', batchCost: 150, batchSize: 8, deliverySec: 200, salePrice: 28, xp: 3, unlockLevel: 3 },
  { id: 'radio', name: 'Radios', icon: '📻', display: 'case', batchCost: 200, batchSize: 6, deliverySec: 300, salePrice: 50, xp: 4, unlockLevel: 4 },
  { id: 'camera', name: 'Cámaras', icon: '📷', display: 'case', batchCost: 260, batchSize: 6, deliverySec: 420, salePrice: 65, xp: 5, unlockLevel: 5 },
  { id: 'videogame', name: 'Videojuegos', icon: '🎮', display: 'case', batchCost: 300, batchSize: 6, deliverySec: 480, salePrice: 75, xp: 5, unlockLevel: 6 },
  { id: 'laptop', name: 'Portátiles', icon: '💻', display: 'case', batchCost: 500, batchSize: 4, deliverySec: 600, salePrice: 180, xp: 8, unlockLevel: 8 },
  // Juguetes y libros (mesa)
  { id: 'ball', name: 'Balones', icon: '⚽', display: 'table', batchCost: 60, batchSize: 8, deliverySec: 90, salePrice: 12, xp: 2, unlockLevel: 3 },
  { id: 'teddy', name: 'Peluches', icon: '🧸', display: 'table', batchCost: 90, batchSize: 8, deliverySec: 150, salePrice: 18, xp: 2, unlockLevel: 3 },
  { id: 'books', name: 'Libros', icon: '📚', display: 'table', batchCost: 120, batchSize: 8, deliverySec: 240, salePrice: 25, xp: 3, unlockLevel: 4 },
  { id: 'kite', name: 'Cometas', icon: '🪁', display: 'table', batchCost: 180, batchSize: 6, deliverySec: 360, salePrice: 48, xp: 4, unlockLevel: 6 },
];

// Cada decoración tiene su sprite en public/sprites/decor/<id>.png, salvo la alfombra, que se dibuja.
export const DECOR: DecorDef[] = [
  { id: 'plant', name: 'Planta', icon: '🪴', price: 25, happiness: 4, unlockLevel: 1 },
  { id: 'cactus', name: 'Cactus', icon: '🌵', price: 35, happiness: 5, unlockLevel: 1 },
  { id: 'sunflower', name: 'Girasol', icon: '🌻', price: 50, happiness: 6, unlockLevel: 2 },
  { id: 'picture', name: 'Cuadro', icon: '🖼️', price: 80, happiness: 8, unlockLevel: 3 },
  { id: 'rug', name: 'Alfombra', icon: '🟥', price: 100, happiness: 10, unlockLevel: 3 },
  { id: 'sofa', name: 'Sofá con lámpara', icon: '🛋️', price: 180, happiness: 15, unlockLevel: 5 },
  { id: 'tree', name: 'Árbol decorado', icon: '🎄', price: 250, happiness: 18, unlockLevel: 6 },
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
