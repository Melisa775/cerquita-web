# Cerquita

Juegos en español para parejas a distancia. Uno crea una sala, le envía el código a su pareja y juegan sincronizados en tiempo real mientras hablan por videollamada. Gratis, sin descargas y sin cuentas.

<!-- Agrega aquí un GIF jugando una ronda y el enlace a la demo en vivo -->

Este repositorio es el frontend. El backend está en [cerquita-api](https://github.com/Melisa775/cerquita-api).

## Por qué existe

Tengo una relación a distancia. Las páginas de "citas virtuales" que probamos eran listas de enlaces a otros sitios: varios juegos no cargaban, otros pedían pago y casi nada estaba en español. Juegos sencillos como recordar un color, Stop o un Wordle para dos no se podían jugar juntos en línea. Cerquita es el lugar donde esos juegos funcionan.

## Juegos

| Juego | Estado |
| --- | --- |
| Color de memoria: ven un color unos segundos y cada uno lo recrea de memoria; niveles Normal, Difícil y Experto | Disponible |
| Stop clásico: sale una letra y llenan nombre, apellido, ciudad, fruta, color, animal y cosa; el primero que termina canta ¡Stop! Revisa la ortografía y sugiere correcciones | Disponible |
| Stop contrarreloj (estilo Too Late): por turnos dicen una palabra de la categoría y tocan su letra antes de que se acabe el tiempo | Disponible |
| Enredo de letras (estilo Boggle): unen letras vecinas en un tablero de dados para armar palabras contra el reloj | Disponible |
| Ahorcado: se turnan para elegir una palabra con pista, o Cerquita elige una al azar y la adivinan juntos | Disponible |
| Wordle a dúo: en duelo (la misma palabra, cada uno en su tablero) o juntos (un tablero, por turnos) | Disponible |
| Sopa de letras: la misma sopa para los dos, en carrera o juntos contra el reloj, con tres niveles | Disponible |
| Adivina quién: 24 personajes propios; las preguntas de la lista las responde la app y las escritas las responde la pareja | Disponible |

## Decisiones técnicas

- **El cliente solo pinta.** El servidor envía una foto completa del estado de la sala en cada cambio; el frontend no calcula reglas del juego, solo las muestra. Eso elimina toda una clase de errores de sincronización.
- **Reconexión automática** con espera exponencial si se cae la conexión (`src/hooks/useRoom.js`).
- **Cuenta regresiva sin depender del reloj del otro.** El servidor envía cuántos milisegundos quedan, no una hora absoluta, así funciona aunque los relojes de los dos computadores no coincidan.
- **Selector de color propio.** Tres deslizadores (tono, saturación, brillo) cuya pista muestra el gradiente real del canal según los otros dos valores.
- **Diseño con identidad por jugador.** Cada persona tiene su color en toda la interfaz; el fondo es un gris neutro para no alterar la percepción del color en el juego.
- **Stop sin trampas ni pérdidas.** Mientras escriben, el servidor solo cuenta cuántas casillas lleva cada uno; las respuestas se ven al cerrar la ronda. Cuando alguien canta ¡Stop!, los clientes bloquean sus casillas y mandan lo último que escribieron, y el borrador se guarda en el navegador por si se recarga la página.
- **Tablero táctil.** En Enredo de letras se arrastra el dedo por las letras o se tocan una por una; la zona sensible de cada dado es un círculo interior para que los movimientos en diagonal no marquen vecinos sin querer. En computador también se puede escribir la palabra y el tablero resalta el camino.
- **Ahorcado dibujado a mano en SVG.** Cada error traza una parte del muñeco (se anima el trazo con `pathLength`), la cara cambia según las vidas que quedan y, si adivinan, el muñeco se baja de la horca y celebra. Quien eligió la palabra la ve completa, con las letras que faltan en tenue; quien adivina solo ve las que ya encontró.
- **Wordle en tiempo real.** En duelo, cada uno ve los colores del tablero del otro mientras juega, pero no sus letras. Juntos, el que no tiene el turno ve en vivo lo que el otro va escribiendo. Las fichas giran al revelar los colores y la fila tiembla si la palabra no existe.
- **Sopa de letras compartida.** Se marca arrastrando de una punta a la otra (la línea se ajusta sola a horizontal, vertical o diagonal) o tocando las dos puntas. Mientras uno arrastra, el otro ve en vivo por dónde va. Las palabras encontradas quedan resaltadas con una cápsula en SVG del color de quien las encontró.
- **Personajes dibujados con código.** Los 24 personajes de Adivina quién son originales: cada uno es un SVG que se arma a partir de sus rasgos (pelo, color de ojos, gafas, gorra o sombrero vueltiao, barba, aretes, pecas). Las cartas se voltean en 3D al bajarlas.
- **La sala vive en la URL** (`?sala=ABCDE`), así el enlace se puede compartir y funciona en cualquier hosting estático sin reglas de reescritura.

## Stack

React 19, Vite, Tailwind CSS v4, WebSockets nativos.

## Correrlo en local

Necesitas Node 20+ y el backend [cerquita-api](https://github.com/TU_USUARIO/cerquita-api) corriendo en `localhost:8000`.

```bash
npm install
npm run dev
```

Abre http://localhost:5173 en dos ventanas (una en incógnito) para jugar como dos personas. En desarrollo, Vite redirige `/api` y `/ws` al backend local.

## Desplegar

Es un sitio estático (Vercel, Netlify, Cloudflare Pages):

- **Comando de build:** `npm run build`
- **Carpeta de salida:** `dist`
- **Variable de entorno:** `VITE_API_URL` con la URL pública del backend, por ejemplo `https://cerquita-api.onrender.com`

Recuerda poner la URL del frontend en `CORS_ORIGINS` del backend.

## Estructura

```
src/
  pages/        inicio y sala
  games/        un componente por juego
  hooks/        conexión en tiempo real y cuenta regresiva
  components/   selector de color, tarjetas del lobby, barra de tiempo
  lib/          API, colores, letras, caminos del tablero, almacenamiento local
```

## Hoja de ruta

- [x] Salas con código y enlace para compartir
- [x] Color de memoria
- [x] Stop clásico y Stop contrarreloj
- [x] Enredo de letras
- [x] Ahorcado
- [x] Wordle a dúo
- [x] Sopa de letras compartida
- [x] Adivina quién
- [ ] Control compartido para ver películas al mismo tiempo
- [x] Despliegue público
