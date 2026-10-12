import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para poder publicar `dist/` en cualquier hosting estático.
  base: './',
  // Phaser ocupa ~1 MB por sí solo; no es un problema para este juego.
  build: { chunkSizeWarningLimit: 1500 },
});
