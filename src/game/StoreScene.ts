import Phaser from 'phaser';
import { DECOR, DISPLAYS, ITEMS, type DisplayKind } from '../sim/catalog';
import { available, isTileFree } from '../sim/sim';
import {
  ENTRANCE,
  GRID_H,
  GRID_W,
  REGISTER,
  type Customer,
  type Display,
  type PlacedDecor,
  type SimEvent,
} from '../sim/state';
import type { Controller } from './controller';
import { formatTime } from './format';
import { TILE_H, isoToScreen, screenToIso, shade, type Point } from './iso';
import { DRAWN_DECOR, PEOPLE, UI_SPRITES, decorSprite, itemSprite, personSprite, uiSprite } from './sprites';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const WALL_HEIGHT = 70;
// El texto se rasteriza a más resolución para que siga nítido con zoom.
const TEXT_RESOLUTION = Math.min(4, (window.devicePixelRatio || 1) * 2);
const PERSON_SIZE = 46;
const FX_DEPTH = 1000;

/** Forma de cada expositor y cómo se colocan los productos encima. */
interface DisplayShape {
  height: number;
  /** Posiciones de los productos en coordenadas locales de la casilla (0-1), de atrás hacia delante. */
  slots: Point[];
  productSize: number;
}

const grid = (cols: number, rows: number, from = 0.28, to = 0.72): Point[] => {
  const pts: Point[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pts.push({
        x: cols === 1 ? 0.5 : from + ((to - from) * c) / (cols - 1),
        y: rows === 1 ? 0.5 : from + ((to - from) * r) / (rows - 1),
      });
    }
  }
  return pts.sort((a, b) => a.x + a.y - (b.x + b.y));
};

const SHAPES: Record<DisplayKind, DisplayShape> = {
  // En el perchero la ropa cuelga de la barra (ver drawRack).
  rack: { height: 42, slots: grid(5, 1, 0.2, 0.8).map((p) => ({ x: p.x, y: 0.5 })), productSize: 24 },
  shelf: { height: 30, slots: grid(3, 2), productSize: 19 },
  case: { height: 16, slots: grid(2, 2, 0.32, 0.68), productSize: 20 },
  table: { height: 14, slots: grid(3, 2, 0.25, 0.75), productSize: 22 },
};

const DECOR_SIZE: Record<string, number> = { plant: 36, cactus: 32, sunflower: 38, picture: 30, sofa: 58, tree: 60 };

interface DisplayView {
  container: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Graphics;
  products: Phaser.GameObjects.Image[];
  glass: Phaser.GameObjects.Graphics;
  truck: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  labelKey: string;
  shown: number;
}

interface CustomerView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Graphics;
  body: Phaser.GameObjects.Image;
  bag: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Graphics;
  bubbleIcon: Phaser.GameObjects.Image;
  person: string;
  /** Avance del ciclo de paso; crece con la distancia recorrida. */
  stride: number;
  flip: boolean;
  last: Point;
}

interface DecorView {
  container: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image | null;
}

export class StoreScene extends Phaser.Scene {
  private controller!: Controller;
  private origin: Point = { x: 0, y: 0 };
  private floor!: Phaser.GameObjects.Graphics;
  private hover: Point | null = null;
  private displays = new Map<number, DisplayView>();
  private customers = new Map<number, CustomerView>();
  private decor = new Map<number, DecorView>();
  private register!: { container: Phaser.GameObjects.Container; bag: Phaser.GameObjects.Image; bagScale: number };

  constructor() {
    super('store');
  }

  init(data: { controller: Controller }) {
    this.controller = data.controller;
  }

  preload() {
    for (const item of ITEMS) this.load.image(`item:${item.id}`, itemSprite(item.id));
    for (const d of DECOR) if (!DRAWN_DECOR.has(d.id)) this.load.image(`decor:${d.id}`, decorSprite(d.id));
    for (const name of UI_SPRITES) this.load.image(`ui:${name}`, uiSprite(name));
    for (const p of PEOPLE) {
      this.load.image(`person:${p}-walking`, personSprite(p, 'walking'));
      this.load.image(`person:${p}-standing`, personSprite(p, 'standing'));
    }
  }

  create() {
    this.floor = this.add.graphics().setDepth(-1);
    this.createRegister();
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hover = this.tileAt(p.worldX, p.worldY);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  update(time: number, delta: number) {
    this.controller.update(delta, Date.now());
    const events = this.controller.consumeEvents();
    this.drawFloor();
    this.syncDecor();
    this.syncDisplays();
    this.syncCustomers(time);
    for (const e of events) this.playEvent(e);
  }

  // -------------------------------------------------------------------------
  // Entrada
  // -------------------------------------------------------------------------

  /** Ajusta el zoom para que la tienda llene la pantalla, dejando hueco para el HUD y la barra. */
  private layout() {
    const { width, height } = this.scale;
    const left = isoToScreen(0, GRID_H, this.origin).x;
    const right = isoToScreen(GRID_W, 0, this.origin).x;
    const top = this.origin.y - WALL_HEIGHT - 40;
    const bottom = isoToScreen(GRID_W, GRID_H, this.origin).y + 20;
    const reservedUi = 150;
    const zoom = Math.min(width / (right - left + 40), (height - reservedUi) / (bottom - top), 1.8);
    const cam = this.cameras.main;
    cam.setZoom(Math.max(0.5, zoom));
    // El HUD ocupa más que la barra inferior: desplazamos un poco la vista hacia abajo.
    cam.centerOn((left + right) / 2, (top + bottom) / 2 - 10 / cam.zoom);
  }

  private tileAt(sx: number, sy: number): Point | null {
    const p = screenToIso(sx, sy, this.origin);
    const tile = { x: Math.floor(p.x), y: Math.floor(p.y) };
    return tile.x >= 0 && tile.y >= 0 && tile.x < GRID_W && tile.y < GRID_H ? tile : null;
  }

  /** Los expositores sobresalen del suelo: se pueden tocar por su volumen, no solo por su casilla. */
  private displayAt(sx: number, sy: number): Display | null {
    const hits = this.controller.state.displays.filter((d) => {
      const c = this.tileCenter(d.x, d.y);
      const h = SHAPES[d.kind].height + 16;
      return Math.abs(sx - c.x) < 28 && sy > c.y - h - TILE_H / 2 && sy < c.y + TILE_H / 2;
    });
    return hits.sort((a, b) => b.x + b.y - (a.x + a.y))[0] ?? null;
  }

  private onTap(p: Phaser.Input.Pointer) {
    const c = this.controller;
    if (c.mode.type !== 'idle') {
      const tile = this.tileAt(p.worldX, p.worldY);
      if (tile) c.tapTile(tile.x, tile.y);
      return;
    }
    const display = this.displayAt(p.worldX, p.worldY);
    c.selectDisplay(display ? display.id : null);
  }

  // -------------------------------------------------------------------------
  // Utilidades de dibujo
  // -------------------------------------------------------------------------

  private at(x: number, y: number): Point {
    return isoToScreen(x, y, this.origin);
  }

  private tileCenter(x: number, y: number): Point {
    return this.at(x + 0.5, y + 0.5);
  }

  /** Caja isométrica sobre la casilla (x, y); devuelve las esquinas de la cara superior. */
  private box(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    height: number,
    color: number,
    inset = 0.12,
    lift = 0,
    alpha = 1,
  ): Point[] {
    const raise = (p: Point, h: number) => ({ x: p.x, y: p.y - h });
    const top = raise(this.at(x + inset, y + inset), lift);
    const right = raise(this.at(x + 1 - inset, y + inset), lift);
    const bottom = raise(this.at(x + 1 - inset, y + 1 - inset), lift);
    const left = raise(this.at(x + inset, y + 1 - inset), lift);
    g.fillStyle(shade(color, 0.8), alpha).fillPoints([left, bottom, raise(bottom, height), raise(left, height)], true);
    g.fillStyle(shade(color, 0.62), alpha).fillPoints([bottom, right, raise(right, height), raise(bottom, height)], true);
    const face = [top, right, bottom, left].map((p) => raise(p, height));
    g.fillStyle(color, alpha).fillPoints(face, true);
    return face;
  }

  private text(x: number, y: number, size: number, color = '#fff') {
    return this.add
      .text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, resolution: TEXT_RESOLUTION })
      .setOrigin(0.5, 1);
  }

  // -------------------------------------------------------------------------
  // Tienda
  // -------------------------------------------------------------------------

  private drawFloor() {
    const g = this.floor;
    g.clear();
    const up = (p: Point, h: number) => ({ x: p.x, y: p.y - h });
    const corner = this.at(0, 0);
    const right = this.at(GRID_W, 0);
    const left = this.at(0, GRID_H);

    // Paredes del fondo con zócalo y ventanas.
    g.fillStyle(0xf4e1c1).fillPoints([corner, right, up(right, WALL_HEIGHT), up(corner, WALL_HEIGHT)], true);
    g.fillStyle(0xe8cfa6).fillPoints([corner, left, up(left, WALL_HEIGHT), up(corner, WALL_HEIGHT)], true);
    g.fillStyle(0xb5835a).fillPoints([corner, right, up(right, 8), up(corner, 8)], true);
    g.fillStyle(0xa47148).fillPoints([corner, left, up(left, 8), up(corner, 8)], true);
    for (const wx of [2, 6]) {
      const a = this.at(wx, 0);
      const b = this.at(wx + 1.6, 0);
      g.fillStyle(0xbde0fe).fillPoints([up(a, 22), up(b, 22), up(b, 56), up(a, 56)], true);
      g.lineStyle(3, 0xffffff).strokePoints([up(a, 22), up(b, 22), up(b, 56), up(a, 56)], true);
    }
    for (const wy of [2, 5]) {
      const a = this.at(0, wy);
      const b = this.at(0, wy + 1.6);
      g.fillStyle(0xa2d2ff).fillPoints([up(a, 22), up(b, 22), up(b, 56), up(a, 56)], true);
      g.lineStyle(3, 0xffffff).strokePoints([up(a, 22), up(b, 22), up(b, 56), up(a, 56)], true);
    }
    g.fillStyle(0x9c6644).fillRect(corner.x - 1, corner.y - WALL_HEIGHT, 2, WALL_HEIGHT);

    // Suelo de madera, con la puerta y la casilla bajo el cursor resaltadas.
    const c = this.controller;
    const placing = c.mode.type !== 'idle';
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        let color = (x + y) % 2 === 0 ? 0xf6e7cb : 0xecd9b6;
        if (x === GRID_W - 1 && y === GRID_H - 1) color = 0x95c48f;
        if (placing && this.hover?.x === x && this.hover.y === y) {
          color = isTileFree(c.state, x, y) ? 0x90ee90 : 0xf08080;
        }
        g.fillStyle(color).fillPoints([this.at(x, y), this.at(x + 1, y), this.at(x + 1, y + 1), this.at(x, y + 1)], true);
      }
    }
    g.lineStyle(2, 0x9c6644).strokePoints([corner, right, this.at(GRID_W, GRID_H), left], true);
  }

  private createRegister() {
    const g = this.add.graphics();
    const bag = this.add.image(0, 0, 'ui:moneybag').setDisplaySize(30, 30).setOrigin(0.5, 0.9);
    const container = this.add.container(0, 0, [g, bag]).setDepth(REGISTER.x + REGISTER.y);
    this.register = { container, bag, bagScale: bag.scale };
    // El origen de la cuadrícula es fijo (el zoom lo hace la cámara): basta con dibujarla una vez.
    this.box(g, REGISTER.x, REGISTER.y, 26, 0x5c4033, 0.15);
    this.box(g, REGISTER.x, REGISTER.y, 6, 0x343a40, 0.3, 26);
    const c = this.tileCenter(REGISTER.x, REGISTER.y);
    bag.setPosition(c.x + 6, c.y - 30);
  }

  private syncDecor() {
    const live = new Set<number>();
    for (const d of this.controller.state.decor) {
      live.add(d.id);
      if (!this.decor.has(d.id)) this.decor.set(d.id, this.createDecor(d));
    }
    for (const [id, v] of this.decor) {
      if (live.has(id)) continue;
      v.container.destroy();
      this.decor.delete(id);
    }
  }

  private createDecor(d: PlacedDecor): DecorView {
    const g = this.add.graphics();
    const c = this.tileCenter(d.x, d.y);
    let image: Phaser.GameObjects.Image | null = null;
    if (d.decorId === 'rug') {
      this.box(g, d.x, d.y, 2, 0xc1121f, 0.05);
      this.box(g, d.x, d.y, 0.5, 0xffd166, 0.2, 2);
    } else {
      const size = DECOR_SIZE[d.decorId] ?? 34;
      g.fillStyle(0x000000, 0.15).fillEllipse(c.x, c.y, size * 0.8, size * 0.3);
      image = this.add.image(c.x, c.y + 4, `decor:${d.decorId}`).setDisplaySize(size, size).setOrigin(0.5, 1);
    }
    const children = image ? [g, image] : [g];
    // La alfombra es plana: siempre por debajo de muebles y clientes.
    const container = this.add.container(0, 0, children).setDepth(d.decorId === 'rug' ? -0.5 : d.x + d.y);
    if (image) this.tweens.add({ targets: image, scale: { from: 0, to: image.scale }, duration: 350, ease: 'Back.easeOut' });
    return { container, g, image };
  }

  // -------------------------------------------------------------------------
  // Expositores
  // -------------------------------------------------------------------------

  private syncDisplays() {
    const live = new Set<number>();
    for (const d of this.controller.state.displays) {
      live.add(d.id);
      const view = this.displays.get(d.id) ?? this.createDisplay(d);
      this.updateDisplay(view, d);
    }
    for (const [id, v] of this.displays) {
      if (live.has(id)) continue;
      v.container.destroy();
      this.displays.delete(id);
    }
  }

  private createDisplay(d: Display): DisplayView {
    const shape = SHAPES[d.kind];
    const base = this.add.graphics();
    const glass = this.add.graphics();
    const products = shape.slots.map(() => this.add.image(0, 0, 'ui:package').setVisible(false));
    const truck = this.add.image(0, 0, 'ui:truck').setDisplaySize(18, 18).setVisible(false);
    const label = this.text(0, 0, 11).setPadding(5, 2, 5, 2);
    const container = this.add.container(0, 0, [base, ...products, glass, truck, label]).setDepth(d.x + d.y);
    const view: DisplayView = { container, base, products, glass, truck, label, labelKey: '', shown: 0 };
    this.displays.set(d.id, view);
    this.tweens.add({ targets: container, alpha: { from: 0, to: 1 }, duration: 300 });
    return view;
  }

  private updateDisplay(v: DisplayView, d: Display) {
    const def = DISPLAYS[d.kind];
    const shape = SHAPES[d.kind];
    const c = this.tileCenter(d.x, d.y);
    const panel = this.controller.panel;
    const selected = typeof panel === 'object' && panel?.displayId === d.id;

    v.base.clear();
    v.glass.clear();
    let topFace: Point[];
    if (d.kind === 'rack') topFace = this.drawRack(v.base, d.x, d.y, def.color);
    else if (d.kind === 'case') {
      topFace = this.box(v.base, d.x, d.y, shape.height, def.color, 0.14);
      // Cristal semitransparente por encima de los productos.
      this.box(v.glass, d.x, d.y, 20, 0xdff6ff, 0.16, shape.height, 0.28);
    } else if (d.kind === 'table') {
      topFace = this.box(v.base, d.x, d.y, shape.height, def.color, 0.08);
    } else {
      topFace = this.box(v.base, d.x, d.y, shape.height, def.color, 0.14);
      // Baldas en la cara frontal de la estantería.
      for (const h of [10, 20]) {
        const a = this.at(d.x + 0.14, d.y + 0.86);
        const b = this.at(d.x + 0.86, d.y + 0.86);
        v.base.lineStyle(2, shade(def.color, 0.55)).lineBetween(a.x, a.y - h, b.x, b.y - h);
      }
    }
    if (selected) v.base.lineStyle(3, 0xffd166).strokePoints(topFace, true);

    // Productos: uno visible por cada fracción de la capacidad, para que se vea cómo se vacía.
    const count = d.stock <= 0 || !d.itemId ? 0 : Math.max(1, Math.ceil((d.stock / def.capacity) * shape.slots.length));
    v.products.forEach((img, i) => {
      const visible = i < count;
      if (visible && d.itemId) {
        const slot = shape.slots[i];
        const p = this.at(d.x + slot.x, d.y + slot.y);
        const lift = d.kind === 'rack' ? shape.height - 4 : shape.height;
        img.setTexture(`item:${d.itemId}`).setPosition(p.x, p.y - lift);
        img.setOrigin(0.5, d.kind === 'rack' ? 0.1 : 0.85);
        if (i >= v.shown) {
          // Recién repuesto: aparece con un pequeño salto, escalonado.
          img.setDisplaySize(shape.productSize, shape.productSize);
          const scale = img.scale;
          this.tweens.add({ targets: img, scale: { from: 0, to: scale }, duration: 300, delay: (i - v.shown) * 70, ease: 'Back.easeOut' });
        }
      }
      img.setVisible(visible);
    });
    v.shown = count;

    // Etiqueta: stock, pedido en camino o vacío.
    const labelY = c.y - shape.height - 30;
    v.truck.setVisible(!!d.order);
    if (d.order) {
      this.setLabel(v, formatTime(d.order.readyAt - this.controller.state.time), '#1d3557');
      v.label.setPosition(c.x + 9, labelY);
      v.truck.setPosition(c.x - v.label.width / 2 - 2, labelY - 9);
    } else if (d.stock === 0) {
      this.setLabel(v, '¡Vacío!', '#c1121f');
      v.label.setPosition(c.x, labelY);
    } else {
      this.setLabel(v, `${available(d)}`, '#2d6a4f');
      v.label.setPosition(c.x, labelY);
    }
  }

  /** Cambiar el fondo de un texto lo vuelve a rasterizar: solo lo hacemos si cambia. */
  private setLabel(v: DisplayView, text: string, bg: string) {
    const key = `${text}|${bg}`;
    if (key === v.labelKey) return;
    v.labelKey = key;
    v.label.setText(text).setBackgroundColor(bg);
  }

  /** Perchero: peana, dos postes y una barra de la que cuelga la ropa. */
  private drawRack(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): Point[] {
    const top = this.box(g, x, y, 4, shade(color, 0.9), 0.15);
    const h = SHAPES.rack.height;
    const a = this.at(x + 0.18, y + 0.5);
    const b = this.at(x + 0.82, y + 0.5);
    g.lineStyle(3, 0x6c757d);
    g.lineBetween(a.x, a.y - 4, a.x, a.y - h);
    g.lineBetween(b.x, b.y - 4, b.x, b.y - h);
    g.lineStyle(3, 0xadb5bd).lineBetween(a.x, a.y - h, b.x, b.y - h);
    return top;
  }

  // -------------------------------------------------------------------------
  // Clientes
  // -------------------------------------------------------------------------

  private syncCustomers(time: number) {
    const live = new Set<number>();
    for (const c of this.controller.state.customers) {
      live.add(c.id);
      const view = this.customers.get(c.id) ?? this.createCustomer(c);
      this.updateCustomer(view, c, time);
    }
    for (const [id, v] of this.customers) {
      if (live.has(id)) continue;
      v.container.destroy();
      this.customers.delete(id);
    }
  }

  private createCustomer(c: Customer): CustomerView {
    const person = PEOPLE[c.look % PEOPLE.length];
    const shadow = this.add.graphics();
    const body = this.add.image(0, 0, `person:${person}-walking`).setOrigin(0.5, 0.96);
    body.setDisplaySize(PERSON_SIZE, PERSON_SIZE);
    const bag = this.add.image(0, 0, 'ui:bags').setDisplaySize(18, 18).setOrigin(0.5, 1).setVisible(false);
    const bubble = this.add.graphics();
    const bubbleIcon = this.add.image(0, 0, 'ui:question').setDisplaySize(16, 16).setVisible(false);
    const container = this.add.container(0, 0, [shadow, body, bag, bubble, bubbleIcon]);
    const view: CustomerView = { container, shadow, body, bag, bubble, bubbleIcon, person, stride: 0, flip: false, last: { x: c.x, y: c.y } };
    this.customers.set(c.id, view);
    return view;
  }

  private updateCustomer(v: CustomerView, c: Customer, time: number) {
    const p = this.at(c.x + 0.5, c.y + 0.5);
    const prev = this.at(v.last.x + 0.5, v.last.y + 0.5);
    const moved = Math.hypot(p.x - prev.x, p.y - prev.y);
    const walking = moved > 0.05;
    v.last = { x: c.x, y: c.y };

    // El sprite caminando mira a la izquierda: lo volteamos al ir hacia la derecha.
    if (walking && Math.abs(p.x - prev.x) > 0.05) v.flip = p.x > prev.x;
    v.stride += moved * 0.22;

    const pose = walking ? 'walking' : 'standing';
    const key = `person:${v.person}-${pose}`;
    if (v.body.texture.key !== key) v.body.setTexture(key).setDisplaySize(PERSON_SIZE, PERSON_SIZE);
    const base = PERSON_SIZE / v.body.width;
    const bob = walking ? Math.abs(Math.sin(v.stride)) * 3 : 0;
    const breathe = walking ? 1 : 1 + Math.sin(time / 350 + c.id) * 0.02;
    v.body
      .setPosition(p.x, p.y - bob)
      .setFlipX(walking && v.flip)
      .setAngle(walking ? Math.sin(v.stride) * 4 : 0)
      .setScale(base, base * breathe);

    v.shadow.clear().fillStyle(0x000000, 0.2).fillEllipse(p.x, p.y, 22 - bob * 1.5, 8);

    // Entran y salen difuminándose en la puerta.
    const fromDoor = Math.hypot(c.x - ENTRANCE.x, c.y - ENTRANCE.y);
    v.container.setAlpha(Phaser.Math.Clamp(fromDoor / 0.7, 0, 1)).setDepth(c.x + c.y + 0.6);

    v.bag.setVisible(c.carrying).setPosition(p.x + (v.flip ? 12 : -12), p.y - 6 - bob);

    // Bocadillo: lo que busca, o una interrogación si no lo encuentra.
    const lostHere = c.state === 'lost' && c.x === c.tx && c.y === c.ty;
    const thinking = c.state === 'toDisplay' || lostHere;
    v.bubble.clear();
    v.bubbleIcon.setVisible(thinking);
    if (thinking) {
      const bx = p.x + 14;
      const by = p.y - PERSON_SIZE - 10 + Math.sin(time / 250 + c.id) * 1.5;
      v.bubble.fillStyle(0xffffff, 0.95).fillCircle(bx, by, 13).fillCircle(bx - 9, by + 13, 3).fillCircle(bx - 13, by + 18, 2);
      v.bubble.lineStyle(1, 0x000000, 0.15).strokeCircle(bx, by, 13);
      v.bubbleIcon.setTexture(lostHere ? 'ui:question' : `item:${c.itemId}`).setDisplaySize(18, 18).setPosition(bx, by);
    }
  }

  // -------------------------------------------------------------------------
  // Efectos
  // -------------------------------------------------------------------------

  private playEvent(e: SimEvent) {
    switch (e.type) {
      case 'pickup':
        this.fxPickup(e.displayId, e.customerId, e.itemId);
        break;
      case 'sale':
        this.fxSale(e.amount);
        break;
      case 'delivered':
        this.fxDelivered(e.displayId);
        break;
      case 'unhappy':
        this.fxPopIcon(this.at(e.x + 0.5, e.y + 0.5), 'ui:angry', 26);
        break;
      case 'levelUp': {
        const c = this.tileCenter(REGISTER.x, REGISTER.y);
        for (let i = 0; i < 6; i++) this.fxPopIcon({ x: c.x + (i - 2.5) * 22, y: c.y - 20 }, i % 2 ? 'ui:star' : 'ui:sparkles', 28, i * 80);
        break;
      }
    }
  }

  /** El producto vuela del expositor a las manos del cliente. */
  private fxPickup(displayId: number, customerId: number, itemId: string) {
    const d = this.controller.state.displays.find((x) => x.id === displayId);
    const c = this.controller.state.customers.find((x) => x.id === customerId);
    if (!d || !c) return;
    const from = this.tileCenter(d.x, d.y);
    const to = this.at(c.x + 0.5, c.y + 0.5);
    const img = this.add.image(from.x, from.y - SHAPES[d.kind].height - 8, `item:${itemId}`).setDisplaySize(22, 22).setDepth(FX_DEPTH);
    const scale = img.scale;
    this.tweens.add({ targets: img, x: to.x, duration: 450, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: img, y: img.y - 26, duration: 200, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: img,
      y: to.y - 20,
      scale: scale * 0.6,
      delay: 200,
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => img.destroy(),
    });
  }

  /** Monedas que saltan de la caja y el saco que se infla. */
  private fxSale(amount: number) {
    const c = this.tileCenter(REGISTER.x, REGISTER.y);
    const { bag, bagScale } = this.register;
    this.tweens.killTweensOf(bag);
    this.tweens.add({ targets: bag, scale: { from: bagScale, to: bagScale * 1.3 }, duration: 120, yoyo: true, ease: 'Quad.easeOut' });

    const coins = Math.min(5, 1 + Math.floor(amount / 10));
    for (let i = 0; i < coins; i++) {
      const coin = this.add.image(c.x, c.y - 34, 'ui:coin').setDisplaySize(16, 16).setDepth(FX_DEPTH);
      const dx = Phaser.Math.Between(-28, 28);
      this.tweens.add({ targets: coin, x: c.x + dx, duration: 650, delay: i * 50 });
      this.tweens.add({
        targets: coin,
        y: { from: c.y - 34, to: c.y - 70 - Phaser.Math.Between(0, 20) },
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-180, 180),
        duration: 650,
        delay: i * 50,
        ease: 'Quad.easeOut',
        onComplete: () => coin.destroy(),
      });
    }
    const t = this.add
      .text(c.x, c.y - 60, `+${amount}`, {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffd166',
        stroke: '#5c4033',
        strokeThickness: 4,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH);
    this.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 1100, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  /** Una caja cae sobre el expositor y rebota. */
  private fxDelivered(displayId: number) {
    const d = this.controller.state.displays.find((x) => x.id === displayId);
    if (!d) return;
    const c = this.tileCenter(d.x, d.y);
    const landY = c.y - SHAPES[d.kind].height - 4;
    const box = this.add.image(c.x, landY - 120, 'ui:package').setDisplaySize(30, 30).setOrigin(0.5, 1).setDepth(FX_DEPTH);
    this.tweens.add({
      targets: box,
      y: landY,
      duration: 600,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.fxPopIcon({ x: c.x, y: landY - 10 }, 'ui:sparkles', 30);
        this.tweens.add({ targets: box, alpha: 0, duration: 250, onComplete: () => box.destroy() });
      },
    });
  }

  private fxPopIcon(p: Point, key: string, size: number, delay = 0) {
    const img = this.add.image(p.x, p.y - 40, key).setDisplaySize(size, size).setDepth(FX_DEPTH).setAlpha(0);
    const scale = img.scale;
    this.tweens.add({
      targets: img,
      alpha: { from: 1, to: 0 },
      y: p.y - 80,
      scale: { from: scale * 0.4, to: scale * 1.1 },
      duration: 1000,
      delay,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }
}
