# Market Street

Un juego de gestión de tiendas inspirado en *Market Street* (Playdom, Facebook, 2010–2011).
La investigación sobre el original y el diseño están en [`docs/investigacion-market-street.md`](docs/investigacion-market-street.md).

## Prototipo jugable

- Tienda isométrica de 10×8 casillas con caja registradora.
- **Pedidos con temporizador:** toca un expositor, pide mercancía y espera al camión 🚚.
- **20 artículos y 4 tipos de expositor:** perchero (ropa), estantería (ferretería), vitrina (electrónica) y mesa (juguetes y libros). Los productos se ven en el expositor y desaparecen a medida que se venden.
- **Animaciones:** los clientes caminan (con 12 aspectos distintos), piensan en lo que buscan, cogen el producto y pagan. Las monedas saltan de la caja y los pedidos caen sobre el expositor.
- **Clientes simulados** que buscan un artículo, lo cogen, hacen cola y pagan. Si no lo encuentran, se van enfadados.
- **Felicidad:** sube con las ventas y la decoración, baja con los clientes perdidos, y atrae más clientela.
- **Niveles:** desbloquean artículos y huecos para expositores.
- **Guardado automático** en el navegador. Los pedidos llegan aunque cierres el juego.

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
| `src/sim/` | Lógica del juego en TypeScript puro (sin Phaser): catálogo, estado, simulación, guardado y tests. |
| `src/game/` | Render isométrico con Phaser 3 (`StoreScene`), interfaz en el DOM (`ui.ts`) y el `Controller` que los une. |
| `public/sprites/` | Sprites del juego (ver *Créditos*). |
| `scripts/fetch_assets.py` | Descarga y reduce los sprites; edítalo para añadir más. |
| `docs/` | Investigación y diseño. |

Para ajustar precios, tiempos o añadir artículos, edita `src/sim/catalog.ts`.

Desde la consola del navegador, `marketStreet.controller.state` muestra el estado de la partida.

## Créditos

Los sprites de `public/sprites/` son [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (estilo 3D),
© Microsoft Corporation, con licencia MIT ([`public/sprites/LICENSE-fluentui-emoji.txt`](public/sprites/LICENSE-fluentui-emoji.txt)).
