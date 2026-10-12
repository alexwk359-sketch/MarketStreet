#!/usr/bin/env node
// Renderiza los modelos 3D de scripts/furniture/ a public/sprites/: muebles, decoración, quesos
// (models.js) y las hojas animadas de clientes y cajeros (characters.js).
// Uso: node scripts/render_furniture.mjs   (necesita las devDependencies three y playwright)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'sprites');
const HOST = 'http://render.local';

const PAGE = `<!doctype html><html><body style="margin:0">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module" src="/scripts/furniture/page.js"></script></body></html>`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('Error en la página:', e.message));
// Servimos los archivos del repositorio sin levantar un servidor.
await page.route(`${HOST}/**`, async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: PAGE });
  try {
    const body = await readFile(join(root, path));
    return route.fulfill({ contentType: 'text/javascript', body });
  } catch {
    return route.fulfill({ status: 404, body: '' });
  }
});
await page.goto(`${HOST}/`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30_000 });
// `--only=people` o `--only=furniture` para regenerar solo una parte.
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const sprites = [
  ...(only !== 'people' ? await page.evaluate(() => window.renderSprites()) : []),
  ...(only !== 'furniture' ? await page.evaluate(() => window.renderSheets()) : []),
];
for (const { name, dataUrl } of sprites) {
  const file = join(outDir, `${name}.png`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`ok  ${name}.png`);
}
await browser.close();
