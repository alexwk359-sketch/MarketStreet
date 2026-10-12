// Se ejecuta en Chromium (vía Playwright): renderiza cada modelo con una cámara
// isométrica 2:1 que coincide con la cuadrícula del juego.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CASHIER_POSES,
  CASHIER_VARIANTS,
  CHARACTER_SETS,
  DIRECTIONS,
  IDLE_POSE,
  REACH_POSE,
  WALK_FRAMES,
  cashierSpec,
  makeCharacter,
  walkPose,
} from './characters.js';
import { SPRITES } from './models.js';

/** Tamaño final de cada sprite. Una casilla mide 128 px de ancho (el doble que en el juego). */
const SIZE = 256;
const SUPERSAMPLE = 2;
/** Unidades de pantalla visibles: la casilla (√2 de diagonal) ocupa la mitad del ancho. */
const HALF_W = Math.SQRT2;

function setup() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE * SUPERSAMPLE, SIZE * SUPERSAMPLE);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Cámara ortográfica a 45° de giro y 30° de elevación: proyección 2:1 como la del juego.
  // El centro de la casilla queda en el 75% de la altura del sprite.
  const camera = new THREE.OrthographicCamera(-HALF_W, HALF_W, HALF_W * 1.5, -HALF_W * 0.5, 0.1, 100);
  const elevation = Math.tan(Math.PI / 6) * Math.SQRT2;
  camera.position.set(10, 10 * elevation, 10);
  camera.lookAt(0, 0, 0);
  // Entorno de estudio para que el metal y el cristal tengan algo que reflejar.
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return { renderer, camera, env };
}

function scene(withShadow, env) {
  const s = new THREE.Scene();
  s.environment = env;
  s.environmentIntensity = 0.22;
  s.add(new THREE.HemisphereLight(0xffffff, 0xb59f87, 1.0));
  // Luz principal desde delante a la izquierda (+z): ilumina la cara izquierda, como en el resto del juego.
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-1.5, 4, 3);
  sun.castShadow = withShadow;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -2;
  sun.shadow.camera.right = 2;
  sun.shadow.camera.top = 2;
  sun.shadow.camera.bottom = -2;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  s.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.6);
  fill.position.set(3, 2, -1);
  s.add(fill);
  if (withShadow) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
  }
  return s;
}

/** Encuadre de un producto suelto: 0,62 unidades de ancho, centrado como los sprites de Fluent Emoji. */
function itemCamera() {
  const half = 0.31;
  const camera = new THREE.OrthographicCamera(-half, half, half * 2 * 0.62, -half * 2 * 0.38, 0.1, 100);
  const elevation = Math.tan(Math.PI / 6) * Math.SQRT2;
  camera.position.set(10, 10 * elevation, 10);
  camera.lookAt(0, 0, 0);
  return camera;
}

window.renderSprites = () => {
  const { renderer, camera, env } = setup();
  const cameras = { tile: camera, item: itemCamera() };
  const sizes = { tile: SIZE, item: SIZE / 2 };
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  // Los productos van sin sombra en el suelo, como los sprites de Fluent Emoji.
  return SPRITES.map(({ name, build, frame = 'tile', shadow = frame === 'tile' }) => {
    const s = scene(shadow, env);
    s.add(build());
    renderer.render(s, cameras[frame]);
    out.width = out.height = sizes[frame];
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(renderer.domElement, 0, 0, out.width, out.height);
    return { name, dataUrl: out.toDataURL('image/png') };
  });
};

// ---------------------------------------------------------------------------
// Personajes: hojas de sprites con varios fotogramas y direcciones
// ---------------------------------------------------------------------------

/** Cada fotograma mide 80×120 px (el doble que en el juego) y los pies quedan al 90% de la altura. */
const FRAME_W = 80;
const FRAME_H = 120;
const PX_PER_UNIT = SIZE / (2 * HALF_W);

function characterCamera() {
  const halfW = FRAME_W / 2 / PX_PER_UNIT;
  const top = (FRAME_H * 0.9) / PX_PER_UNIT;
  const bottom = -(FRAME_H * 0.1) / PX_PER_UNIT;
  const camera = new THREE.OrthographicCamera(-halfW, halfW, top, bottom, 0.1, 100);
  const elevation = Math.tan(Math.PI / 6) * Math.SQRT2;
  camera.position.set(10, 10 * elevation, 10);
  camera.lookAt(0, 0, 0);
  return camera;
}

/** Hoja: filas = direcciones, columnas = poses. */
function renderSheet(renderer, env, camera, spec, poses, directions) {
  renderer.setSize(FRAME_W * SUPERSAMPLE, FRAME_H * SUPERSAMPLE);
  const sheet = document.createElement('canvas');
  sheet.width = FRAME_W * poses.length;
  sheet.height = FRAME_H * directions.length;
  const ctx = sheet.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  directions.forEach((angle, row) => {
    poses.forEach((pose, col) => {
      const s = scene(false, env);
      const character = makeCharacter(spec, pose);
      character.rotation.y = angle;
      s.add(character);
      renderer.render(s, camera);
      ctx.drawImage(renderer.domElement, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
    });
  });
  return sheet.toDataURL('image/png');
}

window.renderSheets = () => {
  const { renderer, env } = setup();
  const camera = characterCamera();
  const customerPoses = [...Array.from({ length: WALK_FRAMES }, (_, f) => walkPose(f)), IDLE_POSE, REACH_POSE];
  const out = [];
  for (const set of CHARACTER_SETS) {
    for (let v = 0; v < set.count; v++) {
      out.push({ name: `people/${set.name}-${v}`, dataUrl: renderSheet(renderer, env, camera, set.spec(v), customerPoses, DIRECTIONS) });
    }
  }
  // Los cajeros solo se ven de frente (mirando a los clientes, se voltean en el juego).
  for (let v = 0; v < CASHIER_VARIANTS; v++) {
    out.push({ name: `people/cashier-${v}`, dataUrl: renderSheet(renderer, env, camera, cashierSpec(v), CASHIER_POSES, [DIRECTIONS[0]]) });
  }
  return out;
};

window.ready = true;
