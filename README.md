# Cerquita

Spanish-language games for long-distance couples. One person creates a room, sends the code to their partner, and they play in real-time sync while talking on a video call. Free, with no downloads and no accounts.

<!-- Add a GIF of a round being played and the link to the live demo here -->

This repository is the frontend. The backend lives in [cerquita-api](https://github.com/Melisa775/cerquita-api).

## Why it exists

I'm in a long-distance relationship. The "virtual date" pages we tried were lists of links to other sites: several games didn't load, others asked for payment, and almost nothing was in Spanish. Simple games like remembering a color, Stop or a two-player Wordle couldn't be played together online. Cerquita is the place where those games work.

## Games

The games themselves are in Spanish; the names below are the ones shown in the app.

| Game | Status |
| --- | --- |
| Color de memoria (color memory): you see a color for a few seconds and each player recreates it from memory; Normal, Hard and Expert levels | Available |
| Stop clásico: a letter comes up and you fill in first name, surname, city, fruit, color, animal and thing; whoever finishes first calls Stop! Checks spelling and suggests corrections | Available |
| Stop contrarreloj (Too Late-style): take turns saying a word from the category and tapping its letter before time runs out | Available |
| Enredo de letras (Boggle-style): link neighboring letters on a dice board to make words against the clock | Available |
| Ahorcado (hangman): take turns choosing a word with a hint, or Cerquita picks one at random and you guess it together | Available |
| Wordle a dúo: as a duel (same word, each on their own board) or as a team (one board, taking turns) | Available |
| Sopa de letras (word search): the same puzzle for both, racing or together against the clock, with three levels | Available |
| Adivina quién (Guess Who): 24 original characters; the app answers questions from the list and the partner answers free-text ones | Available |
| Pinturillo: one draws and the other guesses; the drawing is shown live and all drawings are kept at the end | Available |
| Caras y gestos (charades): one acts in front of the camera and the other guesses out loud, against the clock | Available |
| Murdoku: sudoku with a murder; place the suspects on the floor plan following the clues to find the murderer | Available |
| Trivia (Preguntados-style): a wheel with six categories and three levels; take turns collecting crowns or race in a duel | Available |
| Ajedrez (chess): full game with custom pieces, drag or tap, optional clock, draws, undo and rematch | Available |
| Batalla naval (battleship): each player hides their fleet and you take turns firing until one fleet is sunk | Available |
| Dominó: double-six for two, with or without drawing from the boneyard, hands until someone reaches the goal | Available |
| Parqués: Colombian-style, with two dice, leaving jail on doubles, safe squares, capturing pieces and a reward for the third double | Available |
| Palabras cruzadas (Scrabble-style): seven letters each, a board with premium squares, blank tiles and dictionary checking | Available |
| Una (UNO-style): original cards, action cards, wild cards, "¡Una!" with a penalty if you get caught, and optional stacking | Available |
| Mini golf (Plato-style): pull back to shoot, nine holes with bumpers, sand, water, slopes and portals; the partner sees the aim live | Available |
| Colonos (Catan-style): random island, build roads, settlements and cities, robber, trading and development cards | Available |
| Mazmorras: cooperative fantasy role-play with a d20 (inspired by classic tabletop RPGs): pick a class, explore rooms, disarm traps and fight turn-based battles in 3D; the Dungeon Master is the system or a person, bot companions can join, and a rulebook is always one tap away | Available |
| Más cerca: question cards to know each other better and connect, in three levels (icebreaker, deep and deeper) plus wildcards; going deeper needs both to agree, and it ends with a letter to each other that's revealed at the same time | Available |

## Technical decisions

- **The client only renders.** The server sends a full snapshot of the room state on every change; the frontend doesn't compute game rules, it only displays them. That removes a whole class of sync bugs.
- **Automatic reconnection** with exponential backoff if the connection drops (`src/hooks/useRoom.js`).
- **Countdowns that don't rely on the other player's clock.** The server sends how many milliseconds are left, not an absolute time, so it works even if the two computers' clocks disagree.
- **Custom color picker.** Three sliders (hue, saturation, brightness) whose track shows the channel's real gradient given the other two values.
- **Per-player identity in the design.** Each person has their own color throughout the interface; the background is a neutral gray so it doesn't affect color perception in the game.
- **Stop without cheating or lost answers.** While players write, the server only counts how many boxes each one has filled; answers are shown when the round closes. When someone calls Stop!, clients lock their boxes and send whatever they last typed, and the draft is saved in the browser in case the page reloads.
- **Touch-friendly board.** In Enredo de letras you drag a finger across the letters or tap them one by one; each die's hit area is an inner circle so diagonal moves don't select neighbors by accident. On a computer you can also type the word and the board highlights the path.
- **Hand-drawn hangman in SVG.** Each mistake draws in a part of the figure (the stroke is animated with `pathLength`), the face changes with the lives left and, on a win, the figure climbs down from the gallows and celebrates. Whoever chose the word sees it in full, with the missing letters faded; the guesser only sees the letters already found.
- **Real-time Wordle.** In duel mode, each player sees the colors of the other's board while playing, but not their letters. In team mode, the player not on turn sees live what the other is typing. Tiles flip when the colors are revealed and the row shakes if the word doesn't exist.
- **Shared word search.** You mark a word by dragging from one end to the other (the line snaps to horizontal, vertical or diagonal) or by tapping both ends. While one player drags, the other sees the selection live. Found words are highlighted with an SVG capsule in the color of whoever found them.
- **Characters drawn in code.** The 24 Guess Who characters are originals: each one is an SVG built from its traits (hair, eye color, glasses, cap or sombrero vueltiao, beard, earrings, freckles). Cards flip in 3D when you flip them down.
- **Real-time drawing.** In Pinturillo, strokes are sent in small batches every 50 ms and the other player sees them appear on a `<canvas>` scaled to the screen's pixel density. Coordinates travel in a fixed 1000×750 space, so the drawing looks the same on a phone and on a computer.
- **Más cerca, a game without winners.** No score and no clock: a dealt card with the level's color, who answers, and a short listening tip for the other player ("no hace falta arreglar nada"). Moving to a deeper level or ending only happens when both players vote, and the closing letters stay sealed on the server until both are sent.
- **The room lives in the URL** (`?sala=ABCDE`), so the link can be shared and it works on any static host without rewrite rules.

## Stack

React 19, Vite, Tailwind CSS v4, native WebSockets.

## Running locally

You need Node 20+ and the [cerquita-api](https://github.com/Melisa775/cerquita-api) backend running on `localhost:8000`.

```bash
npm install
npm run dev
```

Open http://localhost:5173 in two windows (one incognito) to play as two people. In development, Vite proxies `/api` and `/ws` to the local backend.

## Deploying

It's a static site (Vercel, Netlify, Cloudflare Pages):

- **Build command:** `npm run build`
- **Output folder:** `dist`
- **Environment variable:** `VITE_API_URL` with the backend's public URL, for example `https://cerquita-api.onrender.com`

Remember to add the frontend's URL to the backend's `CORS_ORIGINS`.

## Structure

```
src/
  pages/        home and room
  games/        one component per game
  hooks/        real-time connection and countdown
  components/   color picker, lobby cards, timer bar
  lib/          API, colors, letters, board paths, local storage
```

## Roadmap

- [x] Rooms with a code and a shareable link
- [x] Color memory
- [x] Classic Stop and timed Stop
- [x] Enredo de letras
- [x] Hangman
- [x] Two-player Wordle
- [x] Shared word search
- [x] Guess Who
- [x] Pinturillo
- [x] Caras y gestos
- [x] Murdoku
- [x] Trivia
- [x] Chess
- [x] Battleship
- [x] Dominoes
- [x] Parqués
- [x] Crosswords
- [x] Una
- [x] Mini golf
- [x] Colonos
- [x] Más cerca
- [x] Mazmorras
- [x] Public deployment

## Author

Built by **Melisa Gomez Gomez** ([@Melisa775](https://github.com/Melisa775)).
