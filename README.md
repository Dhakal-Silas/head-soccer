# Head Soccer 3D

A fast, arcade head-soccer game rendered in 3D with Three.js. Ten famous
players, five CPU difficulty levels, local two-player, configurable win
conditions and an eight-player knockout tournament.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).
`npm run build` produces a static bundle in `dist/`.

## Controls

| Action | Player 1 | Player 2 |
| ------ | -------- | -------- |
| Move   | A / D    | ← / →    |
| Jump   | W        | ↑        |
| Kick   | S, F or Space | ↓, / or Enter |
| Pause  | Esc or P | Esc or P |

On the player-select screen the same keys browse the roster, Enter starts.

## Features

- **Quick Match** – 1 player vs CPU or 2 players on one keyboard.
- **Win conditions** – most goals within 1/2/3/5 minutes (optional golden
  goal when tied) or first to 3/5/7/10 goals.
- **Five CPU levels** – Rookie, Amateur, Pro, Star, Legend. Each level changes
  reaction time, prediction accuracy, speed and how often the CPU commits to
  jumps and kicks.
- **Roster of 10** – Mbappé, Ronaldo, Messi, Ronaldinho, Yamal, Neymar,
  Haaland, Bellingham, Vinícius and Modrić, each with their own speed, jump,
  power, head size and ball control, plus a distinct look.
- **Tournament** – 8-player knockout (quarter-finals, semis, final). One or two
  humans are seeded in opposite halves; CPU-only ties are simulated.
- **Expressions** – faces react to scoring, conceding, hard headers, hitting
  the post, leading, trailing, winning and losing, with celebration and sulk
  animations.
- **Procedural everything** – faces, jerseys, pitch, crowd and sound effects
  are generated at runtime; there are no binary assets.

## Project layout

```
index.html         page shell and menu markup
src/main.js        controller / game loop / state machine
src/physics.js     fixed-step 2D simulation (ball, players, goals)
src/ai.js          CPU brain with the five difficulty profiles
src/render.js      Three.js scene, camera, ball, previews
src/avatar.js      player model + procedural animation
src/faces.js       canvas face textures and portraits
src/stadium.js     pitch, goals, stands, lights, sky
src/effects.js     confetti and dust particles
src/tournament.js  bracket logic
src/ui.js          menus, HUD, banners
src/audio.js       WebAudio sound synthesis
src/config.js      tuning constants, roster, difficulty table
```
