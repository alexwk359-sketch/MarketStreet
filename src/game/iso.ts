export const TILE_W = 64;
export const TILE_H = 32;

export interface Point {
  x: number;
  y: number;
}

/** Coordenadas de cuadrícula (x, y) → píxeles en pantalla. */
export const isoToScreen = (x: number, y: number, origin: Point): Point => ({
  x: origin.x + ((x - y) * TILE_W) / 2,
  y: origin.y + ((x + y) * TILE_H) / 2,
});

export function screenToIso(sx: number, sy: number, origin: Point): Point {
  const dx = (sx - origin.x) / (TILE_W / 2);
  const dy = (sy - origin.y) / (TILE_H / 2);
  return { x: (dy + dx) / 2, y: (dy - dx) / 2 };
}

/** Multiplica cada canal RGB por `factor` (0-1 oscurece, >1 aclara). */
export function shade(color: number, factor: number): number {
  const c = (shift: number) => Math.min(255, Math.round(((color >> shift) & 0xff) * factor));
  return (c(16) << 16) | (c(8) << 8) | c(0);
}
