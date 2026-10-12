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
- **8 tipos de cliente**, cada uno con su aspecto, su ritmo y sus gustos:
  - **Con lista de la compra:** recorren varios expositores y pagan todo junto.
  - **Niños:** rápidos e impacientes; van a por juguetes, dulces y helados.
  - **Abuelos:** lentos pero pacientes; compran fruta, verdura, pan y queso.
  - **Turistas:** pagan un 50% más por accesorios, deportes y productos típicos.
  - **VIP** (con corona): pagan el triple y a veces dejan un diamante.
  - **Críticos:** si salen contentos la tienda se hace viral durante unos minutos; si no, mala reseña.
  - **Ladrones:** cogen algo y huyen. Tócalos para atraparlos y recuperar lo robado.
- **Clima:** sol, nubes, lluvia, ola de calor y nieve. Cambian cuánta gente viene y qué busca (con calor, helados y bebidas; con frío, abrigos, pan y queso). Se ven lluvia y nieve en pantalla.
- **Día y noche:** un día dura 16 minutos. El mediodía trae más clientes y la noche menos; de noche se encienden las farolas y la tienda.
- **Encargos especiales:** el barrio pide muchas unidades de un artículo con plazo; se entregan desde la tarjeta del encargo para una gran recompensa.
- **Tendencias:** cada pocos minutos una categoría se vende un 25% más cara.
- **Felicidad y propinas:** la felicidad sube con las ventas y la decoración, y atrae más clientes. Por encima del 70%, los clientes dejan propina.
- **Cajas registradoras** (hasta 3), cada una con su cajero o cajera animados.
- **Mejoras:** cajeros rápidos, reponedor automático, publicidad, camión exprés, almacén e hilo musical.
- **Tareas del encargado:** 40 objetivos que guían la partida y dan recompensas.
- **Ampliaciones del local** (de 10×8 a 16×12 casillas). Se pueden **mover y vender** muebles.
- **Decoración:** 21 objetos (incluidos globos, calabaza y muñeco de nieve), 6 suelos y 6 colores de pared.
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
| `src/sim/` | Lógica del juego en TypeScript puro, sin Phaser: catálogo, estado, simulación, caminos (`path.ts`), tipos de cliente (`archetypes.ts`), clima y hora (`world.ts`), encargos (`orders.ts`), tareas, progreso sin jugar, guardado y tests. |
| `src/game/` | Render isométrico con Phaser 3: `StoreScene`, la calle (`street.ts`), el clima y la luz (`atmosphere.ts`) y los efectos (`effects.ts`). Además, la interfaz en el DOM (`ui.ts`), el sonido (`sound.ts`) y el `Controller` que une todo. |
| `public/sprites/` | Todos los sprites del juego (ver *Gráficos*). |
| `scripts/` | Generadores de sprites. |
| `docs/` | Investigación y diseño. |

Para ajustar precios, tiempos o añadir artículos, edita `src/sim/catalog.ts`.
Desde la consola del navegador, `marketStreet.controller.state` muestra el estado de la partida.

## Gráficos

- **Muebles, cajas registradoras, decoración tipo mueble y quesos:** modelados en 3D para este juego en [`scripts/furniture/models.js`](scripts/furniture/models.js) (three.js) y renderizados en vista isométrica 2:1, con luces y sombras.
- **Clientes, peatones y cajeros:** personajes 3D propios ([`scripts/furniture/characters.js`](scripts/furniture/characters.js)) en hojas de sprites animadas:
  - 24 clientes distintos (piel, pelo, ropa, gafas, gorras, mochilas…), con ciclo de caminar de 8 fotogramas, de frente y de espaldas, más las poses quieto y alcanzar un estante.
  - Personajes propios para cada tipo de cliente: niños, abuelos (algunos con bastón), turistas (sombrero de paja y cámara), críticos (boina y bufanda) y ladrones (antifaz, rayas y saco).
  - 6 cajeros con el uniforme de la tienda, que esperan, escanean al cobrar y saludan al terminar.

  Todo lo modelado se genera con:
  ```bash
  node scripts/render_furniture.mjs                 # todo
  node scripts/render_furniture.mjs --only=people   # solo personajes
  ```
- **Productos, coches, árboles e iconos:** [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) en estilo 3D, descargados y reducidos con:
  ```bash
  python3 scripts/fetch_assets.py
  ```

## Créditos

Los sprites de Fluent Emoji son © Microsoft Corporation, con licencia MIT ([`public/sprites/LICENSE-fluentui-emoji.txt`](public/sprites/LICENSE-fluentui-emoji.txt)).
Los modelos 3D de `scripts/furniture/` (muebles, quesos y personajes) y sus renders son parte de este proyecto.
