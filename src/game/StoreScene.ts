import Phaser from 'phaser';
import { ARCHETYPES } from '../sim/archetypes';
import { DECOR, FLOORS, FURNITURE_DECOR, ITEMS, WALLS, type DisplayKind } from '../sim/catalog';
import { placementError, type FurnitureKind, type FurnitureRef } from '../sim/path';
import { available, capacity } from '../sim/sim';
import {
  doorTile,
  registerFront,
  sidewalkY,
  storeSize,
  type Customer,
  type Display,
  type PlacedDecor,
  type Register,
  type SimEvent,
} from '../sim/state';
import type { Controller } from './controller';
import { at, diamond, FONT, raise, TEXT_RESOLUTION, tileCenter } from './draw';
import { Effects } from './effects';
import { formatTime } from './format';
import { TILE_H, screenToIso, shade, type Point } from './iso';
import {
  CASHIER_VARIANTS,
  CHARACTER_FRAME,
  CUSTOMER_COLUMNS,
  CHARACTER_SHEETS,
  FURNITURE_SPRITES,
  STREET_SPRITES,
  UI_SPRITES,
  decorSprite,
  cashierSheet,
  characterKey,
  characterSheet,
  furnitureSprite,
  itemSprite,
  streetSprite,
  uiSprite,
} from './sprites';
import { Atmosphere } from './atmosphere';
import { Street } from './street';

const WALL_HEIGHT = 70;
/** Los fotogramas de personajes son el doble del tamaño de juego y tienen los pies al 90%. */
const CHARACTER_SCALE = 0.5;
const CHARACTER_ORIGIN_Y = 0.9;
/** Altura aproximada de la cabeza sobre los pies, en píxeles del juego. */
const HEAD_TOP = 50;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.6;
const DRAG_THRESHOLD = 8;
/** Segundos que tarda un cliente en aparecer del todo. */
const ENTRANCE_FADE = 0.5;

/**
 * Cómo se colocan los productos sobre cada mueble 3D (ver scripts/furniture/models.js).
 * Alturas en píxeles del juego (1 unidad 3D ≈ 39 px).
 */
interface DisplayShape {
  /** Altura de la superficie donde van los productos. */
  height: number;
  /** Altura total del mueble: para la etiqueta y para poder tocarlo. */
  top: number;
  /** Posiciones de los productos en la casilla (0-1), en el orden en que se llenan; `h` cambia la altura. */
  slots: Slot[];
  productSize: number;
  /** Capa de cristal que va por encima de los productos. */
  glass?: string;
}

interface Slot extends Point {
  h?: number;
}

const grid = (cols: number, rows: number, from = 0.28, to = 0.72, fromY = from, toY = to, h?: number): Slot[] => {
  const pts: Slot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pts.push({
        x: cols === 1 ? 0.5 : from + ((to - from) * c) / (cols - 1),
        y: rows === 1 ? (fromY + toY) / 2 : fromY + ((toY - fromY) * r) / (rows - 1),
        h,
      });
    }
  }
  return pts.sort((a, b) => a.x + a.y - (b.x + b.y));
};

const SHAPES: Record<DisplayKind, DisplayShape> = {
  // En el perchero la ropa cuelga de la barra.
  rack: { height: 41, top: 44, slots: grid(5, 1, 0.24, 0.78, 0.5, 0.5), productSize: 24 },
  shelf: { height: 31, top: 33, slots: grid(3, 2, 0.25, 0.75), productSize: 19 },
  case: { height: 18, top: 32, slots: grid(2, 2, 0.3, 0.7), productSize: 20, glass: 'case-glass' },
  table: { height: 16, top: 18, slots: grid(3, 2, 0.25, 0.75), productSize: 22 },
  boutique: { height: 20, top: 42, slots: grid(2, 2, 0.3, 0.7, 0.5, 0.78), productSize: 20 },
  sports: { height: 5, top: 14, slots: grid(2, 2, 0.32, 0.72), productSize: 28 },
  // Frutería: fila de atrás más alta que la de delante.
  fruit: { height: 15, top: 46, slots: [...grid(3, 1, 0.22, 0.78, 0.3, 0.3, 23), ...grid(3, 1, 0.22, 0.78, 0.7, 0.7, 15)], productSize: 18 },
  veggie: { height: 19, top: 22, slots: grid(3, 2, 0.24, 0.76, 0.36, 0.65), productSize: 18 },
  bakery: { height: 19, top: 31, slots: grid(3, 2, 0.24, 0.76, 0.38, 0.66), productSize: 18, glass: 'bakery-glass' },
  butcher: { height: 19, top: 30, slots: grid(3, 2, 0.25, 0.72, 0.45, 0.7), productSize: 18, glass: 'butcher-glass' },
  cheese: { height: 19, top: 36, slots: grid(2, 2, 0.28, 0.6, 0.5, 0.76), productSize: 22 },
  // Nevera: tres baldas que se llenan de abajo arriba.
  fridge: {
    height: 4,
    top: 50,
    slots: [4, 18, 32].flatMap((h) => grid(3, 1, 0.28, 0.72, 0.56, 0.56, h)),
    productSize: 15,
    glass: 'fridge-glass',
  },
  freezer: { height: 15, top: 20, slots: grid(3, 2, 0.25, 0.75, 0.3, 0.7), productSize: 18, glass: 'freezer-glass' },
};

/** Altura (px) de la decoración 3D, para poder tocarla. */
const DECOR_3D_HEIGHT: Record<string, number> = { bench: 20, rug: 2, lamp: 50, sofa: 26, mannequin: 48, ficus: 48, tree: 46, fountain: 30 };

/** Los sprites de muebles miden 2 casillas de ancho y el centro de la casilla está al 75% de su altura. */
const FURNITURE_SIZE = 128;
const FURNITURE_ORIGIN_Y = 0.75;

const DECOR_SIZE: Record<string, number> = {
  plant: 36, cactus: 32, sunflower: 38, tulip: 34, picture: 30, bouquet: 34, dog: 36,
  sofa: 58, palm: 66, tree: 60, fountain: 62, moai: 52, statue: 70, balloons: 46, pumpkin: 32, snowman: 44,
};

interface DisplayView {
  container: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Graphics;
  body: Phaser.GameObjects.Image;
  products: Phaser.GameObjects.Image[];
  glass: Phaser.GameObjects.Image | null;
  truck: Phaser.GameObjects.Image;
  fire: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  labelKey: string;
  shown: number;
  itemId: string | null;
}

interface RegisterView {
  container: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  body: Phaser.GameObjects.Image;
  cashier: Phaser.GameObjects.Sprite;
  variant: number;
  /** Hasta cuándo saluda tras cobrar (ms de la escena). */
  waveUntil: number;
}

type Facing = 'front' | 'back';

interface CustomerView {
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Graphics;
  body: Phaser.GameObjects.Sprite;
  bag: Phaser.GameObjects.Image;
  crown: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Graphics;
  bubbleIcon: Phaser.GameObjects.Image;
  /** Clave de la hoja del personaje (char:<tipo>:<variante>). */
  key: string;
  /** Distintivo sobre la cabeza: lista de la compra, libreta del crítico o sirena del ladrón. */
  badge: Phaser.GameObjects.Image;
  facing: Facing;
  flip: boolean;
  last: Point;
}

interface DecorView {
  container: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

export class StoreScene extends Phaser.Scene {
  private controller!: Controller;
  private floor!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private ghostImage!: Phaser.GameObjects.Image;
  private street!: Street;
  private atmosphere!: Atmosphere;
  private fx!: Effects;
  private hover: Point | null = null;
  private displays = new Map<number, DisplayView>();
  private registers = new Map<number, RegisterView>();
  private customers = new Map<number, CustomerView>();
  private decor = new Map<number, DecorView>();
  private size = { w: 0, h: 0 };
  private fitZoom = 1;
  private userZoom = 1;
  private drag: { x: number; y: number; scrollX: number; scrollY: number; moved: boolean } | null = null;
  private pinch: number | null = null;
  private placementCache = { key: '', error: null as string | null };

  constructor() {
    super('store');
  }

  init(data: { controller: Controller }) {
    this.controller = data.controller;
  }

  preload() {
    for (const item of ITEMS) this.load.image(`item:${item.id}`, itemSprite(item.id));
    for (const d of DECOR) this.load.image(`decor:${d.id}`, decorSprite(d.id));
    for (const name of UI_SPRITES) this.load.image(`ui:${name}`, uiSprite(name));
    for (const name of STREET_SPRITES) this.load.image(`street:${name}`, streetSprite(name));
    for (const [sheet, count] of Object.entries(CHARACTER_SHEETS)) {
      for (let i = 0; i < count; i++) this.load.spritesheet(characterKey(sheet, i), characterSheet(sheet, i), CHARACTER_FRAME);
    }
    for (let i = 0; i < CASHIER_VARIANTS; i++) this.load.spritesheet(`cash:${i}`, cashierSheet(i), CHARACTER_FRAME);
    for (const name of FURNITURE_SPRITES) this.load.image(`furn:${name}`, furnitureSprite(name));
  }

  create() {
    this.createAnimations();
    this.floor = this.add.graphics().setDepth(-2);
    this.ghost = this.add.graphics().setDepth(900);
    this.ghostImage = this.add.image(0, 0, 'ui:package').setDepth(901).setVisible(false);
    this.street = new Street(this);
    this.atmosphere = new Atmosphere(this);
    this.fx = new Effects(this);
    this.input.addPointer(1);
    this.scale.on('resize', () => this.fitCamera());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.setZoom(this.userZoom * (dy > 0 ? 0.9 : 1.1));
    });
  }

  /** Animaciones de las hojas de personajes (ver sprites.ts para el orden de los fotogramas). */
  private createAnimations() {
    const frames = (key: string, list: number[]) => list.map((frame) => ({ key, frame }));
    const walk = [0, 1, 2, 3, 4, 5, 6, 7];
    const keys = Object.entries(CHARACTER_SHEETS).flatMap(([sheet, count]) => Array.from({ length: count }, (_, i) => characterKey(sheet, i)));
    for (const key of keys) {
      this.anims.create({ key: `${key}:walk-front`, frames: frames(key, walk), frameRate: 11, repeat: -1 });
      this.anims.create({ key: `${key}:walk-back`, frames: frames(key, walk.map((f) => f + CUSTOMER_COLUMNS)), frameRate: 11, repeat: -1 });
    }
    for (let i = 0; i < CASHIER_VARIANTS; i++) {
      const key = `cash:${i}`;
      this.anims.create({ key: `${key}:idle`, frames: frames(key, [0, 1]), frameRate: 1.5, repeat: -1, yoyo: true });
      this.anims.create({ key: `${key}:scan`, frames: frames(key, [2, 3, 4, 3]), frameRate: 7, repeat: -1 });
      this.anims.create({ key: `${key}:wave`, frames: frames(key, [5, 6]), frameRate: 5, repeat: -1 });
    }
  }

  update(time: number, delta: number) {
    this.controller.update(delta, Date.now());
    const events = this.controller.consumeEvents();
    const { w, h } = storeSize(this.controller.state);
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      this.street.layout(w, h);
      this.atmosphere.setLights(this.street.lampHeads, { w, h });
      this.userZoom = 1;
      this.fitCamera();
    }
    this.street.update(Math.min(delta, 100) / 1000);
    this.atmosphere.update(this.controller.state);
    this.drawFloor();
    this.syncDecor(time);
    this.syncRegisters(time);
    this.syncDisplays();
    this.syncCustomers(time);
    this.drawGhost();
    for (const e of events) this.playEvent(e);
  }

  // -------------------------------------------------------------------------
  // Cámara y entrada
  // -------------------------------------------------------------------------

  /** Encaja la tienda y la acera en pantalla, dejando hueco para el HUD y la barra inferior. */
  private fitCamera() {
    const { w, h } = this.size;
    const { width, height } = this.scale;
    // En pantallas estrechas se encuadra solo la tienda; en anchas, también algo de calle.
    const narrow = width < 640;
    const left = at(narrow ? 0 : -1, h + (narrow ? 0.6 : 1.5)).x;
    const right = at(w + (narrow ? 0.2 : 1.5), 0).x;
    const top = at(0, 0).y - WALL_HEIGHT - 30;
    const bottom = at(w, h + 1.6).y;
    const reservedUi = narrow ? 190 : 150;
    this.fitZoom = Math.min(width / (right - left), (height - reservedUi) / (bottom - top), 1.8);
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(this.fitZoom * this.userZoom, MIN_ZOOM, MAX_ZOOM));
    cam.centerOn((left + right) / 2, (top + bottom) / 2 - 12 / cam.zoom);
  }

  private setZoom(userZoom: number) {
    const cam = this.cameras.main;
    const zoom = Phaser.Math.Clamp(this.fitZoom * userZoom, MIN_ZOOM, MAX_ZOOM);
    this.userZoom = zoom / this.fitZoom;
    const mid = cam.midPoint.clone();
    cam.setZoom(zoom);
    cam.centerOn(mid.x, mid.y);
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    const pointers = [this.input.pointer1, this.input.pointer2].filter((q) => q?.isDown);
    if (pointers.length === 2) {
      this.pinch = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y);
      this.drag = null;
      return;
    }
    const cam = this.cameras.main;
    this.drag = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, moved: false };
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    this.hover = this.tileAt(p.worldX, p.worldY);
    const pointers = [this.input.pointer1, this.input.pointer2].filter((q) => q?.isDown);
    if (this.pinch !== null && pointers.length === 2) {
      const dist = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y);
      this.setZoom(this.userZoom * (dist / this.pinch));
      this.pinch = dist;
      return;
    }
    if (!this.drag || !p.isDown) return;
    const dx = p.x - this.drag.x;
    const dy = p.y - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    this.drag.moved = true;
    const cam = this.cameras.main;
    cam.setScroll(this.drag.scrollX - dx / cam.zoom, this.drag.scrollY - dy / cam.zoom);
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    const wasPinch = this.pinch !== null;
    if (wasPinch && !this.input.pointer1.isDown && !this.input.pointer2?.isDown) this.pinch = null;
    const drag = this.drag;
    this.drag = null;
    if (wasPinch || drag?.moved) return;
    this.onTap(p);
  }

  private tileAt(sx: number, sy: number): Point | null {
    const p = screenToIso(sx, sy, { x: 0, y: 0 });
    const tile = { x: Math.floor(p.x), y: Math.floor(p.y) };
    const { w, h } = this.size;
    return tile.x >= 0 && tile.y >= 0 && tile.x < w && tile.y < h ? tile : null;
  }

  /** El mueble que hay bajo el puntero, contando su volumen y no solo su casilla. */
  private furnitureAt(sx: number, sy: number): FurnitureRef | null {
    const s = this.controller.state;
    const hits: { ref: FurnitureRef; depth: number }[] = [];
    const test = (kind: FurnitureKind, id: number, x: number, y: number, height: number) => {
      const c = tileCenter(x, y);
      if (Math.abs(sx - c.x) < 28 && sy > c.y - height - TILE_H / 2 && sy < c.y + TILE_H / 2) hits.push({ ref: { kind, id }, depth: x + y });
    };
    for (const d of s.displays) test('display', d.id, d.x, d.y, SHAPES[d.kind].top + 10);
    for (const r of s.registers) test('register', r.id, r.x, r.y, 40);
    for (const d of s.decor) test('decor', d.id, d.x, d.y, DECOR_3D_HEIGHT[d.decorId] ?? (DECOR_SIZE[d.decorId] ?? 34) * 0.8);
    hits.sort((a, b) => b.depth - a.depth);
    return hits[0]?.ref ?? null;
  }

  private onTap(p: Phaser.Input.Pointer) {
    const c = this.controller;
    if (c.mode.type !== 'idle') {
      const tile = this.tileAt(p.worldX, p.worldY);
      if (tile) c.tapTile(tile.x, tile.y);
      return;
    }
    const thief = this.thiefAt(p.worldX, p.worldY);
    if (thief !== null) {
      c.catchThief(thief);
      return;
    }
    c.selectFurniture(this.furnitureAt(p.worldX, p.worldY));
  }

  /** Ladrón bajo el puntero (con margen generoso: hay que atraparlo mientras corre). */
  private thiefAt(sx: number, sy: number): number | null {
    for (const c of this.controller.state.customers) {
      if (c.kind !== 'thief' || c.state === 'leaving') continue;
      const p = tileCenter(c.x, c.y);
      if (Math.abs(sx - p.x) < 22 && sy > p.y - HEAD_TOP - 14 && sy < p.y + 10) return c.id;
    }
    return null;
  }

  private isSelected(kind: FurnitureKind, id: number) {
    const panel = this.controller.panel;
    const mode = this.controller.mode;
    if (mode.type === 'move') return mode.ref.kind === kind && mode.ref.id === id;
    return typeof panel === 'object' && panel !== null && panel.furniture.kind === kind && panel.furniture.id === id;
  }

  private isMoving(kind: FurnitureKind, id: number) {
    const mode = this.controller.mode;
    return mode.type === 'move' && mode.ref.kind === kind && mode.ref.id === id;
  }

  // -------------------------------------------------------------------------
  // Suelo, paredes y vista previa
  // -------------------------------------------------------------------------

  private drawFloor() {
    const g = this.floor.clear();
    const s = this.controller.state;
    const { w, h } = this.size;
    const floor = FLOORS.find((f) => f.id === s.floor) ?? FLOORS[0];
    const wall = WALLS.find((f) => f.id === s.wall) ?? WALLS[0];
    const corner = at(0, 0);
    const right = at(w, 0);
    const left = at(0, h);
    const up = raise;

    // Paredes del fondo con zócalo y ventanas.
    g.fillStyle(wall.colors[1]).fillPoints([corner, right, up(right, WALL_HEIGHT), up(corner, WALL_HEIGHT)], true);
    g.fillStyle(wall.colors[0]).fillPoints([corner, left, up(left, WALL_HEIGHT), up(corner, WALL_HEIGHT)], true);
    if (s.wall === 'brick') this.drawBricks(g, w, h);
    g.fillStyle(0xb5835a).fillPoints([corner, right, up(right, 8), up(corner, 8)], true);
    g.fillStyle(0xa47148).fillPoints([corner, left, up(left, 8), up(corner, 8)], true);
    const windows = (n: number, along: (t: number) => Point, color: number) => {
      for (let i = 0; i < n; i++) {
        const t0 = (i + 0.5) * (1 / n) - 0.08;
        const a = along(t0);
        const b = along(t0 + 0.16);
        const pts = [up(a, 22), up(b, 22), up(b, 56), up(a, 56)];
        g.fillStyle(color).fillPoints(pts, true);
        g.lineStyle(3, 0xffffff).strokePoints(pts, true);
      }
    };
    windows(Math.round(w / 4), (t) => at(t * w, 0), 0xbde0fe);
    windows(Math.round(h / 4), (t) => at(0, t * h), 0xa2d2ff);
    g.fillStyle(0x9c6644).fillRect(corner.x - 1, corner.y - WALL_HEIGHT, 2, WALL_HEIGHT);

    // Suelo con el estilo elegido; la puerta y los puestos de las cajas, marcados.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) diamond(g, x, y, x + 1, y + 1, floor.colors[(x + y) % 2]);
    }
    const door = doorTile(s);
    diamond(g, door.x + 0.1, door.y + 0.1, door.x + 0.9, door.y + 0.9, 0x95c48f, 0.9);
    for (const r of s.registers) {
      const f = registerFront(r);
      diamond(g, f.x + 0.2, f.y + 0.2, f.x + 0.8, f.y + 0.8, 0xffd166, 0.35);
    }
    if (this.controller.mode.type !== 'idle') {
      // En modo construcción se ve la cuadrícula.
      g.lineStyle(1, 0x000000, 0.08);
      for (let x = 0; x <= w; x++) g.lineBetween(at(x, 0).x, at(x, 0).y, at(x, h).x, at(x, h).y);
      for (let y = 0; y <= h; y++) g.lineBetween(at(0, y).x, at(0, y).y, at(w, y).x, at(w, y).y);
    }
    g.lineStyle(2, 0x9c6644).strokePoints([corner, right, at(w, h), left], true);
    Street.drawFrontWalls(g, w, h, shade(wall.colors[0], 0.85));
  }

  private drawBricks(g: Phaser.GameObjects.Graphics, w: number, h: number) {
    g.lineStyle(1, 0x8c4a2f, 0.35);
    for (let row = 1; row < 7; row++) {
      const hgt = row * 10;
      g.lineBetween(at(0, 0).x, at(0, 0).y - hgt, at(w, 0).x, at(w, 0).y - hgt);
      g.lineBetween(at(0, 0).x, at(0, 0).y - hgt, at(0, h).x, at(0, h).y - hgt);
    }
  }

  /** Vista previa del mueble que se coloca o se mueve, en verde o rojo según se pueda. */
  private drawGhost() {
    const g = this.ghost.clear();
    const ghost = this.ghostImage.setVisible(false);
    const c = this.controller;
    const m = c.mode;
    const tile = this.hover;
    if (m.type === 'idle' || !tile) return;

    let kind: FurnitureKind;
    let decorId: string | undefined;
    let displayKind: DisplayKind | undefined;
    let moving: FurnitureRef | undefined;
    if (m.type === 'placeDisplay') [kind, displayKind] = ['display', m.kind];
    else if (m.type === 'placeRegister') kind = 'register';
    else if (m.type === 'placeDecor') [kind, decorId] = ['decor', m.decorId];
    else {
      moving = m.ref;
      kind = m.ref.kind;
      if (kind === 'display') displayKind = c.state.displays.find((d) => d.id === m.ref.id)?.kind;
      if (kind === 'decor') decorId = c.state.decor.find((d) => d.id === m.ref.id)?.decorId;
    }

    const key = `${kind}|${decorId}|${moving?.id}|${tile.x},${tile.y}|${c.state.displays.length}|${c.state.decor.length}|${c.state.registers.length}`;
    if (key !== this.placementCache.key) {
      this.placementCache = { key, error: placementError(c.state, kind, tile.x, tile.y, { moving, decorId }) };
    }
    const valid = !this.placementCache.error;
    diamond(g, tile.x, tile.y, tile.x + 1, tile.y + 1, valid ? 0x2a9d8f : 0xe63946, 0.4);
    const p = tileCenter(tile.x, tile.y);
    const tint = valid ? 0xffffff : 0xff8080;

    if (kind === 'register') {
      diamond(g, tile.x + 0.2, tile.y + 1.2, tile.x + 0.8, tile.y + 1.8, 0xffd166, 0.6);
      ghost.setTexture('furn:register').setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE);
    } else if (kind === 'display' && displayKind) {
      ghost.setTexture(`furn:${displayKind}`).setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE);
    } else if (decorId && FURNITURE_DECOR.has(decorId)) {
      ghost.setTexture(`decor:${decorId}`).setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE);
    } else if (decorId) {
      const size = DECOR_SIZE[decorId] ?? 34;
      ghost.setTexture(`decor:${decorId}`).setOrigin(0.5, 1).setDisplaySize(size, size);
      p.y += 4;
    } else {
      return;
    }
    ghost.setPosition(p.x, p.y).setTint(tint).setAlpha(0.7).setVisible(true);
  }

  // -------------------------------------------------------------------------
  // Decoración
  // -------------------------------------------------------------------------

  private syncDecor(time: number) {
    const live = new Set<number>();
    for (const d of this.controller.state.decor) {
      live.add(d.id);
      let view = this.decor.get(d.id);
      if (view && (view.x !== d.x || view.y !== d.y)) {
        view.container.destroy();
        view = undefined;
      }
      view ??= this.createDecor(d);
      const selected = this.isSelected('decor', d.id);
      view.container.setAlpha(this.isMoving('decor', d.id) ? 0.35 : 1);
      view.image.setTint(selected ? 0xfff3b0 : 0xffffff);
      if (d.decorId === 'dog') {
        // El perro da saltitos y mira a un lado y a otro.
        const c = tileCenter(d.x, d.y);
        view.image.setY(c.y + 4 - Math.abs(Math.sin(time / 260 + d.id)) * 4).setFlipX(Math.sin(time / 2300 + d.id) > 0);
      }
    }
    for (const [id, v] of this.decor) {
      if (live.has(id)) continue;
      v.container.destroy();
      this.decor.delete(id);
    }
  }

  private createDecor(d: PlacedDecor): DecorView {
    const g = this.add.graphics();
    const c = tileCenter(d.x, d.y);
    let image: Phaser.GameObjects.Image;
    if (FURNITURE_DECOR.has(d.decorId)) {
      image = this.add.image(c.x, c.y, `decor:${d.decorId}`).setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE);
    } else {
      const size = DECOR_SIZE[d.decorId] ?? 34;
      g.fillStyle(0x000000, 0.15).fillEllipse(c.x, c.y, size * 0.8, size * 0.3);
      image = this.add.image(c.x, c.y + 4, `decor:${d.decorId}`).setDisplaySize(size, size).setOrigin(0.5, 1);
    }
    this.tweens.add({ targets: image, scale: { from: 0, to: image.scale }, duration: 350, ease: 'Back.easeOut' });
    // La alfombra es plana: siempre por debajo de muebles y clientes.
    const container = this.add.container(0, 0, [g, image]).setDepth(d.decorId === 'rug' ? -1 : d.x + d.y);
    const view = { container, g, image, x: d.x, y: d.y };
    this.decor.set(d.id, view);
    return view;
  }

  // -------------------------------------------------------------------------
  // Cajas registradoras
  // -------------------------------------------------------------------------

  private syncRegisters(time: number) {
    const live = new Set<number>();
    for (const r of this.controller.state.registers) {
      live.add(r.id);
      const view = this.registers.get(r.id) ?? this.createRegister(r);
      this.updateRegister(view, r, time);
    }
    for (const [id, v] of this.registers) {
      if (live.has(id)) continue;
      v.container.destroy();
      this.registers.delete(id);
    }
  }

  private createRegister(r: Register): RegisterView {
    const g = this.add.graphics();
    // Cada caja tiene su cajero, elegido según su id para que no cambie al recargar.
    const variant = (r.id * 7) % CASHIER_VARIANTS;
    // Los cajeros miran hacia delante (+y, abajo a la izquierda): la hoja mira a la derecha, así que se voltea.
    const cashier = this.add.sprite(0, 0, `cash:${variant}`).setOrigin(0.5, CHARACTER_ORIGIN_Y).setScale(CHARACTER_SCALE).setFlipX(true);
    cashier.play(`cash:${variant}:idle`);
    const body = this.add.image(0, 0, 'furn:register').setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE);
    const container = this.add.container(0, 0, [g, cashier, body]);
    const view = { container, g, body, cashier, variant, waveUntil: 0 };
    this.registers.set(r.id, view);
    return view;
  }

  private updateRegister(v: RegisterView, r: Register, time: number) {
    const selected = this.isSelected('register', r.id);
    v.container.setDepth(r.x + r.y).setAlpha(this.isMoving('register', r.id) ? 0.35 : 1);
    v.g.clear();
    if (selected) diamond(v.g, r.x, r.y, r.x + 1, r.y + 1, 0xffd166, 0.6);
    const c = tileCenter(r.x, r.y);
    v.body.setPosition(c.x, c.y).setTint(selected ? 0xfff3b0 : 0xffffff);
    // Detrás del mostrador: escanea mientras cobra y saluda un momento al terminar.
    const anim = time < v.waveUntil ? 'wave' : r.serveTimer > 0 ? 'scan' : 'idle';
    v.cashier.play(`cash:${v.variant}:${anim}`, true);
    const back = at(r.x + 0.5, r.y + 0.08);
    v.cashier.setPosition(back.x, back.y);
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
    const body = this.add.image(0, 0, `furn:${d.kind}`).setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE);
    const products = shape.slots.map(() => this.add.image(0, 0, 'ui:package').setVisible(false));
    // Vitrinas, neveras y mostradores tienen el cristal en otra capa, por encima de los productos.
    const glass = shape.glass
      ? this.add.image(0, 0, `furn:${shape.glass}`).setOrigin(0.5, FURNITURE_ORIGIN_Y).setDisplaySize(FURNITURE_SIZE, FURNITURE_SIZE)
      : null;
    const truck = this.add.image(0, 0, 'ui:truck').setDisplaySize(18, 18).setVisible(false);
    const fire = this.add.image(0, 0, 'ui:fire').setDisplaySize(16, 16).setVisible(false);
    const label = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#fff', resolution: TEXT_RESOLUTION })
      .setOrigin(0.5, 1)
      .setPadding(5, 2, 5, 2);
    const layers = [base, body, ...products, ...(glass ? [glass] : []), truck, fire, label];
    const container = this.add.container(0, 0, layers);
    const view: DisplayView = { container, base, body, products, glass, truck, fire, label, labelKey: '', shown: 0, itemId: null };
    this.displays.set(d.id, view);
    this.tweens.add({ targets: container, alpha: { from: 0, to: 1 }, duration: 300 });
    return view;
  }

  private updateDisplay(v: DisplayView, d: Display) {
    const s = this.controller.state;
    const shape = SHAPES[d.kind];
    const c = tileCenter(d.x, d.y);
    v.container.setDepth(d.x + d.y).setAlpha(this.isMoving('display', d.id) ? 0.35 : 1);

    v.base.clear();
    const selected = this.isSelected('display', d.id);
    if (selected) diamond(v.base, d.x, d.y, d.x + 1, d.y + 1, 0xffd166, 0.6);
    v.body.setPosition(c.x, c.y).setTint(selected ? 0xfff3b0 : 0xffffff);
    v.glass?.setPosition(c.x, c.y);

    // Productos: uno visible por cada fracción de la capacidad, para que se vea cómo se vacía.
    const cap = capacity(s, d.kind);
    const count = d.stock <= 0 || !d.itemId ? 0 : Math.max(1, Math.ceil((d.stock / cap) * shape.slots.length));
    if (d.itemId !== v.itemId) v.shown = 0;
    v.itemId = d.itemId;
    v.products.forEach((img, i) => {
      const visible = i < count;
      if (visible && d.itemId) {
        const slot = shape.slots[i];
        const p = at(d.x + slot.x, d.y + slot.y);
        const lift = slot.h ?? (d.kind === 'rack' ? shape.height - 2 : shape.height);
        img.setTexture(`item:${d.itemId}`).setPosition(p.x, p.y - lift).setOrigin(0.5, d.kind === 'rack' ? 0.1 : 0.85);
        if (i >= v.shown) {
          // Recién repuesto: aparece con un pequeño salto, escalonado.
          img.setDisplaySize(shape.productSize, shape.productSize);
          this.tweens.add({ targets: img, scale: { from: 0, to: img.scale }, duration: 300, delay: (i - v.shown) * 70, ease: 'Back.easeOut' });
        }
      }
      img.setVisible(visible);
    });
    v.shown = count;

    // Etiqueta: stock, pedido en camino (con barra de progreso) o vacío.
    const labelY = c.y - shape.top - 14;
    const trending = s.trend?.kind === d.kind;
    v.truck.setVisible(!!d.order);
    if (d.order) {
      this.setLabel(v, formatTime(d.order.readyAt - s.time), '#1d3557');
      v.label.setPosition(c.x + 9, labelY);
      v.truck.setPosition(c.x - v.label.width / 2 - 2, labelY - 9);
      const progress = Phaser.Math.Clamp(1 - (d.order.readyAt - s.time) / d.order.totalMs, 0, 1);
      v.base.fillStyle(0x000000, 0.35).fillRect(c.x - 20, labelY + 2, 40, 4);
      v.base.fillStyle(0x4d96ff).fillRect(c.x - 20, labelY + 2, 40 * progress, 4);
    } else if (d.stock === 0) {
      this.setLabel(v, '¡Vacío!', '#c1121f');
      v.label.setPosition(c.x, labelY);
    } else {
      const left = available(d);
      this.setLabel(v, `${left}`, left <= 2 ? '#e76f51' : '#2d6a4f');
      v.label.setPosition(c.x, labelY);
    }
    v.fire.setVisible(trending).setPosition(c.x + v.label.width / 2 + (d.order ? 18 : 9), labelY - 9);
  }

  /** Cambiar el fondo de un texto lo vuelve a rasterizar: solo lo hacemos si cambia. */
  private setLabel(v: DisplayView, text: string, bg: string) {
    const key = `${text}|${bg}`;
    if (key === v.labelKey) return;
    v.labelKey = key;
    v.label.setText(text).setBackgroundColor(bg);
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
    const sheet = ARCHETYPES[c.kind].sheet;
    const key = characterKey(sheet, c.look % CHARACTER_SHEETS[sheet]);
    const shadow = this.add.graphics();
    const body = this.add.sprite(0, 0, key, 8).setOrigin(0.5, CHARACTER_ORIGIN_Y).setScale(CHARACTER_SCALE);
    // Los abuelos caminan más despacio y los niños más deprisa: la animación sigue su ritmo.
    body.anims.timeScale = c.speed / 2.2;
    const badge = this.add.image(0, 0, 'ui:notepad').setDisplaySize(16, 16).setVisible(false);
    const bag = this.add.image(0, 0, 'ui:bags').setDisplaySize(16, 16).setOrigin(0.5, 1).setVisible(false);
    const crown = this.add.image(0, 0, 'ui:crown').setDisplaySize(18, 18).setVisible(c.vip);
    const bubble = this.add.graphics();
    const bubbleIcon = this.add.image(0, 0, 'ui:question').setDisplaySize(16, 16).setVisible(false);
    const container = this.add.container(0, 0, [shadow, body, bag, crown, badge, bubble, bubbleIcon]);
    const view: CustomerView = { container, shadow, body, bag, crown, badge, bubble, bubbleIcon, key, facing: 'front', flip: false, last: { x: c.x, y: c.y } };
    this.customers.set(c.id, view);
    return view;
  }

  /**
   * Hacia dónde mira alguien que se mueve (o mira) en la dirección (dx, dy) de la cuadrícula.
   * Las hojas tienen dos vistas, de frente (abajo a la derecha) y de espaldas (arriba a la
   * derecha); las otras dos se consiguen volteando el sprite.
   */
  private facingFor(dx: number, dy: number): { facing: Facing; flip: boolean } {
    const sx = dx - dy;
    const sy = dx + dy;
    return { facing: sy >= 0 ? 'front' : 'back', flip: sx < 0 };
  }

  private updateCustomer(v: CustomerView, c: Customer, time: number) {
    const s = this.controller.state;
    const p = tileCenter(c.x, c.y);
    const dx = c.x - v.last.x;
    const dy = c.y - v.last.y;
    const walking = Math.hypot(dx, dy) > 0.001;
    v.last = { x: c.x, y: c.y };

    // Hacia dónde mira: adonde camina; al mirar un estante, hacia él; en la cola, hacia la caja.
    let look: { dx: number; dy: number } | null = walking ? { dx, dy } : null;
    const display = s.displays.find((d) => d.id === c.displayId);
    if (!walking && c.state === 'browsing' && display) look = { dx: display.x - c.x, dy: display.y - c.y };
    if (!walking && c.state === 'queue') look = { dx: 0, dy: -1 };
    if (look) Object.assign(v, this.facingFor(look.dx, look.dy));

    const row = v.facing === 'front' ? 0 : CUSTOMER_COLUMNS;
    if (walking) {
      v.body.anims.timeScale = c.speed / 2.2;
      v.body.play(`${v.key}:walk-${v.facing}`, true);
    } else {
      v.body.stop();
      v.body.setFrame(row + (c.state === 'browsing' ? 9 : 8));
    }
    v.body.setPosition(p.x, p.y).setFlipX(v.flip);

    v.shadow.clear();
    if (c.vip) v.shadow.fillStyle(0xffd60a, 0.35).fillEllipse(p.x, p.y, 34, 13);
    v.shadow.fillStyle(0x000000, 0.2).fillEllipse(p.x, p.y, 20, 7);
    v.crown.setPosition(p.x, p.y - HEAD_TOP - 6);
    // Distintivos: lista de la compra, libreta del crítico y sirena sobre el ladrón que huye.
    const badge = c.kind === 'list' ? 'ui:notepad' : c.kind === 'critic' ? 'ui:memo' : c.kind === 'thief' && c.state === 'fleeing' ? 'ui:siren' : null;
    v.badge.setVisible(badge !== null);
    if (badge) {
      const pulse = c.kind === 'thief' ? 1 + Math.abs(Math.sin(time / 120)) * 0.35 : 1;
      v.badge.setTexture(badge).setDisplaySize(16 * pulse, 16 * pulse).setPosition(p.x - 14, p.y - HEAD_TOP - 4);
    }

    // Entran y salen difuminándose por la acera.
    const { w } = this.size;
    const fromEdge = Math.min(c.x + 2, w + 1 - c.x);
    const fadeIn = Math.min(1, c.age / ENTRANCE_FADE);
    v.container.setAlpha(Phaser.Math.Clamp(Math.min(fromEdge / 0.8, fadeIn), 0, 1)).setDepth(c.x + c.y + 0.6);

    // La bolsa cuelga de la mano que queda hacia el espectador.
    v.bag.setVisible(c.carrying).setPosition(p.x + (v.flip ? -9 : 9), p.y - 8);

    // Bocadillo: lo que busca, o una interrogación si no lo encuentra.
    const lostHere = c.state === 'lost' && c.path.length === 0 && c.y < sidewalkY(s) - 0.5;
    const thinking = c.state === 'toDisplay' || lostHere;
    v.bubble.clear();
    v.bubbleIcon.setVisible(thinking);
    if (thinking) {
      const bx = p.x + 14;
      const by = p.y - HEAD_TOP - (c.vip ? 20 : 8) + Math.sin(time / 250 + c.id) * 1.5;
      v.bubble.fillStyle(0xffffff, 0.95).fillCircle(bx, by, 13).fillCircle(bx - 9, by + 13, 3).fillCircle(bx - 13, by + 18, 2);
      v.bubble.lineStyle(1, 0x000000, 0.15).strokeCircle(bx, by, 13);
      v.bubbleIcon.setTexture(lostHere ? 'ui:question' : `item:${c.itemId}`).setDisplaySize(18, 18).setPosition(bx, by);
    }
  }

  // -------------------------------------------------------------------------
  // Efectos
  // -------------------------------------------------------------------------

  private playEvent(e: SimEvent) {
    const s = this.controller.state;
    switch (e.type) {
      case 'pickup': {
        const d = s.displays.find((x) => x.id === e.displayId);
        const c = s.customers.find((x) => x.id === e.customerId);
        if (!d || !c) return;
        const from = tileCenter(d.x, d.y);
        const to = tileCenter(c.x, c.y);
        this.fx.flyItem({ x: from.x, y: from.y - SHAPES[d.kind].top }, { x: to.x, y: to.y - 20 }, `item:${e.itemId}`);
        return;
      }
      case 'sale': {
        const r = s.registers.find((x) => x.id === e.registerId);
        if (!r) return;
        const c = tileCenter(r.x, r.y);
        this.fx.sale({ x: c.x, y: c.y - 40 }, e.amount, e.tip, e.gem, e.vip);
        const view = this.registers.get(r.id);
        if (view) view.waveUntil = this.time.now + 900;
        return;
      }
      case 'delivered': {
        const d = s.displays.find((x) => x.id === e.displayId);
        if (!d) return;
        const c = tileCenter(d.x, d.y);
        this.fx.delivered({ x: c.x, y: c.y - SHAPES[d.kind].top });
        this.street.deliveryTruck();
        return;
      }
      case 'unhappy': {
        this.fx.popIcon(tileCenter(e.x, e.y), 'ui:angry', 26);
        return;
      }
      case 'vipArrived': {
        const { w } = this.size;
        this.fx.popIcon(tileCenter(w - 1, sidewalkY(s)), 'ui:crown', 30);
        return;
      }
      case 'levelUp':
        this.fx.confetti();
        return;
      case 'thiefCaught': {
        const p = tileCenter(e.x, e.y);
        this.fx.popIcon(p, 'ui:siren', 30);
        this.fx.floatText({ x: p.x, y: p.y - 60 }, `¡Atrapado! +${e.reward}`, '#ffd166', 15);
        return;
      }
      case 'criticHappy': {
        const p = tileCenter(e.x, e.y);
        for (let i = 0; i < 5; i++) this.fx.popIcon({ x: p.x + (i - 2) * 16, y: p.y - 10 }, 'ui:star', 22, i * 90);
        return;
      }
    }
  }
}
