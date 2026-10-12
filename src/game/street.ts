// La calle de fuera: acera, calzada, árboles, farolas, peatones y tráfico.
// Es pura ambientación: no forma parte de la simulación.
import Phaser from 'phaser';
import type { Point } from './iso';
import { at, box, diamond, FONT, raise, TEXT_RESOLUTION, tileCenter } from './draw';
import { CHARACTER_SHEETS, STREET_VEHICLES, characterKey } from './sprites';

interface Walker {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  speed: number;
  stride: number;
  /** Segundos de parada restantes (0 = aún no ha parado, -1 = ya paró o no para). */
  until: number;
  vehicle: boolean;
  /** Dónde para el camión de reparto. */
  stopX?: number;
}

/** Hojas de peatones, repetidas según lo frecuentes que son. */
const PEDESTRIAN_SHEETS: (keyof typeof CHARACTER_SHEETS)[] = ['customer', 'customer', 'customer', 'kid', 'senior', 'tourist'];

const EXTRA = 5; // casillas de calle a cada lado de la tienda
export const SIDEWALK_DEPTH = 1.2;
const ROAD_FROM = 1.35;
const ROAD_TO = 3.2;

export class Street {
  private ground: Phaser.GameObjects.Graphics;
  private props: Phaser.GameObjects.Container;
  private walkers: Walker[] = [];
  /** Dónde están las bombillas de las farolas (para iluminarlas de noche). */
  lampHeads: Point[] = [];
  private spawnPeople = 1;
  private spawnCars = 2;
  private w = 0;
  private h = 0;

  constructor(private scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(-3);
    this.props = scene.add.container(0, 0);
  }

  /** Redibuja la calle para una tienda de w×h casillas. */
  layout(w: number, h: number) {
    this.w = w;
    this.h = h;
    const g = this.ground.clear();
    // Césped alrededor, acera y calzada con líneas.
    diamond(g, -EXTRA, -2, w + 3, h + ROAD_TO + 2, 0x95d5b2);
    diamond(g, -EXTRA, h, w + EXTRA, h + SIDEWALK_DEPTH, 0xd6d6d6);
    for (let x = -EXTRA; x < w + EXTRA; x++) diamond(g, x, h, x + 0.96, h + SIDEWALK_DEPTH - 0.04, 0xe3e3e3);
    diamond(g, -EXTRA, h + SIDEWALK_DEPTH, w + EXTRA, h + ROAD_FROM, 0xadb5bd);
    diamond(g, -EXTRA, h + ROAD_FROM, w + EXTRA, h + ROAD_TO, 0x5c636a);
    const mid = h + (ROAD_FROM + ROAD_TO) / 2;
    for (let x = -EXTRA; x < w + EXTRA; x += 1.2) diamond(g, x, mid - 0.04, x + 0.6, mid + 0.04, 0xf8f9fa);
    // Paso de cebra frente a la puerta.
    for (let i = 0; i < 5; i++) diamond(g, w - 1.4 + i * 0.36, h + ROAD_FROM + 0.1, w - 1.22 + i * 0.36, h + ROAD_TO - 0.1, 0xf1f3f5);

    this.props.removeAll(true);
    this.lampHeads = [];
    const trees = [-3.8, w + 1.5, w + 3.5];
    for (const tx of trees) this.addTree(tx, h + 0.55, tx < 0 ? 'pine' : 'tree');
    for (let y = 1; y < h; y += 3) this.addTree(w + 1.6, y, y % 2 ? 'tree' : 'pine');
    for (const lx of [-0.5, w * 0.45]) this.addLamp(lx, h + 1);
    this.addSign(h);
  }

  private addTree(x: number, y: number, kind: 'tree' | 'pine') {
    const p = tileCenter(x, y);
    const shadow = this.scene.add.graphics().fillStyle(0x000000, 0.15).fillEllipse(p.x, p.y, 40, 14);
    const img = this.scene.add.image(p.x, p.y + 4, `street:${kind}`).setOrigin(0.5, 1).setDisplaySize(64, 64);
    const c = this.scene.add.container(0, 0, [shadow, img]).setDepth(x + y + 1);
    // Balanceo suave con el viento.
    this.scene.tweens.add({ targets: img, angle: { from: -1.5, to: 1.5 }, duration: 2200 + Math.random() * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.props.add(c);
  }

  private addLamp(x: number, y: number) {
    const p = at(x, y);
    const g = this.scene.add.graphics();
    g.fillStyle(0x343a40).fillRect(p.x - 1.5, p.y - 58, 3, 58);
    g.fillStyle(0x343a40).fillRoundedRect(p.x - 7, p.y - 64, 14, 8, 3);
    g.fillStyle(0xffe066, 0.9).fillCircle(p.x, p.y - 54, 4);
    this.lampHeads.push({ x: p.x, y: p.y - 54 });
    this.props.add(this.scene.add.container(0, 0, [g]).setDepth(x + y + 1));
  }

  /** Cartel de la tienda junto a la puerta. */
  private addSign(h: number) {
    // En la acera, junto a la esquina izquierda de la tienda, para no tapar el interior.
    const p = tileCenter(-1.3, h + 0.15);
    const g = this.scene.add.graphics();
    g.fillStyle(0x5c4033).fillRect(p.x - 2, p.y - 46, 4, 46);
    g.fillStyle(0xe76f51).fillRoundedRect(p.x - 60, p.y - 74, 120, 30, 8);
    g.lineStyle(2, 0xffffff).strokeRoundedRect(p.x - 57, p.y - 71, 114, 24, 6);
    const t = this.scene.add
      .text(p.x, p.y - 59, 'MARKET STREET', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#fff', resolution: TEXT_RESOLUTION })
      .setOrigin(0.5);
    this.props.add(this.scene.add.container(0, 0, [g, t]).setDepth(h + 1));
  }

  update(dt: number) {
    if (this.w === 0) return;
    this.spawnPeople -= dt;
    this.spawnCars -= dt;
    if (this.spawnPeople <= 0) {
      this.spawnPeople = 2.5 + Math.random() * 3;
      this.addWalker(false);
    }
    if (this.spawnCars <= 0) {
      this.spawnCars = 3 + Math.random() * 5;
      this.addWalker(true);
    }
    for (const w of [...this.walkers]) this.moveWalker(w, dt);
  }

  /** El camión de reparto cruza la calle y para un momento frente a la puerta. */
  deliveryTruck() {
    this.addWalker(true, 'ui:truck', true);
  }

  private addWalker(vehicle: boolean, texture?: string, stopAtDoor = false) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = vehicle
      ? this.h + (dir > 0 ? ROAD_FROM + 0.5 : ROAD_TO - 0.5)
      : this.h + 0.65 + Math.random() * 0.35;
    const x = dir > 0 ? -EXTRA : this.w + EXTRA;
    let sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    if (vehicle) {
      const key = texture ?? `street:${Phaser.Utils.Array.GetRandom(STREET_VEHICLES)}`;
      // Los vehículos de Fluent miran a la izquierda: al ir hacia +x (abajo a la derecha) se voltean.
      sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.92).setDisplaySize(54, 54).setFlipX(dir > 0);
    } else {
      // Peatones: hacia +x caminan de frente; hacia -x, de espaldas y volteados.
      // Por la calle pasa de todo: adultos, niños, abuelos y turistas.
      const sheet = Phaser.Utils.Array.GetRandom(PEDESTRIAN_SHEETS);
      const key = characterKey(sheet, Phaser.Math.Between(0, CHARACTER_SHEETS[sheet] - 1));
      sprite = this.scene.add.sprite(0, 0, key).setOrigin(0.5, 0.9).setScale(0.5).setFlipX(dir < 0);
      (sprite as Phaser.GameObjects.Sprite).play(`${key}:walk-${dir > 0 ? 'front' : 'back'}`);
    }
    sprite.setAlpha(0);
    const speed = (vehicle ? 3 + Math.random() * 2 : 0.8 + Math.random() * 0.5) * dir;
    this.walkers.push({ sprite, x, y, speed, stride: 0, until: stopAtDoor ? 0 : -1, vehicle, stopX: stopAtDoor ? this.w - 1 : undefined });
  }

  private moveWalker(w: Walker, dt: number) {
    if (w.stopX !== undefined && w.until === 0 && Math.abs(w.x - w.stopX) < 0.15) w.until = 1.2;
    if (w.until > 0) {
      w.until -= dt;
      if (w.until <= 0) w.until = -1;
    } else {
      w.x += w.speed * dt;
      w.stride += Math.abs(w.speed) * dt * 9;
    }
    const p = tileCenter(w.x, w.y);
    // Los coches traquetean un poco; los peatones ya tienen su animación de caminar.
    const bob = w.vehicle ? Math.abs(Math.sin(w.stride * 0.6)) * 0.8 : 0;
    w.sprite.setPosition(p.x, p.y - bob).setDepth(w.x + w.y + 0.5);
    // Aparecen y desaparecen en los extremos de la calle.
    const edge = Math.min(w.x + EXTRA, this.w + EXTRA - w.x);
    w.sprite.setAlpha(Phaser.Math.Clamp(edge / 1.2, 0, 1));
    if (w.x < -EXTRA - 0.1 || w.x > this.w + EXTRA + 0.1) {
      w.sprite.destroy();
      this.walkers = this.walkers.filter((o) => o !== w);
    }
  }

  /** Fachada baja de la tienda (los lados que dan a la calle), con hueco en la puerta. */
  static drawFrontWalls(g: Phaser.GameObjects.Graphics, w: number, h: number, color: number) {
    const H = 9;
    for (let x = 0; x < w - 1; x++) {
      const a = at(x, h);
      const b = at(x + 1, h);
      g.fillStyle(color).fillPoints([a, b, raise(b, H), raise(a, H)], true);
    }
    for (let y = 0; y < h; y++) {
      const a = at(w, y);
      const b = at(w, y + 1);
      g.fillStyle(color, 0.85).fillPoints([a, b, raise(b, H), raise(a, H)], true);
    }
    // Felpudo en la puerta.
    box(g, w - 1, h - 1, 1, 0x8d6e63, 0.18);
  }
}
