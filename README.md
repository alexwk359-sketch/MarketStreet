# Market Street

Un juego de gestión de tiendas inspirado en *Market Street* (Playdom, Facebook, 2010–2011).
La investigación sobre el original y el diseño están en [`docs/investigacion-market-street.md`](docs/investigacion-market-street.md).

## Qué se puede hacer

- **Tienda isométrica en una calle viva**, con acera, tráfico, peatones y el camión de reparto.
- **13 tipos de expositor y 117 artículos**, repartidos en dos secciones:
  - **Tienda:** ropa, ferretería, electrónica, juguetes y libros, accesorios, deportes.
  - **Alimentación:** frutería, verduras, panadería, nevera (lácteos y bebidas), quesería, carnicería, congelados.
- **Pedidos con temporizador.** El camión trae la mercancía y los productos se ven en el expositor, que se va vaciando a medida que se venden. Con diamantes, el pedido llega al instante.
- **Clientes con inteligencia.** Llegan por la acera, esquivan los muebles, buscan un artículo, hacen cola en la caja y pagan. Si no encuentran lo que buscan o la cola es muy larga, se van enfadados.
- **Clientes VIP** (con corona): pagan el triple y a veces dejan un diamante.
- **Tendencias:** cada pocos minutos una categoría se vende un 25% más cara.
- **Felicidad y propinas:** la felicidad sube con las ventas y la decoración, y atrae más clientes. Por encima del 70%, los clientes dejan propina.
- **Cajas registradoras** (hasta 3), cada una con su cajero o cajera animados.
- **Mejoras:** cajeros rápidos, reponedor automático, publicidad, camión exprés, almacén e hilo musical.
- **Tareas del encargado:** 34 objetivos que guían la partida y dan recompensas.
- **Ampliaciones del local** (de 10×8 a 16×12 casillas). Se pueden **mover y vender** muebles.
- **Decoración:** 18 objetos, 6 suelos y 6 colores de pared.
- **Progreso sin jugar:** mientras la partida está cerrada, los pedidos llegan y la tienda sigue vendiendo (a medio ritmo, hasta 4 horas).
- **Sonido** sintetizado, sin archivos de audio. Se puede silenciar.
- **Cámara:** se arrastra para mover la vista; la rueda o el pellizco hacen zoom. Funciona en móvil.

## Desarrollo

```bash
npm install
npm run dev        # servidor local con recarga en caliente
npm test           # tests de la simulación (Vitest)
npm run build      # typecheck + build de producción en dist/
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/sim/` | Lógica del juego en TypeScript puro, sin Phaser: catálogo, estado, simulación, caminos (`path.ts`), tareas, progreso sin jugar, guardado y tests. |
| `src/game/` | Render isométrico con Phaser 3: `StoreScene`, la calle (`street.ts`) y los efectos (`effects.ts`). Además, la interfaz en el DOM (`ui.ts`), el sonido (`sound.ts`) y el `Controller` que une todo. |
| `public/sprites/` | Todos los sprites del juego (ver *Gráficos*). |
| `scripts/` | Generadores de sprites. |
| `docs/` | Investigación y diseño. |

Para ajustar precios, tiempos o añadir artículos, edita `src/sim/catalog.ts`.
Desde la consola del navegador, `marketStreet.controller.state` muestra el estado de la partida.

## Gráficos

- **Muebles, cajas registradoras, decoración tipo mueble y quesos:** modelados en 3D para este juego en [`scripts/furniture/models.js`](scripts/furniture/models.js) (three.js). Se renderizan en vista isométrica 2:1, con luces y sombras, con:
  ```bash
  node scripts/render_furniture.mjs
  ```
  Para cambiar un mueble, edita su modelo y vuelve a ejecutar el script.
- **Productos, personas, coches, árboles e iconos:** [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) en estilo 3D, descargados y reducidos con:
  ```bash
  python3 scripts/fetch_assets.py
  ```

## Créditos

Los sprites de Fluent Emoji son © Microsoft Corporation, con licencia MIT ([`public/sprites/LICENSE-fluentui-emoji.txt`](public/sprites/LICENSE-fluentui-emoji.txt)).
Los modelos 3D de `scripts/furniture/` y sus renders son parte de este proyecto.
