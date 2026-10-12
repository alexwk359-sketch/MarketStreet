# Market Street

Un juego de gestión de tiendas inspirado en *Market Street* (Playdom, Facebook, 2010–2011).
La investigación sobre el original y el diseño están en [`docs/investigacion-market-street.md`](docs/investigacion-market-street.md).

## Prototipo jugable

- Tienda isométrica de 10×8 casillas con caja registradora.
- **Pedidos con temporizador:** toca un expositor, pide mercancía y espera al camión 🚚.
- **Expositores por tipo:** perchero (ropa), estantería (ferretería) y vitrina (electrónica).
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
| `docs/` | Investigación y diseño. |

Para ajustar precios, tiempos o añadir artículos, edita `src/sim/catalog.ts`.

Desde la consola del navegador, `marketStreet.controller.state` muestra el estado de la partida.
