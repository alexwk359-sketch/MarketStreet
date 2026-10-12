// Ambiente: lluvia, nieve, calor y la luz según la hora del día (con farolas y escaparate
// iluminados por la noche). Solo es visual: los efectos en la clientela están en sim/world.ts.
import Phaser from 'phaser';
import type { GameState } from '../sim/state';
import { darkness, dayPhase, weatherOf } from '../sim/world';
import { FX_DEPTH, tileCenter } from './draw';
import type { Point } from './iso';
import { settings } from './settings';

const OVERLAY_DEPTH = FX_DEPTH - 3;
const GLOW_DEPTH = FX_DEPTH - 2;
const PARTICLE_DEPTH = FX_DEPTH - 1;

export class Atmosphere {
  private overlay: Phaser.GameObjects.Rectangle;
  private warm: Phaser.GameObjects.Rectangle;
  private rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow: Phaser.GameObjects.Particles.ParticleEmitter;
  private zone = new Phaser.Geom.Rectangle(0, 0, 1, 1);
  private lamps: Phaser.GameObjects.Image[] = [];
  private ceiling: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene) {
    makeTextures(scene);
    // Filtro multiplicativo para oscurecer o enfriar la escena, y otro aditivo para el calor.
    this.overlay = scene.add.rectangle(0, 0, 1, 1, 0xffffff, 0).setOrigin(0).setDepth(OVERLAY_DEPTH);
    this.overlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.warm = scene.add.rectangle(0, 0, 1, 1, 0xff9f1c, 0).setOrigin(0).setDepth(OVERLAY_DEPTH);
    this.warm.setBlendMode(Phaser.BlendModes.ADD);

    // Las gotas nacen por toda la vista de la cámara (la zona se actualiza cada frame).
    const emitZone = { type: 'random', source: this.zone } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData;
    this.rain = scene.add.particles(0, 0, 'fx:drop', {
      emitZone,
      lifespan: 700,
      speedY: { min: 520, max: 640 },
      speedX: { min: -140, max: -110 },
      rotate: 12,
      alpha: { start: 0.55, end: 0.2 },
      quantity: 6,
      frequency: 30,
      emitting: false,
    });
    this.snow = scene.add.particles(0, 0, 'fx:flake', {
      emitZone,
      lifespan: 5000,
      speedY: { min: 25, max: 55 },
      speedX: { min: -25, max: 25 },
      scale: { min: 0.4, max: 1 },
      alpha: { start: 0.95, end: 0.4 },
      quantity: 2,
      frequency: 60,
      emitting: false,
    });
    this.rain.setDepth(PARTICLE_DEPTH);
    this.snow.setDepth(PARTICLE_DEPTH);
  }

  /** Luces que se encienden de noche: farolas y el interior de la tienda. */
  setLights(lamps: Point[], store: { w: number; h: number }) {
    [...this.lamps, ...this.ceiling].forEach((g) => g.destroy());
    this.lamps = lamps.map((p) =>
      this.scene.add.image(p.x, p.y, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setTint(0xffc65c).setDepth(GLOW_DEPTH),
    );
    // Luz cálida y suave repartida por la tienda, para que se vea iluminada desde la calle.
    this.ceiling = [];
    for (let y = 1; y < store.h; y += 3) {
      for (let x = 1; x < store.w; x += 3) {
        const c = tileCenter(x + 0.5, y + 0.5);
        this.ceiling.push(this.scene.add.image(c.x, c.y, 'fx:glow').setBlendMode(Phaser.BlendModes.ADD).setScale(3, 1.6).setTint(0xffb35c).setDepth(GLOW_DEPTH));
      }
    }
  }

  update(state: GameState) {
    const view = this.scene.cameras.main.worldView;
    const margin = 200;
    for (const r of [this.overlay, this.warm]) r.setPosition(view.x - margin, view.y - margin).setSize(view.width + margin * 2, view.height + margin * 2);
    this.zone.setTo(view.x - 100, view.y - 150, view.width + 200, view.height + 150);

    const weather = settings.weatherFx ? weatherOf(state).kind : 'sunny';
    const dark = settings.dayNightFx ? darkness(state.time) : 0;
    const phase = settings.dayNightFx ? dayPhase(state.time) : 0.3;
    // Atardecer anaranjado alrededor de 0,6-0,7 del día.
    const dusk = Math.max(0, 1 - Math.abs(phase - 0.64) / 0.08);

    // Mezcla de colores del filtro: nubes grises, atardecer naranja y noche azulada.
    let rgb = [255, 255, 255];
    let alpha = 0;
    const mix = (hex: number, amount: number) => {
      if (amount <= 0) return;
      const target = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
      rgb = rgb.map((v, i) => v + (target[i] - v) * amount);
      alpha = Math.max(alpha, amount);
    };
    if (weather === 'cloudy') mix(0xc9d1dc, 0.35);
    if (weather === 'rain') mix(0x9aa6bb, 0.55);
    if (weather === 'snow') mix(0xdbe6f5, 0.4);
    mix(0xffb37a, dusk * 0.5);
    mix(0x3b4a8f, dark * 0.75);
    const [r, g, b] = rgb.map(Math.round);
    this.overlay.setFillStyle((r << 16) | (g << 8) | b, alpha);
    this.warm.setFillStyle(0xff9f1c, weather === 'heat' ? 0.07 : 0);

    this.rain.emitting = weather === 'rain';
    this.snow.emitting = weather === 'snow';
    for (const g of this.lamps) g.setAlpha(dark * 0.7);
    for (const g of this.ceiling) g.setAlpha(dark * 0.12);
  }
}

function makeTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('fx:drop')) {
    scene.make.graphics({}, false).fillStyle(0xdbeafe).fillRect(0, 0, 2, 14).generateTexture('fx:drop', 2, 14).destroy();
  }
  if (!scene.textures.exists('fx:flake')) {
    scene.make.graphics({}, false).fillStyle(0xffffff).fillCircle(4, 4, 4).generateTexture('fx:flake', 8, 8).destroy();
  }
  if (!scene.textures.exists('fx:glow')) {
    const size = 64;
    const canvas = scene.textures.createCanvas('fx:glow', size, size)!;
    const ctx = canvas.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
