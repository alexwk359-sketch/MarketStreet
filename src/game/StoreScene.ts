import Phaser from 'phaser';
import { DECOR, DISPLAYS, itemById } from '../sim/catalog';
import { available, isTileFree } from '../sim/sim';
import { GRID_H, GRID_W, REGISTER, type Customer, type Display, type PlacedDecor } from '../sim/state';
import type { Controller } from './controller';
import { formatTime } from './format';
import { TILE_H, isoToScreen, screenToIso, shade, type Point } from './iso';

const EMOJI_FONT = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const WALL_HEIGHT = 70;
// El texto se rasteriza a más resolución para que siga nítido con zoom.
const TEXT_RESOLUTION = Math.min(4, (window.devicePixelRatio || 1) * 2);
const DISPLAY_HEIGHT = 24;
const SHIRT_COLORS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x8e7dbe, 0x4d96ff, 0xf28482, 0x6a994e];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

interface Sprite {
  container: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
}

export class StoreScene extends Phaser.Scene {
  private controller!: Controller;
  private origin: Point = { x: 0, y: 0 };
  private floor!: Phaser.GameObjects.Graphics;
  private sprites = new Map<string, Sprite>();
  private hover: Point | null = null;

  constructor() {
    super('store');
  }

  init(data: { controller: Controller }) {
    this.controller = data.controller;
  }

  create() {
    this.floor = this.add.graphics().setDepth(-1);
    this.layout();
    this.scale.on('resize', () => this.layout());

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hover = this.tileAt(p.worldX, p.worldY);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  update(_time: number, delta: number) {
    this.controller.update(delta, Date.now());
    for (const e of this.controller.consumeEvents()) {
      if (e.type === 'sale') this.floatText(e.x, e.y, `+${e.amount} 🪙`, '#ffd166');
      if (e.type === 'unhappy') this.floatText(e.x, e.y, '😠', '#ffffff');
    }
    this.draw();
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

  /** Los expositores sobresalen del suelo: se pueden tocar por su caja, no solo por su casilla. */
  private displayAt(sx: number, sy: number): Display | null {
    const hits = this.controller.state.displays.filter((d) => {
      const c = this.tileCenter(d.x, d.y);
      return Math.abs(sx - c.x) < 26 && sy > c.y - DISPLAY_HEIGHT - TILE_H / 2 && sy < c.y + TILE_H / 2;
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
  // Dibujo
  // -------------------------------------------------------------------------

  private tileCenter(x: number, y: number): Point {
    return isoToScreen(x + 0.5, y + 0.5, this.origin);
  }

  private draw() {
    this.drawFloor();
    const state = this.controller.state;
    const live = new Set<string>();
    const sprite = (key: string, depth: number) => {
      live.add(key);
      const s = this.sprites.get(key) ?? this.createSprite(key);
      s.container.setDepth(depth);
      s.g.clear();
      return s;
    };

    this.drawRegister(sprite('register', REGISTER.x + REGISTER.y));
    // La alfombra es plana: siempre por debajo de muebles y clientes.
    for (const d of state.decor) this.drawDecor(sprite(`decor:${d.id}`, d.decorId === 'rug' ? -0.5 : d.x + d.y), d);
    for (const d of state.displays) this.drawDisplay(sprite(`display:${d.id}`, d.x + d.y), d);
    // Los clientes se ordenan con la misma regla para pasar por delante o por detrás de los muebles.
    for (const c of state.customers) this.drawCustomer(sprite(`customer:${c.id}`, c.x + c.y + 0.6), c);

    for (const [key, s] of this.sprites) {
      if (live.has(key)) continue;
      s.container.destroy();
      this.sprites.delete(key);
    }
  }

  private createSprite(key: string): Sprite {
    const g = this.add.graphics();
    const textStyle = { fontFamily: EMOJI_FONT, resolution: TEXT_RESOLUTION };
    const icon = this.add.text(0, 0, '', { ...textStyle, fontSize: '22px' }).setOrigin(0.5, 1);
    const label = this.add
      .text(0, 0, '', { ...textStyle, fontSize: '12px', color: '#fff', fontStyle: 'bold', padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 1);
    const container = this.add.container(0, 0, [g, icon, label]);
    const sprite = { container, g, icon, label };
    this.sprites.set(key, sprite);
    return sprite;
  }

  private drawFloor() {
    const g = this.floor;
    g.clear();
    const o = this.origin;
    const at = (x: number, y: number) => isoToScreen(x, y, o);
    const up = (p: Point, h: number) => ({ x: p.x, y: p.y - h });

    // Paredes del fondo.
    const corner = at(0, 0);
    const right = at(GRID_W, 0);
    const left = at(0, GRID_H);
    g.fillStyle(0xf4e1c1).fillPoints([corner, right, up(right, WALL_HEIGHT), up(corner, WALL_HEIGHT)], true);
    g.fillStyle(0xe8cfa6).fillPoints([corner, left, up(left, WALL_HEIGHT), up(corner, WALL_HEIGHT)], true);
    g.fillStyle(0x9c6644).fillRect(corner.x - 1, corner.y - WALL_HEIGHT, 2, WALL_HEIGHT);

    // Suelo en damero, con la puerta y la casilla bajo el cursor resaltadas.
    const c = this.controller;
    const placing = c.mode.type !== 'idle';
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        let color = (x + y) % 2 === 0 ? 0xfaf3e3 : 0xefe4cc;
        if (x === GRID_W - 1 && y === GRID_H - 1) color = 0x8fbc8f;
        if (placing && this.hover?.x === x && this.hover.y === y) {
          color = isTileFree(c.state, x, y) ? 0x90ee90 : 0xf08080;
        }
        g.fillStyle(color).fillPoints([at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)], true);
      }
    }
    g.lineStyle(2, 0x9c6644).strokePoints([corner, right, at(GRID_W, GRID_H), left], true);
  }

  /** Caja isométrica sobre la casilla (x, y), con margen `inset` (en casillas). */
  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, height: number, color: number, inset = 0.12) {
    const at = (ix: number, iy: number) => isoToScreen(ix, iy, this.origin);
    const top = at(x + inset, y + inset);
    const right = at(x + 1 - inset, y + inset);
    const bottom = at(x + 1 - inset, y + 1 - inset);
    const left = at(x + inset, y + 1 - inset);
    const up = (p: Point) => ({ x: p.x, y: p.y - height });
    g.fillStyle(shade(color, 0.8)).fillPoints([left, bottom, up(bottom), up(left)], true);
    g.fillStyle(shade(color, 0.62)).fillPoints([bottom, right, up(right), up(bottom)], true);
    g.fillStyle(color).fillPoints([up(top), up(right), up(bottom), up(left)], true);
    return [up(top), up(right), up(bottom), up(left)];
  }

  private drawRegister(s: Sprite) {
    this.box(s.g, REGISTER.x, REGISTER.y, 26, 0x5c4033);
    const c = this.tileCenter(REGISTER.x, REGISTER.y);
    s.icon.setText('💰').setPosition(c.x, c.y - 30);
    s.label.setText('');
  }

  private drawDecor(s: Sprite, d: PlacedDecor) {
    const def = DECOR.find((x) => x.id === d.decorId)!;
    const c = this.tileCenter(d.x, d.y);
    if (def.id === 'rug') {
      this.box(s.g, d.x, d.y, 2, 0xc1121f, 0.05);
      s.icon.setText('');
    } else {
      this.box(s.g, d.x, d.y, 6, 0x8d6e63, 0.3);
      s.icon.setText(def.icon).setFontSize(def.id === 'plant' ? 30 : 24).setPosition(c.x, c.y - 2);
    }
    s.label.setText('');
  }

  private drawDisplay(s: Sprite, d: Display) {
    const def = DISPLAYS[d.kind];
    const topFace = this.box(s.g, d.x, d.y, DISPLAY_HEIGHT, def.color);
    const c = this.tileCenter(d.x, d.y);
    const selected = typeof this.controller.panel === 'object' && this.controller.panel?.displayId === d.id;
    if (selected) s.g.lineStyle(3, 0xffd166).strokePoints(topFace, true);

    // Barra de stock en el frente del mueble.
    const fill = d.stock / def.capacity;
    s.g.fillStyle(0x000000, 0.35).fillRect(c.x - 18, c.y - 6, 36, 5);
    s.g.fillStyle(fill > 0.25 ? 0x52b788 : 0xf4a261).fillRect(c.x - 18, c.y - 6, 36 * fill, 5);

    const icon = d.itemId ? itemById(d.itemId).icon : def.icon;
    s.icon.setText(icon).setPosition(c.x, c.y - DISPLAY_HEIGHT - 6).setAlpha(d.stock > 0 ? 1 : 0.35);

    let text = `x${available(d)}`;
    let bg = '#2d6a4f';
    if (d.order) {
      text = `🚚 ${formatTime(d.order.readyAt - this.controller.state.time)}`;
      bg = '#1d3557';
    } else if (d.stock === 0) {
      text = '¡Vacío!';
      bg = '#c1121f';
    }
    s.label.setText(text).setBackgroundColor(bg).setPosition(c.x, c.y - DISPLAY_HEIGHT - 32);
  }

  private drawCustomer(s: Sprite, c: Customer) {
    const p = isoToScreen(c.x + 0.5, c.y + 0.5, this.origin);
    const g = s.g;
    g.fillStyle(0x000000, 0.18).fillEllipse(p.x, p.y, 20, 8);
    g.fillStyle(SHIRT_COLORS[c.look % SHIRT_COLORS.length]).fillRoundedRect(p.x - 7, p.y - 26, 14, 22, 5);
    g.fillStyle(SKIN_COLORS[c.look % SKIN_COLORS.length]).fillCircle(p.x, p.y - 31, 7);

    let bubble = '';
    if (c.state === 'toDisplay' || c.state === 'lost') bubble = c.state === 'lost' && c.x === c.tx ? '❓' : itemById(c.itemId).icon;
    if (c.carrying) bubble = `🛍️`;
    s.icon.setText(bubble).setFontSize(16).setPosition(p.x, p.y - 40);
    s.label.setText('');
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const p = isoToScreen(x + 0.5, y + 0.5, this.origin);
    const t = this.add
      .text(p.x, p.y - 50, text, {
        fontFamily: EMOJI_FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color,
        stroke: '#000',
        strokeThickness: 3,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
      .setDepth(1000);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }
}

