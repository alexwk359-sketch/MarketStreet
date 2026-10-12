import Phaser from 'phaser';
import { Controller } from './game/controller';
import { StoreScene } from './game/StoreScene';
import { mountUi } from './game/ui';
import { loadGame } from './sim/save';
import './style.css';

const controller = new Controller(loadGame(Date.now()));
mountUi(controller);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#3d5a80',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  banner: false,
});
game.scene.add('store', StoreScene, true, { controller });

const saveNow = () => controller.save();
window.addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});

// Acceso desde la consola del navegador para depurar y para los tests de humo.
Object.assign(window, { marketStreet: { controller, game } });
