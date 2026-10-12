// Personajes 3D estilo "chibi" para clientes, peatones y cajeros.
// Cada personaje se monta con piezas articuladas (cadera, hombros) para poder posarlo
// fotograma a fotograma y generar hojas de sprites animadas.
// Unidades: 1 = una casilla; los pies están en y = 0 y el personaje mira hacia +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...opts });

const SKINS = [0xffdfc4, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21];
const HAIRS = [0x2b1d14, 0x4a2c1a, 0x8b4513, 0xd9a066, 0x111111, 0xb7410e, 0xa0a0a0, 0xf2d16b];
const TOPS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0x8338ec, 0xff006e, 0x06d6a0, 0xf4a261, 0x264653, 0xffffff, 0x3a86ff, 0xd62828];
const BOTTOMS = [0x1d3557, 0x3d405b, 0x6c584c, 0x2b2d42, 0x588157, 0xbc6c25, 0x495057];
const SHOES = [0xf8f9fa, 0x212529, 0x7f5539, 0xe63946, 0x3a86ff];

const HAIR_STYLES = ['short', 'long', 'bun', 'ponytail', 'afro', 'spiky', 'bob', 'bald'];
const TOP_STYLES = ['tshirt', 'tshirt', 'hoodie', 'dress', 'jacket'];
const ACCESSORIES = ['none', 'none', 'glasses', 'cap', 'beanie', 'backpack', 'glasses', 'none'];

/** Generador aleatorio con semilla: los personajes salen siempre iguales. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, list) => list[Math.floor(r() * list.length)];

/** Aspecto de un cliente a partir de una semilla. */
export function customerSpec(seed) {
  const r = rng(seed * 7919 + 13);
  const top = pick(r, TOP_STYLES);
  return {
    skin: pick(r, SKINS),
    hair: pick(r, HAIRS),
    hairStyle: pick(r, HAIR_STYLES),
    top,
    topColor: pick(r, TOPS),
    trim: pick(r, TOPS),
    bottom: top === 'dress' ? 'none' : pick(r, ['pants', 'pants', 'shorts', 'skirt']),
    bottomColor: pick(r, BOTTOMS),
    shoes: pick(r, SHOES),
    accessory: pick(r, ACCESSORIES),
    accessoryColor: pick(r, TOPS),
    height: 0.94 + r() * 0.12,
  };
}

/** Cajeros: uniforme de la tienda (polo rojo, delantal verde, gorra) con distinto pelo y piel. */
export function cashierSpec(seed) {
  const r = rng(seed * 104729 + 7);
  return {
    skin: SKINS[seed % SKINS.length],
    hair: pick(r, HAIRS),
    hairStyle: ['short', 'ponytail', 'bob', 'bun'][seed % 4],
    top: 'polo',
    topColor: 0xe63946,
    trim: 0xffffff,
    bottom: 'pants',
    bottomColor: 0x2b2d42,
    shoes: 0x212529,
    accessory: 'cap',
    accessoryColor: 0xe63946,
    apron: true,
    height: 1,
  };
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function add(parent, geo, material, [x, y, z] = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const capsule = (radius, length) => new THREE.CapsuleGeometry(radius, length, 6, 14);
const rbox = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));

/** Casquete de pelo sobre la cabeza (`cover` = cuánto baja, en radianes desde arriba). */
function hairCap(head, radius, cover, material, tilt = -0.35) {
  const cap = add(head, new THREE.SphereGeometry(radius, 28, 18, 0, Math.PI * 2, 0, cover), material);
  cap.rotation.x = tilt;
  return cap;
}

function buildHair(head, spec, m) {
  const R = 0.172;
  switch (spec.hairStyle) {
    case 'short':
      hairCap(head, R + 0.012, 1.25, m.hair);
      break;
    case 'spiky':
      hairCap(head, R + 0.01, 1.2, m.hair);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spike = add(head, new THREE.ConeGeometry(0.045, 0.1, 8), m.hair, [Math.cos(a) * 0.09, 0.16, Math.sin(a) * 0.09 - 0.02]);
        spike.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
      break;
    case 'long':
      hairCap(head, R + 0.014, 1.45, m.hair);
      add(head, rbox(0.32, 0.3, 0.1, 0.05), m.hair, [0, -0.08, -0.1]);
      break;
    case 'bob':
      hairCap(head, R + 0.016, 1.7, m.hair, -0.2);
      break;
    case 'bun':
      hairCap(head, R + 0.012, 1.3, m.hair);
      add(head, new THREE.SphereGeometry(0.07, 16, 12), m.hair, [0, 0.15, -0.1]);
      break;
    case 'ponytail': {
      hairCap(head, R + 0.012, 1.3, m.hair);
      const tail = add(head, capsule(0.045, 0.16), m.hair, [0, -0.02, -0.2]);
      tail.rotation.x = 0.35;
      break;
    }
    case 'afro':
      // Detrás y encima de la cabeza, para no tapar la cara.
      add(head, new THREE.SphereGeometry(0.215, 24, 18), m.hair, [0, 0.07, -0.085]);
      hairCap(head, 0.19, 1.0, m.hair, -0.5);
      break;
    default:
      break; // calvo
  }
}

function buildAccessory(head, torso, spec, m) {
  const acc = mat(spec.accessoryColor);
  switch (spec.accessory) {
    case 'glasses': {
      const frame = mat(0x212529, { roughness: 0.3 });
      for (const x of [-0.065, 0.065]) {
        const ring = add(head, new THREE.TorusGeometry(0.038, 0.009, 8, 20), frame, [x, 0.0, 0.165]);
        ring.scale.set(1, 0.85, 1);
      }
      add(head, rbox(0.04, 0.01, 0.01, 0.004), frame, [0, 0.005, 0.17]);
      break;
    }
    case 'cap':
      hairCap(head, 0.186, 1.15, acc, -0.25);
      add(head, rbox(0.2, 0.02, 0.14, 0.01), acc, [0, 0.09, 0.17]).rotation.x = 0.15;
      break;
    case 'beanie':
      hairCap(head, 0.19, 1.2, acc, -0.15);
      add(head, new THREE.SphereGeometry(0.04, 12, 10), mat(0xffffff), [0, 0.2, -0.03]);
      break;
    case 'backpack':
      add(torso, rbox(0.24, 0.28, 0.1, 0.04), acc, [0, 0.02, -0.15]);
      break;
    default:
      break;
  }
}

/**
 * Monta el personaje con una pose:
 * - legL/legR: giro de cada pierna hacia delante (radianes)
 * - armL/armR: giro de cada brazo hacia delante; armLOut/armROut: hacia fuera
 * - bob: cuánto sube el cuerpo; lean: inclinación hacia delante; headTilt: cabeceo
 */
export function makeCharacter(spec, pose = {}) {
  const p = { legL: 0, legR: 0, armL: 0, armR: 0, armLOut: 0.08, armROut: 0.08, elbowL: 0, elbowR: 0, bob: 0, lean: 0, headTilt: 0, ...pose };
  const m = {
    skin: mat(spec.skin, { roughness: 0.55 }),
    hair: mat(spec.hair, { roughness: 0.8 }),
    top: mat(spec.topColor),
    trim: mat(spec.trim),
    bottom: mat(spec.bottomColor, { roughness: 0.8 }),
    shoes: mat(spec.shoes, { roughness: 0.5 }),
    dark: mat(0x1b1b1b, { roughness: 0.3 }),
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = p.bob;
  root.add(body);
  root.scale.setScalar(spec.height);

  // Piernas (el pivote es la cadera).
  const hipY = 0.4;
  const legMat = spec.bottom === 'shorts' || spec.bottom === 'skirt' || spec.bottom === 'none' ? m.skin : m.bottom;
  for (const [side, angle] of [[1, p.legL], [-1, p.legR]]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.075, hipY, 0);
    leg.rotation.x = -angle;
    body.add(leg);
    add(leg, capsule(0.055, 0.24), legMat, [0, -0.17, 0]);
    if (spec.bottom === 'shorts') add(leg, capsule(0.063, 0.06), m.bottom, [0, -0.05, 0]);
    add(leg, rbox(0.1, 0.065, 0.16, 0.03), m.shoes, [0, -0.365, 0.025]);
  }

  // Tronco, con la ropa.
  const torso = new THREE.Group();
  torso.position.y = hipY;
  torso.rotation.x = p.lean;
  body.add(torso);
  if (spec.bottom === 'pants' || spec.bottom === 'shorts') add(torso, rbox(0.28, 0.08, 0.18, 0.04), m.bottom, [0, 0.02, 0]);
  if (spec.bottom === 'skirt') add(torso, new THREE.ConeGeometry(0.19, 0.2, 20), m.bottom, [0, -0.04, 0]).rotation.x = Math.PI;
  if (spec.top === 'dress') {
    const skirt = add(torso, new THREE.CylinderGeometry(0.12, 0.22, 0.26, 22), m.top, [0, -0.06, 0]);
    skirt.castShadow = true;
  }
  add(torso, rbox(0.3, 0.32, 0.19, 0.07), m.top, [0, 0.19, 0]);
  if (spec.top === 'hoodie') {
    add(torso, rbox(0.26, 0.08, 0.07, 0.03), m.top, [0, 0.33, -0.1]);
    add(torso, rbox(0.16, 0.06, 0.02, 0.01), m.trim, [0, 0.12, 0.095]);
  }
  if (spec.top === 'jacket') {
    add(torso, rbox(0.06, 0.3, 0.02, 0.01), m.trim, [0, 0.19, 0.096]);
    add(torso, rbox(0.3, 0.04, 0.2, 0.02), m.top, [0, 0.03, 0]);
  }
  if (spec.top === 'polo' || spec.top === 'tshirt') add(torso, rbox(0.14, 0.03, 0.04, 0.01), m.trim, [0, 0.34, 0.07]);
  if (spec.apron) {
    add(torso, rbox(0.24, 0.36, 0.015, 0.01), mat(0x2d6a4f), [0, 0.1, 0.1]);
    add(torso, rbox(0.06, 0.035, 0.01, 0.005), mat(0xffffff), [0.06, 0.22, 0.11]); // chapa con el nombre
  }

  // Brazos (el pivote es el hombro).
  for (const [side, angle, out, elbow] of [[1, p.armL, p.armLOut, p.elbowL], [-1, p.armR, p.armROut, p.elbowR]]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.185, 0.33, 0);
    arm.rotation.set(-angle, 0, side * out);
    torso.add(arm);
    add(arm, capsule(0.048, 0.1), spec.top === 'dress' ? m.skin : m.top, [0, -0.07, 0]);
    const fore = new THREE.Group();
    fore.position.y = -0.15;
    fore.rotation.x = -elbow;
    arm.add(fore);
    add(fore, capsule(0.042, 0.1), m.skin, [0, -0.05, 0]);
    add(fore, new THREE.SphereGeometry(0.046, 14, 10), m.skin, [0, -0.13, 0]);
  }

  // Cabeza con cara, pelo y accesorios.
  add(torso, new THREE.CylinderGeometry(0.04, 0.045, 0.06, 12), m.skin, [0, 0.37, 0]);
  const head = new THREE.Group();
  head.position.y = 0.56;
  head.rotation.x = p.headTilt;
  // Cabeza grande, al estilo chibi, para que la cara se lea a tamaño de juego.
  head.scale.setScalar(1.12);
  torso.add(head);
  add(head, new THREE.SphereGeometry(0.172, 28, 20), m.skin).scale.set(1, 0.97, 0.95);
  for (const x of [-0.06, 0.06]) {
    add(head, new THREE.SphereGeometry(0.022, 10, 8), m.dark, [x, 0.0, 0.155]).scale.set(1, 1.3, 0.6);
    add(head, new THREE.SphereGeometry(0.022, 10, 8), mat(0xff8fa3, { transparent: true, opacity: 0.55 }), [x * 1.6, -0.05, 0.14]).scale.set(1.2, 0.7, 0.4);
  }
  add(head, rbox(0.05, 0.012, 0.01, 0.005), mat(0x9d4b4b), [0, -0.065, 0.158]);
  buildHair(head, spec, m);
  buildAccessory(head, torso, spec, m);
  return root;
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

export const WALK_FRAMES = 8;

/** Fotograma `f` del ciclo de caminar. */
export function walkPose(f) {
  const t = (f / WALK_FRAMES) * Math.PI * 2;
  const swing = Math.sin(t) * 0.55;
  return { legL: swing, legR: -swing, armL: -swing * 0.8, armR: swing * 0.8, elbowL: 0.25, elbowR: 0.25, bob: Math.abs(Math.cos(t)) * 0.025, lean: 0.06 };
}

export const IDLE_POSE = { armLOut: 0.12, armROut: 0.12 };
/** Mirando un estante: un brazo extendido hacia delante. */
export const REACH_POSE = { armR: 1.25, elbowR: 0.1, armL: 0.1, lean: 0.08, headTilt: 0.12 };

/** Poses del cajero detrás del mostrador. */
export const CASHIER_POSES = [
  { armL: 0.6, armR: 0.6, elbowL: 0.6, elbowR: 0.6 }, // reposo, manos sobre el mostrador
  { armL: 0.6, armR: 0.6, elbowL: 0.6, elbowR: 0.6, bob: 0.012, headTilt: 0.05 },
  { armL: 0.6, armR: 1.1, elbowL: 0.6, elbowR: 0.3, headTilt: 0.15 }, // escanear
  { armL: 0.6, armR: 0.9, elbowL: 0.6, elbowR: 0.8, armROut: 0.4, headTilt: 0.18 },
  { armL: 0.6, armR: 1.2, elbowL: 0.6, elbowR: 0.2, headTilt: 0.12 },
  { armL: 0.5, armR: 0.2, armROut: 2.5, elbowR: 0.5, elbowL: 0.6, headTilt: -0.05 }, // saludar
  { armL: 0.5, armR: 0.2, armROut: 2.2, elbowR: 0.9, elbowL: 0.6, headTilt: -0.05 },
];

export const CUSTOMER_VARIANTS = 24;
export const CASHIER_VARIANTS = 6;

/** Direcciones de las hojas: de frente (hacia +x, abajo a la derecha) y de espaldas (hacia -z, arriba a la derecha). */
export const DIRECTIONS = [Math.PI / 2, Math.PI];
