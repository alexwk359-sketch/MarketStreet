# Investigación: *Market Street* (Playdom, Facebook, 2010–2011)

> Objetivo: entender qué era Market Street y qué lo hacía funcionar, para diseñar un juego similar.
> Leyenda: **[Confirmado]** = aparece en fuentes de la época. **[Inferido]** = convención típica del género, no verificado para este juego concreto.

## 1. Ficha

| Dato | Valor |
|---|---|
| Desarrollador | Playdom (comprada por Disney en julio de 2010 por ~763 M USD) |
| Plataforma | Facebook (Flash, vista isométrica) |
| Lanzamiento | Julio de 2010 (página de fans visible el 19-jul; preview de Gamezebo del 26-jul) |
| Género | Simulador / tycoon de tienda departamental, juego social |
| Pico | Más de 9 M de usuarios activos mensuales y más de 1 M diarios (2010) |
| Cierre | Agosto de 2011, ya con unos 460 mil MAU. Fue el 7.º juego que cerró Playdom y no se dio ningún motivo |
| Competidores directos | Mall World, Retail Therapy, Restaurant City, Café World |

## 2. Bucle principal de juego

```
Pedir mercancía (camión, con timer) ─► Recibirla ─► Colocarla en el expositor correcto
        ▲                                                         │
        │                                                         ▼
Reinvertir monedas ◄─ Cobrar en la caja ◄─ Los clientes compran (si hay stock)
```

### Mecánicas documentadas
- **[Confirmado] Tienda departamental mixta:** se podía vender ropa, ferretería, electrónica o una mezcla de las tres. Era más "neutral en género" que Mall World, que se centraba solo en moda.
- **[Confirmado] Inicio pequeño:** se empezaba con un mostrador (caja) y un expositor. El menú *Registers and Displays* servía para colocar más, y el límite subía al ganar niveles o ampliar el local.
- **[Confirmado] Pedidos con tiempo de espera:** la mercancía llegaba en camión tras un tiempo (desde unos 3 minutos para los artículos baratos). Los artículos de gama alta tardaban más y se desbloqueaban más tarde.
- **[Confirmado] Caducidad del stock:** la mercancía podía "expirar", así que convenía pedir solo lo necesario y reponer antes de quedarse sin nada.
- **[Confirmado] Tipo de estantería:** cada artículo indicaba qué tipo de expositor necesitaba (por ejemplo, perchero o vitrina).
- **[Confirmado] Clientes y satisfacción:** si los estantes estaban vacíos, los clientes se iban descontentos. La decoración (plantas y otros objetos) subía la *store happiness*, es decir, la satisfacción.
- **[Confirmado] Monedas y progreso:** había *coins* (moneda blanda), *crowns* (casi seguro la moneda premium, de pago), XP con niveles y *store happiness*.
- **[Confirmado] Objetivos:** el *Manager's Clipboard* era una lista de "To Dos" (decorar, tener X artículos en stock...) que se desbloqueaban al subir de nivel y daban bonos en efectivo.
- **[Confirmado] Componente social:** se podía contratar a amigos de Facebook para atender la caja, y en niveles altos había más cajas. Invitar amigos daba bonos para "tu calle".
- **[Confirmado] Decoración:** la tienda isométrica se decoraba libremente.
- **[Inferido]** Visitar las tiendas de amigos, regalos diarios, publicaciones en el muro para pedir ayuda y aceleradores de pago para los timers. Eran estándar en los juegos de Playdom y Zynga de 2010, pero no encontré fuentes que lo confirmen para Market Street.

## 3. Por qué creció y por qué murió (análisis)

**Lo que funcionó:**
- Un bucle de "plantar y cosechar" (como FarmVille) disfrazado de tienda: los timers cortos y largos hacían que el jugador volviera varias veces al día.
- Fantasía accesible: ser dueño de una tienda, decorarla y verla llena de clientes.
- Crecimiento viral por Facebook (invitaciones, empleados amigos) en el mejor momento de los juegos sociales.

**Lo que falló (según la crítica de la época y el contexto):**
- La crítica lo describía como "nada único, pero bien hecho". Se parecía demasiado a Mall World o Café World y no tenía un gancho propio.
- Pasó de 9 M a 0,46 M de MAU en un año: retención débil a medio plazo una vez dominado el bucle.
- 2011 fue el colapso del canal viral de Facebook, y Disney/Playdom recortó su catálogo.

**Lección para nuestro juego:** el bucle de pedido → stock → venta es sólido, pero hace falta **un gancho diferencial** y **progresión a largo plazo** (metas, colecciones, eventos, una calle compartida...).

## 4. Propuesta de juego similar (borrador)

### Concepto
"Market Street" moderno: gestionas una tienda en una calle comercial compartida con otros jugadores (o con vecinos de IA en el modo para un jugador). Funciona en el navegador y en el móvil.

### Mecánicas principales (MVP)
1. **Pedidos con timer:** catálogo por categorías (ropa, ferretería, electrónica, juguetes...), con coste, tiempo de entrega, cantidad, margen y caducidad.
2. **Expositores tipados:** cada artículo requiere un tipo de mueble. La cuadrícula isométrica es ampliable.
3. **Clientes simulados:** llegan según la popularidad. Cada uno busca una categoría y se va si no hay stock (penaliza la satisfacción). Hacen cola en las cajas.
4. **Satisfacción:** sube con la decoración, la variedad y la velocidad de la caja, y multiplica la llegada de clientes y las propinas.
5. **Progresión:** XP y niveles que desbloquean artículos, muebles y ampliaciones, más una lista de tareas al estilo del *Manager's Clipboard*.
6. **Economía:** monedas blandas. Una moneda premium es opcional y no debería ser obligatoria para progresar.

### Ganchos diferenciales (para evitar el error del original)
- **Calle viva:** tu tienda comparte calle con otras. Las tiendas complementarias atraen clientes entre sí (por ejemplo, una cafetería junto a una librería).
- **Tendencias y demanda dinámica:** eventos temporales ("vuelta al cole", "ola de calor") que cambian qué se vende.
- **Pedidos especiales de clientes VIP**, con recompensas únicas.
- **Empleados con habilidades** (rapidez, ventas adicionales, reponedor), que pueden ser amigos o personajes no jugadores.
- **Progreso fuera de línea limitado:** la tienda vende mientras no estás, pero el stock se acaba. Esto incentiva volver sin castigar.

### Stack técnico sugerido
- **Cliente:** TypeScript con Phaser 3 (o PixiJS) para el render isométrico 2D. Funciona en el navegador y se puede empaquetar para móvil con Capacitor.
- **Estado y simulación:** una lógica de simulación determinista basada en marcas de tiempo (*timestamps*), separada del render para poder testearla.
- **Backend (fase 2):** Supabase o Firebase para cuentas, guardado en la nube y la calle compartida. Al principio basta con `localStorage`.

### Hoja de ruta
1. **Prototipo:** cuadrícula, 1 caja, 2 expositores, 6 artículos, pedidos con timer, clientes y monedas.
2. **Vertical slice:** decoración, satisfacción, niveles, tareas, ampliación y guardado.
3. **Social:** calle compartida, visitas y regalos.
4. **Contenido y eventos:** más categorías, tendencias y temporadas.

## Fuentes
- [Gamezebo – Market Street Preview (26-jul-2010)](https://www.gamezebo.com/upcoming/market-street-preview/)
- [Gamezebo – Market Street Walkthrough](https://www.gamezebo.com/walkthroughs/market-street-walkthrough/)
- [Gamezebo – Playdom's Market Street closes up shop](https://www.gamezebo.com/news/playdoms-market-street-closes-up-shop/)
- [Yahoo/Games.com – Market Street becomes the seventh Playdom game to shut down (17-ago-2011)](https://www.yahoo.com/lifestyle/2011-08-17-playdom-closes-market-street-down.html)
- [AOL/Games.com – Sneak preview: Playdom's next game is Market Street (19-jul-2010)](https://www.aol.com/news/2010-07-19-sneak-preview-playdoms-next-game-is-market-street.html)
- [AOL – Top 10 fastest growing Facebook games (31-jul-2010)](https://www.aol.com/news/2010-07-31-top-10-fastest-growing-facebook-games-this-week.html)
- [Adweek – Building a Better Business With Playdom's Market Street](https://www.adweek.com/performance-marketing/playdom’s-market-street-on-facebook/)
- [Game Yum – Market Street Game Guide](https://www.gameyum.com/other-strategy-games/84321-market-street-game-guide-play-shopping-on-facebook/)
- [Wikipedia – Playdom](https://en.wikipedia.org/wiki/Playdom)
- [YouTube – Frisky Hands-On: Playdom Launches Market Street](https://www.youtube.com/watch?v=BduzqjQvxkY)
- [Facebook – Página oficial de Market Street](https://www.facebook.com/PlayMarketStreet/)
