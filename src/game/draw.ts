import type Phaser from 'phaser';
import { isoToScreen, shade, type Point } from './iso';

/** La cuadrícula tiene el origen fijo en (0, 0): el zoom y el encuadre los hace la cámara. */
const ORIGIN = { x: 0, y: 0 };

export const at = (x: number, y: number): Point => isoToScreen(x, y, ORIGIN);
export const tileCenter = (x: number, y: number): Point => at(x + 0.5, y + 0.5);
export const raise = (p: Point, h: number): Point => ({ x: p.x, y: p.y - h });

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// El texto se rasteriza a más resolución para que siga nítido con zoom.
export const TEXT_RESOLUTION = Math.min(4, (window.devicePixelRatio || 1) * 2);
export const FX_DEPTH = 1000;

/** Rombo de suelo entre (x0, y0) y (x1, y1) en coordenadas de cuadrícula. */
export function diamond(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha).fillPoints([at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)], true);
}

/** Caja isométrica sobre la casilla (x, y); devuelve las esquinas de la cara superior. */
export function box(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  height: number,
  color: number,
  inset = 0.12,
  lift = 0,
  alpha = 1,
): Point[] {
  const top = raise(at(x + inset, y + inset), lift);
  const right = raise(at(x + 1 - inset, y + inset), lift);
  const bottom = raise(at(x + 1 - inset, y + 1 - inset), lift);
  const left = raise(at(x + inset, y + 1 - inset), lift);
  g.fillStyle(shade(color, 0.8), alpha).fillPoints([left, bottom, raise(bottom, height), raise(left, height)], true);
  g.fillStyle(shade(color, 0.62), alpha).fillPoints([bottom, right, raise(right, height), raise(bottom, height)], true);
  const face = [top, right, bottom, left].map((p) => raise(p, height));
  g.fillStyle(color, alpha).fillPoints(face, true);
  return face;
}
