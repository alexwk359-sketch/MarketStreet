// Efectos efímeros: monedas, productos que vuelan, cajas que caen, confeti...
import Phaser from 'phaser';
import { FONT, FX_DEPTH, TEXT_RESOLUTION } from './draw';
import type { Point } from './iso';

const CONFETTI_COLORS = [0xe76f51, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x4d96ff, 0xc77dff];

export class Effects {
  constructor(private scene: Phaser.Scene) {
    // Textura de confeti generada al vuelo: un rectángulo blanco que se tiñe.
    if (!scene.textures.exists('fx:confetti')) {
      scene.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 6, 10).generateTexture('fx:confetti', 6, 10).destroy();
    }
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    return this.scene.tweens.add(config);
  }

  private image(p: Point, key: string, size: number) {
    return this.scene.add.image(p.x, p.y, key).setDisplaySize(size, size).setDepth(FX_DEPTH);
  }

  /** Un producto vuela en arco de `from` a `to`. */
  flyItem(from: Point, to: Point, key: string) {
    const img = this.image(from, key, 22);
    const scale = img.scale;
    const peak = Math.min(from.y, to.y) - 30;
    this.tween({ targets: img, x: to.x, duration: 450, ease: 'Sine.easeInOut' });
    this.tween({ targets: img, y: peak, duration: 200, ease: 'Quad.easeOut' });
    this.tween({ targets: img, y: to.y, scale: scale * 0.6, delay: 200, duration: 250, ease: 'Quad.easeIn', onComplete: () => img.destroy() });
  }

  /** Monedas (y propina o diamante) que saltan de la caja. */
  sale(at: Point, amount: number, tip: number, gem: boolean, vip: boolean) {
    const coins = Math.min(6, 1 + Math.floor(amount / 10));
    for (let i = 0; i < coins; i++) {
      const coin = this.image(at, 'ui:coin', 16);
      this.tween({ targets: coin, x: at.x + Phaser.Math.Between(-30, 30), duration: 650, delay: i * 50 });
      this.tween({
        targets: coin,
        y: { from: at.y, to: at.y - 40 - Phaser.Math.Between(0, 25) },
        alpha: { from: 1, to: 0 },
        angle: Phaser.Math.Between(-180, 180),
        duration: 650,
        delay: i * 50,
        ease: 'Quad.easeOut',
        onComplete: () => coin.destroy(),
      });
    }
    this.floatText({ x: at.x, y: at.y - 28 }, `+${amount}`, vip ? '#ffd60a' : '#ffd166', vip ? 20 : 16);
    if (tip > 0) {
      this.floatText({ x: at.x + 26, y: at.y - 8 }, `+${tip} propina`, '#ff8fab', 12, 250);
      this.popIcon({ x: at.x - 24, y: at.y + 10 }, 'ui:love', 24);
    }
    if (gem) this.popIcon({ x: at.x, y: at.y }, 'ui:gem', 30, 200);
  }

  /** Una caja cae rebotando y se abre con destellos. */
  delivered(land: Point) {
    const box = this.image({ x: land.x, y: land.y - 120 }, 'ui:package', 30).setOrigin(0.5, 1);
    this.tween({
      targets: box,
      y: land.y,
      duration: 600,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.popIcon({ x: land.x, y: land.y + 20 }, 'ui:sparkles', 30);
        this.tween({ targets: box, alpha: 0, scale: box.scale * 1.3, duration: 250, onComplete: () => box.destroy() });
      },
    });
  }

  /** Icono que aparece, sube y se desvanece. */
  popIcon(p: Point, key: string, size: number, delay = 0) {
    const img = this.image({ x: p.x, y: p.y - 40 }, key, size).setAlpha(0);
    const scale = img.scale;
    this.tween({
      targets: img,
      alpha: { from: 1, to: 0 },
      y: p.y - 85,
      scale: { from: scale * 0.4, to: scale * 1.1 },
      duration: 1100,
      delay,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  floatText(p: Point, text: string, color: string, size = 16, delay = 0) {
    const t = this.scene.add
      .text(p.x, p.y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#3d2b1f',
        strokeThickness: 4,
        resolution: TEXT_RESOLUTION,
      })
      .setOrigin(0.5)
      .setDepth(FX_DEPTH)
      .setAlpha(0);
    this.tween({ targets: t, alpha: { from: 1, to: 0 }, y: p.y - 40, duration: 1200, delay, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  /** Lluvia de confeti sobre la vista actual de la cámara. */
  confetti() {
    const view = this.scene.cameras.main.worldView;
    for (let i = 0; i < 70; i++) {
      const piece = this.scene.add
        .image(view.x + Math.random() * view.width, view.y - 20 - Math.random() * 100, 'fx:confetti')
        .setTint(Phaser.Utils.Array.GetRandom(CONFETTI_COLORS))
        .setDepth(FX_DEPTH + 1)
        .setAngle(Math.random() * 360);
      this.tween({
        targets: piece,
        y: view.y + view.height + 20,
        x: piece.x + Phaser.Math.Between(-80, 80),
        angle: piece.angle + Phaser.Math.Between(180, 720),
        duration: 1800 + Math.random() * 1400,
        delay: Math.random() * 400,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }
}
