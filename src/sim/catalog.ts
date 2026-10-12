// Contenido del juego: artículos, muebles, decoración, estilos, mejoras y ampliaciones.
// Los tiempos de entrega están acortados respecto al original para que el juego sea ágil.

export type DisplayKind =
  | 'rack' | 'shelf' | 'case' | 'table' | 'boutique' | 'sports'
  | 'fruit' | 'veggie' | 'bakery' | 'butcher' | 'cheese' | 'fridge' | 'freezer';

/** Las dos secciones del catálogo de muebles. */
export type Department = 'store' | 'food';

export interface DisplayDef {
  kind: DisplayKind;
  name: string;
  department: Department;
  /** Categoría que vende, para la interfaz y las tendencias. */
  category: string;
  price: number;
  capacity: number;
  unlockLevel: number;
  color: number;
}

export interface ItemDef {
  id: string;
  name: string;
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
  price: number;
  happiness: number;
  unlockLevel: number;
  /** Se paga en diamantes en lugar de monedas. */
  gems?: boolean;
}

export const DISPLAYS: Record<DisplayKind, DisplayDef> = {
  rack: { kind: 'rack', name: 'Perchero', department: 'store', category: 'Ropa', price: 40, capacity: 20, unlockLevel: 1, color: 0xc0874f },
  shelf: { kind: 'shelf', name: 'Estantería', department: 'store', category: 'Ferretería', price: 40, capacity: 20, unlockLevel: 1, color: 0x7a8b99 },
  case: { kind: 'case', name: 'Vitrina', department: 'store', category: 'Electrónica', price: 150, capacity: 16, unlockLevel: 2, color: 0x6fb3c9 },
  table: { kind: 'table', name: 'Mesa', department: 'store', category: 'Juguetes y libros', price: 120, capacity: 16, unlockLevel: 3, color: 0xd4a373 },
  boutique: { kind: 'boutique', name: 'Tocador', department: 'store', category: 'Accesorios', price: 400, capacity: 12, unlockLevel: 5, color: 0xe5989b },
  sports: { kind: 'sports', name: 'Rincón deportivo', department: 'store', category: 'Deportes y ocio', price: 600, capacity: 10, unlockLevel: 7, color: 0x52b788 },
  fruit: { kind: 'fruit', name: 'Frutería', department: 'food', category: 'Frutas', price: 60, capacity: 24, unlockLevel: 1, color: 0xc8975f },
  veggie: { kind: 'veggie', name: 'Puesto de verduras', department: 'food', category: 'Verduras', price: 90, capacity: 24, unlockLevel: 2, color: 0x2a9d8f },
  bakery: { kind: 'bakery', name: 'Panadería', department: 'food', category: 'Pan y dulces', price: 200, capacity: 18, unlockLevel: 3, color: 0xd4a373 },
  fridge: { kind: 'fridge', name: 'Nevera', department: 'food', category: 'Lácteos y bebidas', price: 300, capacity: 18, unlockLevel: 4, color: 0xf8f9fa },
  cheese: { kind: 'cheese', name: 'Quesería', department: 'food', category: 'Quesos', price: 350, capacity: 12, unlockLevel: 5, color: 0x6f4518 },
  butcher: { kind: 'butcher', name: 'Carnicería', department: 'food', category: 'Carnes', price: 450, capacity: 14, unlockLevel: 6, color: 0xdee2e6 },
  freezer: { kind: 'freezer', name: 'Congelador', department: 'food', category: 'Congelados y helados', price: 500, capacity: 16, unlockLevel: 7, color: 0xcaf0f8 },
};

/**
 * Genera un artículo con precios coherentes según su nivel: cuanto más avanzado,
 * más caro, más lento de recibir y más rentable. `v` ajusta el precio (variedad).
 */
function item(id: string, name: string, display: DisplayKind, unlockLevel: number, v = 1): ItemDef {
  const salePrice = Math.round(4 * Math.pow(1.42, unlockLevel - 1) * v);
  const batchSize = unlockLevel <= 2 ? 10 : unlockLevel <= 5 ? 8 : unlockLevel <= 8 ? 6 : 4;
  return {
    id,
    name,
    display,
    unlockLevel,
    salePrice,
    batchSize,
    batchCost: Math.round(batchSize * salePrice * 0.5),
    deliverySec: Math.round((20 + unlockLevel * 30) * v),
    xp: Math.max(1, Math.round(salePrice / 4)),
  };
}

// Cada artículo tiene su sprite en public/sprites/items/<id>.png.
export const ITEMS: ItemDef[] = [
  // Ropa (perchero)
  item('tshirt', 'Camisetas', 'rack', 1),
  item('cap', 'Gorras', 'rack', 1, 1.4),
  item('socks', 'Calcetines', 'rack', 2, 0.8),
  item('jeans', 'Jeans', 'rack', 2, 1.3),
  item('scarf', 'Bufandas', 'rack', 3),
  item('sneakers', 'Zapatillas', 'rack', 4, 1.2),
  item('dress', 'Vestidos', 'rack', 5, 1.1),
  item('gloves', 'Guantes', 'rack', 6, 0.9),
  item('coat', 'Abrigos', 'rack', 8, 1.2),
  // Ferretería (estantería)
  item('hammer', 'Martillos', 'shelf', 1, 1.2),
  item('wrench', 'Llaves inglesas', 'shelf', 2),
  item('bolt', 'Tornillería', 'shelf', 2, 0.7),
  item('screwdriver', 'Destornilladores', 'shelf', 3),
  item('flashlight', 'Linternas', 'shelf', 3, 1.2),
  item('battery', 'Pilas', 'shelf', 4, 0.8),
  item('magnet', 'Imanes', 'shelf', 5, 0.9),
  item('toolbox', 'Cajas de herramientas', 'shelf', 6, 1.2),
  item('axe', 'Hachas', 'shelf', 7),
  item('ladder', 'Escaleras', 'shelf', 9, 1.1),
  // Electrónica (vitrina)
  item('headphones', 'Auriculares', 'case', 2, 1.3),
  item('phone', 'Móviles', 'case', 3, 1.3),
  item('radio', 'Radios', 'case', 4),
  item('camera', 'Cámaras', 'case', 5, 1.1),
  item('videogame', 'Videojuegos', 'case', 6),
  item('printer', 'Impresoras', 'case', 7, 0.9),
  item('tv', 'Televisores', 'case', 8, 1.2),
  item('laptop', 'Portátiles', 'case', 9, 1.1),
  item('videocam', 'Videocámaras', 'case', 10),
  item('desktop', 'Ordenadores', 'case', 11, 1.1),
  // Juguetes y libros (mesa)
  item('ball', 'Balones', 'table', 3, 0.9),
  item('teddy', 'Peluches', 'table', 3, 1.1),
  item('yoyo', 'Yoyós', 'table', 4, 0.7),
  item('books', 'Libros', 'table', 4, 1.1),
  item('crayon', 'Ceras de colores', 'table', 5, 0.8),
  item('puzzle', 'Puzles', 'table', 5, 1.1),
  item('dice', 'Juegos de mesa', 'table', 6),
  item('kite', 'Cometas', 'table', 7),
  item('wand', 'Varitas mágicas', 'table', 9),
  // Accesorios (tocador)
  item('lipstick', 'Pintalabios', 'boutique', 5),
  item('sunglasses', 'Gafas de sol', 'boutique', 5, 1.3),
  item('necktie', 'Corbatas', 'boutique', 6),
  item('watch', 'Relojes', 'boutique', 8, 1.3),
  item('handbag', 'Bolsos', 'boutique', 9, 1.2),
  item('heels', 'Tacones', 'boutique', 10),
  // Deportes y ocio (rincón deportivo)
  item('basketball', 'Balones de baloncesto', 'sports', 7),
  item('fishing', 'Cañas de pescar', 'sports', 8),
  item('scooter', 'Patinetes', 'sports', 9, 1.2),
  item('guitar', 'Guitarras', 'sports', 10, 1.2),
  item('bicycle', 'Bicicletas', 'sports', 12, 1.3),
  // Frutas (frutería): baratas y rápidas de reponer
  item('apple', 'Manzanas', 'fruit', 1, 0.8),
  item('banana', 'Plátanos', 'fruit', 1, 0.7),
  item('orange', 'Mandarinas', 'fruit', 2, 0.8),
  item('grapes', 'Uvas', 'fruit', 2, 0.9),
  item('lemon', 'Limones', 'fruit', 3, 0.7),
  item('strawberry', 'Fresas', 'fruit', 3, 1),
  item('pear', 'Peras', 'fruit', 3, 0.8),
  item('peach', 'Melocotones', 'fruit', 4, 0.9),
  item('cherries', 'Cerezas', 'fruit', 4, 1.1),
  item('pineapple', 'Piñas', 'fruit', 5),
  item('watermelon', 'Sandías', 'fruit', 5, 1.1),
  item('mango', 'Mangos', 'fruit', 6, 0.9),
  item('kiwi', 'Kiwis', 'fruit', 6, 0.8),
  item('blueberries', 'Arándanos', 'fruit', 7),
  item('coconut', 'Cocos', 'fruit', 8, 0.9),
  // Verduras (puesto de verduras)
  item('carrot', 'Zanahorias', 'veggie', 2, 0.7),
  item('tomato', 'Tomates', 'veggie', 2, 0.8),
  item('potato', 'Patatas', 'veggie', 2, 0.6),
  item('lettuce', 'Lechugas', 'veggie', 3, 0.7),
  item('corn', 'Mazorcas', 'veggie', 3, 0.8),
  item('broccoli', 'Brócolis', 'veggie', 3, 0.9),
  item('cucumber', 'Pepinos', 'veggie', 4, 0.7),
  item('pepper', 'Pimientos', 'veggie', 4, 0.8),
  item('onion', 'Cebollas', 'veggie', 4, 0.6),
  item('garlic', 'Ajos', 'veggie', 5, 0.6),
  item('eggplant', 'Berenjenas', 'veggie', 5, 0.8),
  item('chili', 'Guindillas', 'veggie', 6, 0.7),
  item('mushroom', 'Setas', 'veggie', 6, 1),
  item('avocado', 'Aguacates', 'veggie', 7, 1),
  // Pan y dulces (panadería)
  item('bread', 'Pan de molde', 'bakery', 3, 0.8),
  item('baguette', 'Barras de pan', 'bakery', 3, 0.7),
  item('bagel', 'Bagels', 'bakery', 4, 0.8),
  item('croissant', 'Cruasanes', 'bakery', 4, 0.9),
  item('donut', 'Rosquillas', 'bakery', 5, 0.8),
  item('pretzel', 'Pretzels', 'bakery', 5, 0.8),
  item('cookie', 'Galletas', 'bakery', 6, 0.7),
  item('cupcake', 'Magdalenas', 'bakery', 6, 0.9),
  item('pie', 'Tartas de manzana', 'bakery', 8),
  item('shortcake', 'Pasteles', 'bakery', 9),
  item('cake', 'Tartas de cumpleaños', 'bakery', 11),
  // Lácteos y bebidas (nevera)
  item('milk', 'Leche', 'fridge', 4, 0.7),
  item('eggs', 'Huevos', 'fridge', 4, 0.7),
  item('juice', 'Zumos', 'fridge', 4, 0.8),
  item('butter', 'Mantequilla', 'fridge', 5, 0.8),
  item('soda', 'Refrescos', 'fridge', 5, 0.7),
  item('honey', 'Miel', 'fridge', 6, 0.9),
  item('bubbletea', 'Té de burbujas', 'fridge', 7, 0.9),
  item('cava', 'Cava', 'fridge', 9),
  // Quesos (quesería) — sprites modelados en 3D para este juego
  item('mozzarella', 'Mozzarella', 'cheese', 5, 0.9),
  item('manchego', 'Queso manchego', 'cheese', 5, 1.1),
  item('emmental', 'Emmental', 'cheese', 6),
  item('gouda', 'Gouda', 'cheese', 7),
  item('brie', 'Brie', 'cheese', 8),
  item('bluecheese', 'Queso azul', 'cheese', 9),
  // Carnes (carnicería)
  item('chicken', 'Muslos de pollo', 'butcher', 6, 0.8),
  item('burger', 'Hamburguesas', 'butcher', 6, 0.9),
  item('sausage', 'Salchichas', 'butcher', 7, 0.8),
  item('bacon', 'Beicon', 'butcher', 7, 0.9),
  item('steak', 'Filetes', 'butcher', 8, 1.1),
  item('ribs', 'Costillas', 'butcher', 9, 1.1),
  // Congelados y helados (congelador)
  item('ice', 'Bolsas de hielo', 'freezer', 7, 0.6),
  item('icecream', 'Helados', 'freezer', 7, 0.9),
  item('softserve', 'Cucuruchos', 'freezer', 8, 0.8),
  item('pizza', 'Pizzas congeladas', 'freezer', 8),
  item('dumplings', 'Empanadillas', 'freezer', 9, 0.9),
  item('fish', 'Pescado congelado', 'freezer', 9),
  item('shrimp', 'Gambas', 'freezer', 10, 1.1),
  item('shavedice', 'Granizados', 'freezer', 10, 0.8),
];

// Cada decoración tiene su sprite en public/sprites/decor/<id>.png, salvo la alfombra, que se dibuja.
// La decoración que es mueble (banco, sofá, fuente...) está modelada en 3D: ver FURNITURE_DECOR.
export const DECOR: DecorDef[] = [
  { id: 'plant', name: 'Planta', price: 25, happiness: 4, unlockLevel: 1 },
  { id: 'cactus', name: 'Cactus', price: 35, happiness: 5, unlockLevel: 1 },
  { id: 'bench', name: 'Banco', price: 60, happiness: 5, unlockLevel: 2 },
  { id: 'balloons', name: 'Globos', price: 70, happiness: 6, unlockLevel: 2 },
  { id: 'sunflower', name: 'Girasol', price: 50, happiness: 6, unlockLevel: 2 },
  { id: 'tulip', name: 'Tulipanes', price: 60, happiness: 6, unlockLevel: 2 },
  { id: 'picture', name: 'Cuadro', price: 80, happiness: 8, unlockLevel: 3 },
  { id: 'rug', name: 'Alfombra', price: 100, happiness: 8, unlockLevel: 3 },
  { id: 'lamp', name: 'Lámpara de pie', price: 110, happiness: 8, unlockLevel: 3 },
  { id: 'pumpkin', name: 'Calabaza de Halloween', price: 90, happiness: 7, unlockLevel: 3 },
  { id: 'bouquet', name: 'Ramo de flores', price: 120, happiness: 9, unlockLevel: 4 },
  { id: 'dog', name: 'Perro de la tienda', price: 3, happiness: 12, unlockLevel: 4, gems: true },
  { id: 'snowman', name: 'Muñeco de nieve', price: 140, happiness: 9, unlockLevel: 4 },
  { id: 'sofa', name: 'Sofá', price: 180, happiness: 12, unlockLevel: 5 },
  { id: 'mannequin', name: 'Maniquí', price: 220, happiness: 12, unlockLevel: 5 },
  { id: 'ficus', name: 'Ficus', price: 200, happiness: 13, unlockLevel: 6 },
  { id: 'palm', name: 'Palmera', price: 250, happiness: 14, unlockLevel: 6 },
  { id: 'tree', name: 'Árbol de Navidad', price: 300, happiness: 15, unlockLevel: 7 },
  { id: 'fountain', name: 'Fuente', price: 600, happiness: 20, unlockLevel: 8 },
  { id: 'moai', name: 'Moái', price: 8, happiness: 22, unlockLevel: 9, gems: true },
  { id: 'statue', name: 'Estatua', price: 1500, happiness: 25, unlockLevel: 11 },
];

export interface StyleDef {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  /** Dos colores: damero del suelo, o pared izquierda / derecha. */
  colors: [number, number];
}

export const FLOORS: StyleDef[] = [
  { id: 'wood', name: 'Madera clara', price: 0, unlockLevel: 1, colors: [0xf6e7cb, 0xecd9b6] },
  { id: 'tiles', name: 'Baldosas', price: 150, unlockLevel: 2, colors: [0xf1f3f5, 0xdee2e6] },
  { id: 'checker', name: 'Ajedrez', price: 300, unlockLevel: 3, colors: [0xf8f9fa, 0x495057] },
  { id: 'terracotta', name: 'Terracota', price: 400, unlockLevel: 4, colors: [0xe9a178, 0xd98c63] },
  { id: 'marble', name: 'Mármol', price: 900, unlockLevel: 6, colors: [0xf3f0ff, 0xe5dbff] },
  { id: 'darkwood', name: 'Madera oscura', price: 1200, unlockLevel: 8, colors: [0x9c6644, 0x8a5a3b] },
];

export const WALLS: StyleDef[] = [
  { id: 'cream', name: 'Crema', price: 0, unlockLevel: 1, colors: [0xe8cfa6, 0xf4e1c1] },
  { id: 'mint', name: 'Menta', price: 120, unlockLevel: 2, colors: [0xb7e4c7, 0xd8f3dc] },
  { id: 'rose', name: 'Rosa', price: 120, unlockLevel: 2, colors: [0xf4acb7, 0xffcad4] },
  { id: 'sky', name: 'Cielo', price: 250, unlockLevel: 4, colors: [0xa2d2ff, 0xcde7ff] },
  { id: 'lavender', name: 'Lavanda', price: 400, unlockLevel: 6, colors: [0xcdb4db, 0xe2d4ee] },
  { id: 'brick', name: 'Ladrillo', price: 700, unlockLevel: 8, colors: [0xbc6c4a, 0xd08159] },
];

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** Descripción de cada nivel (índice = nivel que se compra - 1). */
  effects: string[];
  costs: number[];
  levels: number[];
}

export type UpgradeId = 'cashier' | 'stocker' | 'ads' | 'express' | 'storage' | 'music';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'cashier',
    name: 'Cajeros rápidos',
    effects: ['Cobran un 25% más rápido', 'Cobran un 45% más rápido', 'Cobran el doble de rápido'],
    costs: [150, 600, 2000],
    levels: [2, 5, 8],
  },
  {
    id: 'stocker',
    name: 'Reponedor',
    effects: ['Repite el pedido en cuanto cabe otro lote'],
    costs: [500],
    levels: [4],
  },
  {
    id: 'ads',
    name: 'Publicidad',
    effects: ['+20% de clientes', '+40% de clientes', '+60% de clientes'],
    costs: [200, 800, 2500],
    levels: [3, 6, 9],
  },
  {
    id: 'express',
    name: 'Camión exprés',
    effects: ['Pedidos un 20% más rápidos', 'Pedidos un 40% más rápidos'],
    costs: [300, 1500],
    levels: [3, 7],
  },
  {
    id: 'storage',
    name: 'Almacén',
    effects: ['+25% de capacidad en expositores', '+50% de capacidad en expositores'],
    costs: [400, 1800],
    levels: [4, 8],
  },
  {
    id: 'music',
    name: 'Hilo musical',
    effects: ['+5% de felicidad', '+10% de felicidad'],
    costs: [250, 1000],
    levels: [2, 6],
  },
];

export interface ExpansionDef {
  w: number;
  h: number;
  price: number;
  unlockLevel: number;
}

export const EXPANSIONS: ExpansionDef[] = [
  { w: 10, h: 8, price: 0, unlockLevel: 1 },
  { w: 12, h: 9, price: 600, unlockLevel: 3 },
  { w: 14, h: 10, price: 2000, unlockLevel: 6 },
  { w: 16, h: 12, price: 6000, unlockLevel: 9 },
];

/** Cajas registradoras disponibles: precio de cada una y nivel en que se desbloquea. */
export const REGISTERS = [
  { price: 0, unlockLevel: 1 },
  { price: 250, unlockLevel: 4 },
  { price: 900, unlockLevel: 8 },
];

/** Decoración con sprite 3D propio (public/sprites/furniture/decor-<id>.png), encuadrado como los muebles. */
export const FURNITURE_DECOR = new Set(['bench', 'rug', 'lamp', 'sofa', 'mannequin', 'ficus', 'tree', 'fountain']);

export const itemById = (id: string): ItemDef => {
  const found = ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Artículo desconocido: ${id}`);
  return found;
};

export const decorById = (id: string): DecorDef => {
  const found = DECOR.find((d) => d.id === id);
  if (!found) throw new Error(`Decoración desconocida: ${id}`);
  return found;
};

export const upgradeById = (id: UpgradeId): UpgradeDef => UPGRADES.find((u) => u.id === id)!;
