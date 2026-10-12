// Modelos 3D de los muebles de la tienda, hechos con piezas sencillas de three.js.
// Unidades: 1 = una casilla. El suelo es y = 0 y la casilla va de -0.5 a 0.5 en x y z.
// En el juego, +x es la diagonal hacia abajo a la derecha y +z hacia abajo a la izquierda.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...opts });
const metal = (color = 0xc9ccd1) => mat(color, { roughness: 0.25, metalness: 0.85 });

const M = {
  wood: mat(0x9c6644, { roughness: 0.7 }),
  woodLight: mat(0xd4a373, { roughness: 0.6 }),
  woodDark: mat(0x6f4518, { roughness: 0.7 }),
  counterTop: mat(0xf1ece4, { roughness: 0.3 }),
  white: mat(0xf8f9fa, { roughness: 0.4 }),
  charcoal: mat(0x2b2d42, { roughness: 0.5 }),
  grey: mat(0x6c757d, { roughness: 0.45 }),
  chrome: metal(),
  gold: metal(0xd4a72c),
  screen: mat(0x4cc9f0, { emissive: 0x2a9fd6, emissiveIntensity: 0.6, roughness: 0.2 }),
  paper: mat(0xffffff, { roughness: 0.9 }),
  kraft: mat(0xc8a27a, { roughness: 0.9 }),
  red: mat(0xe63946),
  teal: mat(0x2a9d8f),
  pink: mat(0xf4acb7, { roughness: 0.5 }),
  pinkDark: mat(0xe5989b, { roughness: 0.5 }),
  mirror: mat(0xbde0fe, { roughness: 0.08, metalness: 0.3, emissive: 0x5aa9e6, emissiveIntensity: 0.25 }),
  turf: mat(0x52b788, { roughness: 0.95 }),
  turfDark: mat(0x2d6a4f, { roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28 }),
  pegboard: mat(0xd9b99b, { roughness: 0.85 }),
  yellow: mat(0xffb703),
};

/** Caja con bordes redondeados apoyada en `y` (su base), centrada en x, z. */
function box(group, [w, h, d], [x, y, z], material, radius = 0.015) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Cilindro entre dos puntos. */
function rod(group, from, to, radius, material) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const geo = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 16);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function sphere(group, [x, y, z], radius, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

/** Caja registradora: mostrador de madera con terminal, cajón, impresora y datáfono. */
export function register() {
  const g = new THREE.Group();
  box(g, [0.86, 0.06, 0.66], [0, 0, 0], M.charcoal, 0.01); // zócalo
  box(g, [0.84, 0.46, 0.64], [0, 0.04, 0], M.wood, 0.02);
  // Paneles del frente (+z) y del lateral (+x).
  box(g, [0.7, 0.3, 0.02], [0, 0.11, 0.32], M.woodLight, 0.01);
  box(g, [0.02, 0.3, 0.5], [0.42, 0.11, 0], M.woodLight, 0.01);
  box(g, [0.92, 0.05, 0.72], [0, 0.5, 0], M.counterTop, 0.02);
  // Cajón portamonedas y terminal.
  box(g, [0.36, 0.08, 0.3], [-0.08, 0.55, -0.08], M.charcoal, 0.02);
  rod(g, [-0.08, 0.63, -0.12], [-0.08, 0.74, -0.12], 0.025, M.grey);
  const screen = new THREE.Group();
  box(screen, [0.32, 0.2, 0.03], [0, 0, 0], M.charcoal, 0.015);
  box(screen, [0.28, 0.16, 0.005], [0, 0.02, 0.016], M.screen, 0.004);
  screen.position.set(-0.08, 0.7, -0.1);
  screen.rotation.set(-0.35, 0.55, 0);
  g.add(screen);
  // Impresora de tiques con el papel saliendo.
  box(g, [0.13, 0.09, 0.15], [0.26, 0.55, -0.16], M.white, 0.02);
  box(g, [0.08, 0.1, 0.005], [0.26, 0.62, -0.2], M.paper, 0.002);
  // Datáfono hacia el cliente.
  box(g, [0.08, 0.025, 0.13], [0.22, 0.55, 0.2], M.charcoal, 0.01);
  box(g, [0.06, 0.004, 0.05], [0.22, 0.575, 0.18], M.screen, 0.002);
  // Bolsas de papel preparadas.
  box(g, [0.12, 0.14, 0.08], [-0.32, 0.55, 0.22], M.kraft, 0.005);
  box(g, [0.1, 0.12, 0.07], [-0.3, 0.55, 0.12], M.kraft, 0.005);
  return g;
}

/** Perchero cromado con ruedas y perchas. */
export function rack() {
  const g = new THREE.Group();
  for (const x of [-0.38, 0.38]) {
    rod(g, [x, 0.05, -0.24], [x, 0.05, 0.24], 0.022, M.chrome);
    for (const z of [-0.24, 0.24]) sphere(g, [x, 0.03, z], 0.03, M.charcoal);
    rod(g, [x, 0.05, 0], [x, 1.08, 0], 0.02, M.chrome);
    sphere(g, [x, 1.08, 0], 0.03, M.chrome);
  }
  rod(g, [-0.38, 1.05, 0], [0.38, 1.05, 0], 0.016, M.chrome);
  // Perchas de madera colgando de la barra.
  for (const x of [-0.27, -0.13, 0.01, 0.15, 0.29]) {
    rod(g, [x, 1.05, 0], [x, 0.99, 0], 0.005, M.chrome);
    rod(g, [x - 0.09, 0.95, 0], [x, 0.99, 0], 0.008, M.woodLight);
    rod(g, [x, 0.99, 0], [x + 0.09, 0.95, 0], 0.008, M.woodLight);
  }
  return g;
}

/** Estantería de ferretería: estructura metálica, baldas y panel perforado al fondo. */
export function shelf() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) box(g, [0.04, 0.8, 0.04], [x, 0, z], M.grey, 0.008);
  for (const y of [0.04, 0.4, 0.76]) box(g, [0.86, 0.035, 0.64], [0, y, 0], M.white, 0.01);
  // Panel perforado en la cara trasera (-z) con agujeros.
  box(g, [0.8, 0.72, 0.02], [0, 0.07, -0.31], M.pegboard, 0.005);
  const holeMat = mat(0x8d6e63);
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 6; j++) box(g, [0.018, 0.018, 0.004], [-0.33 + i * 0.11, 0.12 + j * 0.11, -0.297], holeMat, 0);
  }
  // Género en la balda de en medio: cajitas de colores.
  const colors = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe9c46a];
  colors.forEach((c, i) => box(g, [0.12, 0.13 + (i % 2) * 0.04, 0.16], [-0.32 + i * 0.16, 0.435, 0.08], mat(c), 0.01));
  colors.reverse().forEach((c, i) => box(g, [0.13, 0.1 + (i % 3) * 0.04, 0.14], [-0.31 + i * 0.155, 0.075, 0.12], mat(c), 0.01));
  return g;
}

/** Vitrina: mueble bajo con remates metálicos (el cristal va en otra capa). */
export function caseBase() {
  const g = new THREE.Group();
  box(g, [0.88, 0.06, 0.68], [0, 0, 0], M.charcoal, 0.01);
  box(g, [0.86, 0.38, 0.66], [0, 0.04, 0], M.white, 0.02);
  box(g, [0.7, 0.22, 0.01], [0, 0.12, 0.335], M.teal, 0.005);
  box(g, [0.01, 0.22, 0.5], [0.435, 0.12, 0], M.teal, 0.005);
  box(g, [0.9, 0.04, 0.7], [0, 0.42, 0], M.counterTop, 0.01);
  return g;
}

export function caseGlass() {
  const g = new THREE.Group();
  const glass = box(g, [0.86, 0.34, 0.66], [0, 0.46, 0], M.glass, 0.01);
  glass.castShadow = false;
  for (const [x, z] of [[-0.43, -0.33], [0.43, -0.33], [-0.43, 0.33], [0.43, 0.33]]) rod(g, [x, 0.46, z], [x, 0.8, z], 0.008, M.chrome);
  for (const y of [0.8]) {
    rod(g, [-0.43, y, 0.33], [0.43, y, 0.33], 0.008, M.chrome);
    rod(g, [0.43, y, -0.33], [0.43, y, 0.33], 0.008, M.chrome);
    rod(g, [-0.43, y, -0.33], [0.43, y, -0.33], 0.008, M.chrome);
    rod(g, [-0.43, y, -0.33], [-0.43, y, 0.33], 0.008, M.chrome);
  }
  return g;
}

/** Mesa de madera con mantel para juguetes y libros. */
export function table() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) box(g, [0.05, 0.36, 0.05], [x, 0, z], M.woodDark, 0.01);
  box(g, [0.86, 0.04, 0.86], [0, 0.36, 0], M.woodLight, 0.015);
  // Mantel de rayas.
  for (let i = 0; i < 6; i++) box(g, [0.13, 0.012, 0.8], [-0.33 + i * 0.132, 0.4, 0], i % 2 ? M.white : M.yellow, 0.002);
  box(g, [0.8, 0.07, 0.01], [0, 0.34, 0.4], M.yellow, 0.003);
  box(g, [0.01, 0.07, 0.8], [0.4, 0.34, 0], M.yellow, 0.003);
  return g;
}

/** Tocador rosa con cajones, tiradores dorados y espejo al fondo. */
export function boutique() {
  const g = new THREE.Group();
  box(g, [0.86, 0.48, 0.62], [0, 0, 0.02], M.pink, 0.025);
  for (const y of [0.08, 0.25]) {
    box(g, [0.36, 0.13, 0.01], [-0.2, y, 0.335], M.pinkDark, 0.01);
    box(g, [0.36, 0.13, 0.01], [0.2, y, 0.335], M.pinkDark, 0.01);
    sphere(g, [-0.2, y + 0.065, 0.345], 0.018, M.gold);
    sphere(g, [0.2, y + 0.065, 0.345], 0.018, M.gold);
  }
  box(g, [0.9, 0.04, 0.66], [0, 0.48, 0.02], M.white, 0.015);
  // Espejo con marco dorado en la parte de atrás.
  box(g, [0.6, 0.5, 0.04], [0, 0.52, -0.28], M.gold, 0.03);
  box(g, [0.52, 0.42, 0.01], [0, 0.56, -0.255], M.mirror, 0.02);
  // Bombillas de camerino.
  for (let i = 0; i < 4; i++) sphere(g, [-0.24 + i * 0.16, 1.04, -0.27], 0.022, mat(0xfff3b0, { emissive: 0xffd166, emissiveIntensity: 0.8 }));
  return g;
}

/** Rincón deportivo: tarima de césped con líneas y una valla baja. */
export function sports() {
  const g = new THREE.Group();
  box(g, [0.94, 0.08, 0.94], [0, 0, 0], M.turfDark, 0.015);
  box(g, [0.9, 0.03, 0.9], [0, 0.08, 0], M.turf, 0.01);
  const line = mat(0xffffff, { roughness: 0.8 });
  box(g, [0.86, 0.004, 0.015], [0, 0.11, 0.42], line, 0);
  box(g, [0.86, 0.004, 0.015], [0, 0.11, -0.42], line, 0);
  box(g, [0.015, 0.004, 0.86], [0.42, 0.11, 0], line, 0);
  box(g, [0.015, 0.004, 0.86], [-0.42, 0.11, 0], line, 0);
  box(g, [0.015, 0.004, 0.86], [0, 0.11, 0], line, 0);
  // Valla blanca en los lados del fondo.
  for (let i = 0; i <= 4; i++) {
    const t = -0.44 + i * 0.22;
    rod(g, [t, 0.08, -0.44], [t, 0.32, -0.44], 0.012, M.white);
    rod(g, [-0.44, 0.08, t], [-0.44, 0.32, t], 0.012, M.white);
  }
  rod(g, [-0.44, 0.3, -0.44], [0.44, 0.3, -0.44], 0.01, M.white);
  rod(g, [-0.44, 0.3, -0.44], [-0.44, 0.3, 0.44], 0.01, M.white);
  box(g, [0.14, 0.2, 0.1], [0.32, 0.11, -0.3], M.red, 0.02); // banderín / caja de material
  return g;
}

// ---------------------------------------------------------------------------
// Alimentación
// ---------------------------------------------------------------------------

const F = {
  crate: mat(0xc8975f, { roughness: 0.8 }),
  crateDark: mat(0x8d5f34, { roughness: 0.8 }),
  canvasRed: mat(0xe63946, { roughness: 0.8 }),
  canvasWhite: mat(0xfdf6ec, { roughness: 0.8 }),
  cartGreen: mat(0x2a9d8f, { roughness: 0.6 }),
  steel: mat(0xdee2e6, { roughness: 0.3, metalness: 0.6 }),
  ice: mat(0xf1faff, { roughness: 0.3, emissive: 0xcfe9ff, emissiveIntensity: 0.2 }),
  frost: mat(0xcaf0f8, { roughness: 0.4, emissive: 0x90e0ef, emissiveIntensity: 0.25 }),
  fridgeIn: mat(0xf8f9fa, { roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.15 }),
  led: mat(0xffffff, { emissive: 0xe0f7ff, emissiveIntensity: 1.2 }),
  chalk: mat(0x2f3e46, { roughness: 0.9 }),
  butcherBlock: mat(0xe9c46a, { roughness: 0.7 }),
  wicker: mat(0xb08350, { roughness: 0.9 }),
};

/** Caja de fruta de madera con listones. */
function crate(group, [w, h, d], [x, y, z]) {
  box(group, [w, 0.02, d], [x, y, z], F.crateDark, 0.005);
  for (const side of [-1, 1]) {
    box(group, [w, h, 0.02], [x, y, z + side * (d / 2 - 0.01)], F.crate, 0.004);
    box(group, [0.02, h, d], [x + side * (w / 2 - 0.01), y, z], F.crate, 0.004);
  }
  box(group, [w - 0.04, 0.012, d - 0.04], [x, y + h - 0.04, z], F.crateDark, 0.003);
}

/** Frutería: dos niveles de cajas de madera bajo un toldo de rayas. */
export function fruit() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.4, -0.36], [0.4, -0.36], [-0.4, 0.36], [0.4, 0.36]]) box(g, [0.04, z < 0 ? 0.46 : 0.26, 0.04], [x, 0, z], F.crateDark, 0.008);
  box(g, [0.86, 0.03, 0.36], [0, 0.44, -0.2], F.crateDark, 0.008);
  box(g, [0.86, 0.03, 0.36], [0, 0.24, 0.2], F.crateDark, 0.008);
  for (const x of [-0.28, 0, 0.28]) {
    crate(g, [0.26, 0.16, 0.32], [x, 0.47, -0.2]);
    crate(g, [0.26, 0.16, 0.32], [x, 0.27, 0.2]);
  }
  // Toldo de rayas inclinado sobre dos postes.
  for (const x of [-0.42, 0.42]) rod(g, [x, 0, -0.42], [x, 1.18, -0.42], 0.018, F.crateDark);
  const awning = new THREE.Group();
  for (let i = 0; i < 6; i++) box(awning, [0.15, 0.02, 0.5], [-0.375 + i * 0.15, 0, 0], i % 2 ? F.canvasWhite : F.canvasRed, 0.005);
  for (let i = 0; i < 6; i++) box(awning, [0.15, 0.08, 0.02], [-0.375 + i * 0.15, -0.08, 0.25], i % 2 ? F.canvasWhite : F.canvasRed, 0.005);
  awning.position.set(0, 1.12, -0.2);
  awning.rotation.x = 0.35;
  g.add(awning);
  return g;
}

/** Puesto de verduras: carro de madera pintado con ruedas y cestas. */
export function veggie() {
  const g = new THREE.Group();
  box(g, [0.86, 0.06, 0.66], [0, 0.36, 0], F.cartGreen, 0.01);
  for (const side of [-1, 1]) {
    box(g, [0.86, 0.1, 0.03], [0, 0.42, side * 0.32], F.cartGreen, 0.008);
    box(g, [0.03, 0.1, 0.66], [side * 0.42, 0.42, 0], F.cartGreen, 0.008);
  }
  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 10, 28), F.crateDark);
    wheel.position.set(0.2, 0.2, side * 0.36);
    wheel.castShadow = true;
    g.add(wheel);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      rod(g, [0.2 + Math.cos(a) * 0.17, 0.2 + Math.sin(a) * 0.17, side * 0.36], [0.2 - Math.cos(a) * 0.17, 0.2 - Math.sin(a) * 0.17, side * 0.36], 0.008, F.crateDark);
    }
  }
  box(g, [0.04, 0.36, 0.04], [-0.38, 0, 0], F.crateDark, 0.008);
  for (const [x, z] of [[-0.26, -0.14], [0, -0.14], [0.26, -0.14], [-0.26, 0.15], [0, 0.15], [0.26, 0.15]]) box(g, [0.24, 0.07, 0.26], [x, 0.42, z], F.wicker, 0.03);
  // Pizarra con precios.
  box(g, [0.3, 0.2, 0.02], [-0.18, 0.5, -0.33], F.chalk, 0.01);
  return g;
}

/** Panadería: mostrador de madera con cestas de mimbre (el cristal va aparte). */
export function bakery() {
  const g = new THREE.Group();
  box(g, [0.86, 0.06, 0.62], [0, 0, 0], M.charcoal, 0.01);
  box(g, [0.84, 0.36, 0.6], [0, 0.04, 0], M.woodLight, 0.02);
  for (let i = 0; i < 4; i++) box(g, [0.18, 0.26, 0.01], [-0.3 + i * 0.2, 0.09, 0.305], M.wood, 0.01);
  box(g, [0.9, 0.04, 0.66], [0, 0.4, 0], M.counterTop, 0.015);
  for (const [x, z] of [[-0.26, -0.12], [0, -0.12], [0.26, -0.12], [-0.26, 0.16], [0, 0.16], [0.26, 0.16]]) box(g, [0.24, 0.04, 0.24], [x, 0.44, z], F.wicker, 0.02);
  return g;
}

export function bakeryGlass() {
  const g = new THREE.Group();
  const glass = box(g, [0.86, 0.32, 0.62], [0, 0.44, 0], M.glass, 0.04);
  glass.castShadow = false;
  box(g, [0.88, 0.02, 0.64], [0, 0.76, 0], M.woodLight, 0.01);
  return g;
}

/** Carnicería: vitrina refrigerada de acero con bandeja de hielo y tajo de madera. */
export function butcher() {
  const g = new THREE.Group();
  box(g, [0.86, 0.06, 0.62], [0, 0, 0], M.charcoal, 0.01);
  box(g, [0.84, 0.38, 0.6], [0, 0.04, 0], F.steel, 0.02);
  box(g, [0.84, 0.05, 0.01], [0, 0.3, 0.305], M.red, 0.005);
  box(g, [0.01, 0.05, 0.6], [0.425, 0.3, 0], M.red, 0.005);
  box(g, [0.86, 0.04, 0.62], [0, 0.42, 0], F.steel, 0.01);
  box(g, [0.8, 0.03, 0.5], [0, 0.46, 0.02], F.ice, 0.01);
  // Tajo y cuchillo al fondo.
  box(g, [0.26, 0.08, 0.14], [0.26, 0.46, -0.24], F.butcherBlock, 0.02);
  box(g, [0.16, 0.005, 0.03], [0.24, 0.54, -0.24], M.chrome, 0.002);
  return g;
}

export function butcherGlass() {
  const g = new THREE.Group();
  const glass = box(g, [0.84, 0.26, 0.5], [0, 0.49, 0.04], M.glass, 0.02);
  glass.castShadow = false;
  box(g, [0.86, 0.02, 0.52], [0, 0.75, 0.04], F.steel, 0.005);
  return g;
}

/** Rueda de queso decorativa (cilindro con corteza). */
function cheeseWheel(group, [x, y, z], radius, height, rind, inside) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28), rind);
  wheel.position.set(x, y + height / 2, z);
  wheel.castShadow = true;
  group.add(wheel);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, 0.004, 28), inside);
  top.position.set(x, y + height + 0.002, z);
  group.add(top);
}

const CHEESE = {
  rind: mat(0xd4a24c, { roughness: 0.7 }),
  paste: mat(0xffe08a, { roughness: 0.6 }),
  wax: mat(0xd62828, { roughness: 0.35 }),
  white: mat(0xfffcf2, { roughness: 0.7 }),
  cream: mat(0xfff3c4, { roughness: 0.5 }),
  hole: mat(0xe6b84a, { roughness: 0.8 }),
  blue: mat(0x5c7c99, { roughness: 0.8 }),
  manchego: mat(0xc9a66b, { roughness: 0.8 }),
  leaf: mat(0x52b788, { roughness: 0.6 }),
};

/** Quesería: mostrador de madera oscura, tabla de corte y ruedas de queso al fondo. */
export function cheese() {
  const g = new THREE.Group();
  box(g, [0.86, 0.06, 0.62], [0, 0, 0], M.charcoal, 0.01);
  box(g, [0.84, 0.4, 0.6], [0, 0.04, 0], M.woodDark, 0.02);
  for (let i = 0; i < 3; i++) box(g, [0.24, 0.28, 0.01], [-0.27 + i * 0.27, 0.1, 0.305], M.wood, 0.01);
  box(g, [0.9, 0.05, 0.66], [0, 0.44, 0], F.butcherBlock, 0.015);
  // Estante trasero con ruedas de queso.
  box(g, [0.86, 0.03, 0.18], [0, 0.72, -0.24], M.woodDark, 0.008);
  for (const x of [-0.4, 0.4]) box(g, [0.03, 0.3, 0.03], [x, 0.44, -0.3], M.woodDark, 0.006);
  cheeseWheel(g, [-0.24, 0.75, -0.24], 0.1, 0.08, CHEESE.wax, CHEESE.paste);
  cheeseWheel(g, [0.0, 0.75, -0.24], 0.1, 0.08, CHEESE.manchego, CHEESE.white);
  cheeseWheel(g, [0.24, 0.75, -0.24], 0.1, 0.08, CHEESE.rind, CHEESE.paste);
  cheeseWheel(g, [-0.12, 0.83, -0.24], 0.08, 0.07, CHEESE.rind, CHEESE.paste);
  // Tabla con cuchillo de queso en la esquina delantera.
  box(g, [0.22, 0.02, 0.16], [0.28, 0.49, 0.2], F.butcherBlock, 0.01);
  box(g, [0.14, 0.004, 0.025], [0.27, 0.512, 0.2], M.chrome, 0.002);
  return g;
}

/** Nevera vertical: cuerpo abierto por delante con baldas iluminadas (la puerta va aparte). */
export function fridge() {
  const g = new THREE.Group();
  const H = 1.25;
  box(g, [0.86, 0.08, 0.62], [0, 0, 0], M.charcoal, 0.01);
  box(g, [0.86, 0.02, 0.6], [0, 0.08, -0.01], F.fridgeIn, 0);
  box(g, [0.86, H - 0.08, 0.03], [0, 0.08, -0.295], F.fridgeIn, 0.01); // fondo
  for (const side of [-1, 1]) box(g, [0.03, H - 0.08, 0.62], [side * 0.415, 0.08, 0], M.white, 0.01);
  box(g, [0.86, 0.12, 0.62], [0, H - 0.12, 0], M.white, 0.02); // techo con el rótulo
  box(g, [0.5, 0.06, 0.005], [0, H - 0.09, 0.312], M.teal, 0.005);
  for (const y of [0.44, 0.8]) box(g, [0.8, 0.02, 0.56], [0, y, -0.01], M.glass, 0.004);
  box(g, [0.78, 0.01, 0.02], [0, H - 0.135, 0.25], F.led, 0);
  return g;
}

export function fridgeGlass() {
  const g = new THREE.Group();
  const H = 1.25;
  const pane = box(g, [0.8, H - 0.22, 0.01], [0, 0.09, 0.305], M.glass, 0.005);
  pane.castShadow = false;
  for (const x of [-0.41, 0.41]) box(g, [0.025, H - 0.2, 0.02], [x, 0.08, 0.305], M.white, 0.006);
  box(g, [0.84, 0.025, 0.02], [0, 0.08, 0.305], M.white, 0.006);
  box(g, [0.84, 0.025, 0.02], [0, H - 0.14, 0.305], M.white, 0.006);
  box(g, [0.02, 0.4, 0.03], [0.36, 0.4, 0.33], M.chrome, 0.008); // tirador
  return g;
}

/** Congelador horizontal: arcón con interior escarchado (la tapa de cristal va aparte). */
export function freezer() {
  const g = new THREE.Group();
  box(g, [0.86, 0.06, 0.62], [0, 0, 0], M.charcoal, 0.01);
  box(g, [0.86, 0.14, 0.62], [0, 0.04, 0], M.white, 0.02);
  for (const side of [-1, 1]) {
    box(g, [0.86, 0.32, 0.03], [0, 0.18, side * 0.295], M.white, 0.01);
    box(g, [0.03, 0.32, 0.62], [side * 0.415, 0.18, 0], M.white, 0.01);
  }
  box(g, [0.8, 0.2, 0.56], [0, 0.18, 0], F.frost, 0.01);
  box(g, [0.86, 0.06, 0.01], [0, 0.28, 0.312], mat(0x4d96ff), 0.005);
  box(g, [0.01, 0.06, 0.62], [0.427, 0.28, 0], mat(0x4d96ff), 0.005);
  return g;
}

export function freezerGlass() {
  const g = new THREE.Group();
  const lid = box(g, [0.84, 0.02, 0.6], [0, 0.5, 0], M.glass, 0.005);
  lid.castShadow = false;
  box(g, [0.86, 0.025, 0.03], [0, 0.5, 0.3], F.steel, 0.006);
  box(g, [0.86, 0.025, 0.03], [0, 0.5, -0.3], F.steel, 0.006);
  box(g, [0.86, 0.025, 0.03], [0, 0.5, 0], F.steel, 0.006);
  return g;
}

// ---------------------------------------------------------------------------
// Decoración
// ---------------------------------------------------------------------------

const D = {
  fabric: mat(0x4d908e, { roughness: 0.9 }),
  fabricDark: mat(0x3a7270, { roughness: 0.9 }),
  cushion: mat(0xf2cc8f, { roughness: 0.9 }),
  shade: mat(0xfff1d0, { roughness: 0.8, emissive: 0xffd8a8, emissiveIntensity: 0.5 }),
  terracotta: mat(0xd2694b, { roughness: 0.8 }),
  soil: mat(0x5c4033, { roughness: 1 }),
  leaf: mat(0x40916c, { roughness: 0.7 }),
  leafLight: mat(0x74c69d, { roughness: 0.7 }),
  pine: mat(0x2d6a4f, { roughness: 0.8 }),
  stone: mat(0xced4da, { roughness: 0.8 }),
  stoneDark: mat(0xadb5bd, { roughness: 0.8 }),
  water: mat(0x8ecae6, { roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x4cc9f0, emissiveIntensity: 0.25 }),
  rug: mat(0xb5179e, { roughness: 1 }),
  rugBorder: mat(0xffd166, { roughness: 1 }),
  skin: mat(0xf1f3f5, { roughness: 0.4 }),
  dress: mat(0xe76f51, { roughness: 0.7 }),
};

export function bench() {
  const g = new THREE.Group();
  for (const x of [-0.32, 0.32]) {
    box(g, [0.04, 0.24, 0.3], [x, 0, 0], M.charcoal, 0.01);
    box(g, [0.04, 0.3, 0.04], [x, 0.24, -0.14], M.charcoal, 0.01);
  }
  for (let i = 0; i < 3; i++) box(g, [0.78, 0.03, 0.08], [0, 0.24, -0.1 + i * 0.1], M.woodLight, 0.01);
  for (let i = 0; i < 2; i++) box(g, [0.78, 0.07, 0.025], [0, 0.34 + i * 0.1, -0.15], M.woodLight, 0.01);
  return g;
}

export function rug() {
  const g = new THREE.Group();
  box(g, [0.94, 0.012, 0.94], [0, 0, 0], D.rugBorder, 0.01);
  box(g, [0.82, 0.016, 0.82], [0, 0, 0], D.rug, 0.01);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 40), D.rugBorder);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.017;
  g.add(ring);
  sphere(g, [0, 0.0, 0], 0.08, D.rugBorder).scale.set(1, 0.25, 1);
  return g;
}

export function lamp() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 24), M.charcoal);
  base.position.y = 0.02;
  base.castShadow = true;
  g.add(base);
  rod(g, [0, 0.04, 0], [0, 1.1, 0], 0.015, M.gold);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 28, 1, true), D.shade);
  shade.material.side = THREE.DoubleSide;
  shade.position.y = 1.12;
  shade.castShadow = true;
  g.add(shade);
  sphere(g, [0, 1.06, 0], 0.04, mat(0xffffff, { emissive: 0xffe8a3, emissiveIntensity: 1.5 }));
  return g;
}

export function sofa() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.38, -0.25], [0.38, -0.25], [-0.38, 0.25], [0.38, 0.25]]) box(g, [0.04, 0.06, 0.04], [x, 0, z], M.woodDark, 0.01);
  box(g, [0.9, 0.18, 0.6], [0, 0.06, 0], D.fabricDark, 0.04);
  box(g, [0.9, 0.38, 0.16], [0, 0.18, -0.22], D.fabric, 0.06);
  for (const x of [-0.41, 0.41]) box(g, [0.1, 0.28, 0.6], [x, 0.14, 0], D.fabric, 0.05);
  for (const x of [-0.18, 0.18]) box(g, [0.34, 0.08, 0.42], [x, 0.24, 0.05], D.fabric, 0.04);
  box(g, [0.18, 0.18, 0.06], [-0.22, 0.32, -0.1], D.cushion, 0.05).rotation.set(-0.2, 0.2, 0.1);
  return g;
}

export function mannequin() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 24), M.charcoal);
  base.position.y = 0.02;
  g.add(base);
  rod(g, [0, 0.04, 0], [0, 0.42, 0], 0.015, M.chrome);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 28, 1, true), D.dress);
  skirt.material.side = THREE.DoubleSide;
  skirt.position.y = 0.6;
  skirt.castShadow = true;
  g.add(skirt);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 6, 16), D.dress);
  torso.position.y = 0.88;
  torso.scale.set(1.15, 1, 0.8);
  torso.castShadow = true;
  g.add(torso);
  for (const side of [-1, 1]) rod(g, [side * 0.12, 0.96, 0], [side * 0.15, 0.7, 0.03], 0.025, D.skin);
  rod(g, [0, 1.0, 0], [0, 1.07, 0], 0.03, D.skin);
  sphere(g, [0, 1.15, 0], 0.075, D.skin).scale.set(0.9, 1.1, 0.9);
  return g;
}

function pot(g, radius, height, material = D.terracotta) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.75, height, 24), material);
  p.position.y = height / 2;
  p.castShadow = true;
  g.add(p);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, 0.01, 24), D.soil);
  soil.position.y = height - 0.01;
  g.add(soil);
}

export function ficus() {
  const g = new THREE.Group();
  pot(g, 0.17, 0.26, M.white);
  rod(g, [0, 0.25, 0], [0.02, 0.75, 0], 0.025, M.woodDark);
  const blobs = [[0, 0.95, 0, 0.2], [0.14, 0.82, 0.05, 0.14], [-0.13, 0.85, -0.04, 0.15], [0.03, 0.78, 0.15, 0.12], [-0.05, 1.1, 0.02, 0.13], [0.08, 0.7, -0.12, 0.11]];
  blobs.forEach(([x, y, z, r], i) => sphere(g, [x, y, z], r, i % 2 ? D.leafLight : D.leaf));
  return g;
}

export function xmasTree() {
  const g = new THREE.Group();
  pot(g, 0.14, 0.14, M.red);
  rod(g, [0, 0.12, 0], [0, 0.3, 0], 0.04, M.woodDark);
  [[0.34, 0.42, 0.28], [0.27, 0.36, 0.56], [0.19, 0.3, 0.8]].forEach(([r, h, y]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), D.pine);
    cone.position.y = y;
    cone.castShadow = true;
    g.add(cone);
  });
  const balls = [0xe63946, 0xffd166, 0x4d96ff, 0xf1faee];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4;
    const y = 0.3 + (i / 14) * 0.65;
    const r = 0.3 * (1 - (y - 0.25) / 0.85) + 0.03;
    sphere(g, [Math.cos(a) * r, y, Math.sin(a) * r], 0.028, mat(balls[i % 4], { roughness: 0.2, metalness: 0.5 }));
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat(0xffd166, { emissive: 0xffb703, emissiveIntensity: 0.8 }));
  star.position.y = 1.1;
  g.add(star);
  return g;
}

export function fountain() {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.18, 32), D.stone);
  basin.position.y = 0.09;
  basin.castShadow = true;
  g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.02, 32), D.water);
  water.position.y = 0.17;
  g.add(water);
  rod(g, [0, 0.17, 0], [0, 0.55, 0], 0.05, D.stoneDark);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.08, 0.08, 28), D.stone);
  bowl.position.y = 0.58;
  bowl.castShadow = true;
  g.add(bowl);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 28), D.water);
  top.position.y = 0.62;
  g.add(top);
  sphere(g, [0, 0.7, 0], 0.05, D.water);
  // Chorros que caen al estanque.
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    rod(g, [Math.cos(a) * 0.17, 0.6, Math.sin(a) * 0.17], [Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3], 0.012, D.water);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Quesos (se ven como productos, no como muebles)
// ---------------------------------------------------------------------------

/** Cuña: prisma triangular de queso con `apex` hacia +z. */
function wedge(group, radius, height, rind, paste, [x, y, z] = [0, 0, 0]) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-radius * 0.5, -radius);
  shape.lineTo(radius * 0.5, -radius);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  const mesh = new THREE.Mesh(geo, [paste, rind]);
  mesh.rotation.x = -Math.PI / 2;
  // La extrusión deja la punta en z y la base en z + radius: la centramos.
  mesh.position.set(x, y, z - radius * 0.55);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

export function cheeseManchego() {
  const g = new THREE.Group();
  cheeseWheel(g, [0, 0, 0], 0.26, 0.17, CHEESE.manchego, CHEESE.cream);
  // Bandas más oscuras en el canto, como la pleita del manchego.
  for (const y of [0.04, 0.085, 0.13]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.006, 6, 40), mat(0xa98455));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    g.add(band);
  }
  return g;
}

export function cheeseGouda() {
  const g = new THREE.Group();
  cheeseWheel(g, [-0.04, 0, -0.04], 0.24, 0.16, CHEESE.wax, CHEESE.paste);
  wedge(g, 0.2, 0.13, CHEESE.wax, CHEESE.paste, [0.12, 0, 0.16]);
  return g;
}

export function cheeseEmmental() {
  const g = new THREE.Group();
  wedge(g, 0.42, 0.2, CHEESE.rind, CHEESE.paste, [0, 0, -0.06]);
  // Agujeros en la cara de arriba (dentro de la cuña: la punta está en z = -0.29).
  for (const [x, z, r] of [[-0.03, -0.1, 0.03], [0.05, 0.05, 0.028], [0, -0.21, 0.02], [-0.1, 0.06, 0.03], [0.1, -0.02, 0.025]]) {
    sphere(g, [x, 0.206, z], r, CHEESE.hole).scale.set(1, 0.25, 1);
  }
  return g;
}

export function cheeseBlue() {
  const g = new THREE.Group();
  wedge(g, 0.36, 0.18, CHEESE.white, CHEESE.white, [0, 0, -0.04]);
  // Vetas azules repartidas por la cara de arriba (la punta está en z = -0.24).
  for (let i = 0; i < 16; i++) {
    const z = -0.2 + (i / 15) * 0.3;
    const halfWidth = ((z + 0.238) / 2) * 0.75;
    sphere(g, [Math.sin(i * 2.7) * halfWidth, 0.186, z], 0.016, CHEESE.blue).scale.set(1.4, 0.3, 1);
  }
  return g;
}

export function cheeseMozzarella() {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.01, 6), CHEESE.leaf);
  leaf.scale.set(1, 1, 0.7);
  leaf.position.y = 0.005;
  g.add(leaf);
  for (const [x, z, r] of [[-0.1, -0.04, 0.11], [0.11, -0.03, 0.1], [0, 0.1, 0.1]]) sphere(g, [x, r * 0.85, z], r, CHEESE.white).scale.set(1, 0.85, 1);
  return g;
}

export function cheeseBrie() {
  const g = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.09, 32, 1, false, 0.4, Math.PI * 2 - 0.8), CHEESE.white);
  wheel.position.y = 0.045;
  wheel.castShadow = true;
  g.add(wheel);
  // Corte cremoso.
  for (const a of [0.4, Math.PI * 2 - 0.4]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.085), CHEESE.cream);
    face.material.side = THREE.DoubleSide;
    face.position.set(Math.sin(a) * 0.125, 0.045, Math.cos(a) * 0.125);
    face.rotation.y = a - Math.PI / 2;
    g.add(face);
  }
  return g;
}

/**
 * Sprites que se generan. `frame: 'tile'` encuadra una casilla (muebles, 256 px);
 * `frame: 'item'` encuadra un producto suelto (128 px). `shadow: false` para capas
 * que van encima de otras, como los cristales.
 */
export const SPRITES = [
  { name: 'furniture/register', build: register },
  { name: 'furniture/rack', build: rack },
  { name: 'furniture/shelf', build: shelf },
  { name: 'furniture/case', build: caseBase },
  { name: 'furniture/case-glass', build: caseGlass, shadow: false },
  { name: 'furniture/table', build: table },
  { name: 'furniture/boutique', build: boutique },
  { name: 'furniture/sports', build: sports },
  { name: 'furniture/fruit', build: fruit },
  { name: 'furniture/veggie', build: veggie },
  { name: 'furniture/bakery', build: bakery },
  { name: 'furniture/bakery-glass', build: bakeryGlass, shadow: false },
  { name: 'furniture/butcher', build: butcher },
  { name: 'furniture/butcher-glass', build: butcherGlass, shadow: false },
  { name: 'furniture/cheese', build: cheese },
  { name: 'furniture/fridge', build: fridge },
  { name: 'furniture/fridge-glass', build: fridgeGlass, shadow: false },
  { name: 'furniture/freezer', build: freezer },
  { name: 'furniture/freezer-glass', build: freezerGlass, shadow: false },
  { name: 'furniture/decor-bench', build: bench },
  { name: 'furniture/decor-rug', build: rug },
  { name: 'furniture/decor-lamp', build: lamp },
  { name: 'furniture/decor-sofa', build: sofa },
  { name: 'furniture/decor-mannequin', build: mannequin },
  { name: 'furniture/decor-ficus', build: ficus },
  { name: 'furniture/decor-tree', build: xmasTree },
  { name: 'furniture/decor-fountain', build: fountain },
  { name: 'items/manchego', build: cheeseManchego, frame: 'item' },
  { name: 'items/gouda', build: cheeseGouda, frame: 'item' },
  { name: 'items/emmental', build: cheeseEmmental, frame: 'item' },
  { name: 'items/bluecheese', build: cheeseBlue, frame: 'item' },
  { name: 'items/mozzarella', build: cheeseMozzarella, frame: 'item' },
  { name: 'items/brie', build: cheeseBrie, frame: 'item' },
];
