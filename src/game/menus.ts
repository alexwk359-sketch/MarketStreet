// Menús a pantalla completa: inicio, nueva partida, pausa, ajustes, ayuda y créditos.
// Mientras hay uno abierto, la simulación se detiene.
import { MAX_STORE_NAME } from '../sim/sim';
import type { Controller } from './controller';
import { $, esc, fmt, img, ui } from './html';
import { settings, updateSettings } from './settings';
import { sfx } from './sound';
import { uiSprite } from './sprites';

type Screen = 'start' | 'newGame' | 'pause' | 'settings' | 'help' | 'credits';

export const HELP_HTML = `
  <ol class="help">
    <li><b>Toca un expositor</b> y pide mercancía. El camión tarda un rato; con diamantes llega al momento.</li>
    <li>Los <b>clientes</b> llegan por la acera, buscan un artículo, lo cogen y pagan en la caja.</li>
    <li>Si no encuentran lo que buscan o la cola es muy larga, se van enfadados y baja la <b>felicidad</b>.</li>
    <li>La felicidad atrae más clientes y, por encima del 70%, te dejan <b>propinas</b>. Decora para subirla.</li>
    <li>Elige el <b>precio</b> de cada expositor: barato vende más y alegra; caro gana más, pero algunos no compran.</li>
    <li>Atento a la <b>tendencia</b>: esa categoría se vende un 25% más cara.</li>
    <li>Hay muchos tipos de cliente: <b>con lista</b>, <b>niños</b>, <b>abuelos</b>, <b>turistas</b>, <b>VIP</b> y <b>críticos</b>: si salen contentos, la tienda se hace viral.</li>
    <li>¡Ojo con los <b>ladrones</b>! Si ves a uno huyendo con la sirena encima, tócalo para atraparlo.</li>
    <li>El <b>tiempo</b> y la <b>hora</b> cambian la clientela: con calor se venden helados; con lluvia, ropa y pan; de noche viene menos gente.</li>
    <li>Atiende los <b>encargos especiales</b> y completa las <b>tareas</b> para conseguir recompensas.</li>
    <li>Toca un mueble para <b>moverlo o venderlo</b>. Arrastra para mover la vista; usa la rueda o pellizca para hacer zoom.</li>
  </ol>
  <p class="muted">La partida se guarda sola. Mientras no juegas, los pedidos llegan y la tienda sigue vendiendo (más despacio).</p>`;

export function mountMenus(controller: Controller, hasSave: boolean) {
  const overlay = $('#overlay');
  let screen: Screen | null = 'start';
  let saveExists = hasSave;
  let exportCode = '';
  let confirmReset = false;
  let message = '';

  const open = (next: Screen | null) => {
    screen = next;
    exportCode = '';
    confirmReset = false;
    message = '';
    controller.setPaused(next !== null);
    render();
  };

  const render = () => {
    overlay.hidden = screen === null;
    document.body.classList.toggle('menu-open', screen !== null);
    overlay.className = screen === 'start' || screen === 'newGame' ? 'title' : '';
    if (screen === null) return;
    overlay.innerHTML = `<div class="menu-card ${screen}">${content(screen)}</div>`;
    if (screen === 'newGame') overlay.querySelector<HTMLInputElement>('#store-name')?.focus();
  };

  const content = (sc: Screen): string => {
    const s = controller.state;
    const back = (to: Screen) => `<button class="link" data-menu="${to}">← Volver</button>`;
    switch (sc) {
      case 'start':
        return `
          <div class="logo">${img(uiSprite('store'), 'logo-img')}<h1>Market<span>Street</span></h1></div>
          <p class="tagline">Monta la tienda más famosa del barrio</p>
          ${saveExists ? `<p class="save-info">${ui('store')} <b>${esc(s.storeName)}</b> · ${ui('star')} Nivel ${s.level} · ${ui('coin')} ${fmt(s.coins)}</p>` : ''}
          <div class="menu-buttons">
            ${saveExists ? '<button class="primary" data-menu="resume">Continuar</button>' : ''}
            <button class="${saveExists ? '' : 'primary'}" data-menu="newGame">Nueva partida</button>
            <button data-menu="settings">Ajustes</button>
            <button data-menu="help">Cómo jugar</button>
            <button class="link" data-menu="credits">Créditos</button>
          </div>`;
      case 'newGame':
        return `
          <h2>${ui('store')} Tu nueva tienda</h2>
          <label class="field">¿Cómo se llamará?
            <input id="store-name" maxlength="${MAX_STORE_NAME}" value="${saveExists ? '' : esc(s.storeName)}" placeholder="Market Street">
          </label>
          ${saveExists ? '<p class="warning">Se borrará la partida actual.</p>' : ''}
          <div class="menu-buttons">
            <button class="primary" data-menu="create">Abrir la tienda</button>
            ${back('start')}
          </div>`;
      case 'pause':
        return `
          <h2>${ui('gear')} Pausa</h2>
          <div class="menu-buttons">
            <button class="primary" data-menu="resume">Reanudar</button>
            <button data-menu="settings">Ajustes</button>
            <button data-menu="help">Cómo jugar</button>
            <button data-menu="start">Pantalla de inicio</button>
          </div>`;
      case 'settings':
        return `
          <h2>${ui('gear')} Ajustes</h2>
          <label class="field">Volumen de los efectos
            <input type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" data-setting="volume">
          </label>
          ${toggle('weatherFx', 'Lluvia y nieve en pantalla')}
          ${toggle('dayNightFx', 'Anochecer y farolas')}
          ${toggle('labels', 'Etiquetas de stock en los expositores')}
          <label class="field">Nombre de la tienda
            <span class="row"><input id="rename" maxlength="${MAX_STORE_NAME}" value="${esc(s.storeName)}"><button data-menu="rename">Guardar</button></span>
          </label>
          <h3>Copia de seguridad</h3>
          <p class="muted">Copia el código para seguir la partida en otro navegador o dispositivo.</p>
          <div class="row"><button data-menu="export">Copiar código</button><button data-menu="import">Cargar código</button></div>
          ${exportCode ? `<textarea readonly class="code">${exportCode}</textarea>` : ''}
          <textarea id="import-code" class="code" placeholder="Pega aquí un código de partida"></textarea>
          ${message ? `<p class="message">${message}</p>` : ''}
          <h3>Zona peligrosa</h3>
          <button class="danger" data-menu="reset">${confirmReset ? '¿Seguro? Se borrará todo' : 'Borrar la partida'}</button>
          <div class="menu-buttons">${back(previous())}</div>`;
      case 'help':
        return `<h2>${ui('question')} Cómo jugar</h2>${HELP_HTML}<div class="menu-buttons">${back(previous())}</div>`;
      case 'credits':
        return `<h2>${ui('trophy')} Créditos</h2>
          <p>Inspirado en <b>Market Street</b> (Playdom, Facebook, 2010–2011).</p>
          <p>Muebles, personajes y quesos modelados en 3D para este juego. Productos, iconos y vehículos:
          <b>Microsoft Fluent Emoji</b> (licencia MIT).</p>
          <p>Hecho con Phaser 3, TypeScript y three.js.</p>
          <div class="menu-buttons">${back('start')}</div>`;
    }
  };

  /** A dónde vuelven Ajustes y Ayuda: al inicio si se abrieron desde ahí, si no a la pausa. */
  let origin: Screen = 'start';
  const previous = () => origin;

  const toggle = (key: 'weatherFx' | 'dayNightFx' | 'labels', label: string) =>
    `<label class="switch"><input type="checkbox" data-setting="${key}" ${settings[key] ? 'checked' : ''}><span></span>${label}</label>`;

  overlay.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const key = el.dataset.setting;
    if (key === 'volume') updateSettings({ volume: Number(el.value) / 100 });
  });
  overlay.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    const key = el.dataset.setting as 'weatherFx' | 'dayNightFx' | 'labels' | 'volume' | undefined;
    if (key === 'volume') sfx.coin();
    else if (key) {
      updateSettings({ [key]: el.checked });
      sfx.click();
    }
  });

  overlay.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-menu]');
    if (!el) return;
    sfx.unlock();
    sfx.click();
    const action = el.dataset.menu!;
    switch (action) {
      case 'resume':
        open(null);
        break;
      case 'start':
      case 'pause':
        origin = action as Screen;
        open(action as Screen);
        break;
      case 'newGame':
      case 'credits':
        open(action as Screen);
        break;
      case 'settings':
      case 'help':
        if (screen === 'start' || screen === 'pause') origin = screen;
        open(action as Screen);
        break;
      case 'create': {
        const name = overlay.querySelector<HTMLInputElement>('#store-name')?.value.trim() || 'Market Street';
        controller.newGame(name);
        saveExists = true;
        sfx.levelUp();
        open(null);
        break;
      }
      case 'rename': {
        const name = overlay.querySelector<HTMLInputElement>('#rename')?.value ?? '';
        controller.renameStore(name);
        message = `Ahora la tienda se llama «${esc(controller.state.storeName)}».`;
        render();
        break;
      }
      case 'export':
        exportCode = controller.exportSave();
        void navigator.clipboard?.writeText(exportCode).catch(() => {});
        message = 'Código copiado. Guárdalo en un lugar seguro.';
        render();
        break;
      case 'import': {
        const code = overlay.querySelector<HTMLTextAreaElement>('#import-code')?.value ?? '';
        message = code.trim() && controller.importSave(code) ? '¡Partida cargada!' : 'Ese código no es válido.';
        render();
        break;
      }
      case 'reset':
        if (!confirmReset) {
          confirmReset = true;
          render();
        } else {
          controller.reset();
          saveExists = false;
          open('start');
        }
        break;
    }
  });

  // Escape abre o cierra la pausa durante la partida.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (screen === null) {
      origin = 'pause';
      open('pause');
    } else if (screen === 'pause') open(null);
  });

  render();
  controller.setPaused(true);
  return {
    openPause: () => {
      origin = 'pause';
      open('pause');
    },
  };
}
