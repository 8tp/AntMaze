# Ant Maze — Game Specification

## Overview

A browser-based maze game inspired by classic Scratch projects. The player controls an ant that is **perpetually moving forward** in its current direction. The player uses arrow keys to steer the ant through procedurally generated mazes. Touching any wall instantly resets the ant to the start of the current level. Completing a level advances to the next, harder maze.

The core tension: the ant never stops, so the player must think and react quickly to navigate tight corridors without clipping a wall.

---

## Core Mechanics

### Movement
- The ant moves forward automatically at a constant speed every frame.
- Arrow keys (↑ ↓ ← →) change the ant's **facing direction** immediately.
- The ant's sprite rotates to face the current direction.
- Movement is tile-aligned in feel but smooth in motion — the ant glides between tiles rather than snapping.
- Speed increases slightly with each level (base: ~120px/s, +8px/s per level, capped at ~200px/s).

### Collision
- The ant's hitbox is a small circle centered on the sprite (roughly 60% of tile size) to give the player a forgiving but fair feel.
- **Wall collision = instant reset.** The ant teleports back to the level's start tile, facing the initial direction, with a brief "poof" particle effect and a screen shake.
- No health, no lives, no death limit — infinite retries per level.

### Level Progression
- Each level is a single maze.
- A **goal marker** (e.g., a crumb, leaf, or small hill) sits at the maze exit.
- Reaching the goal triggers a short celebration (confetti particles, score tally) and loads the next level after a 1.5s delay.
- Levels get harder via: larger grid size, faster ant speed, and more complex maze generation.

### Scoring
- **Time bonus:** Faster completion = more points. Base 1000 pts minus elapsed seconds × 10 (minimum 100).
- **Streak bonus:** Completing a level without any wall hits grants a 1.5× multiplier.
- **Level bonus:** +500 × level number.
- Running score displayed in the HUD.

---

## Level Design

### Maze Generation (Recursive Backtracker)
- Grid-based mazes using the recursive backtracker (depth-first search) algorithm.
- This produces long, winding corridors with a guaranteed solution path — a good fit for perpetual-motion gameplay.
- **Level 1:** 7×7 grid. **Level 2:** 9×9. **Level 3+:** 11×11, 13×13, etc., up to a max of 21×21.
- Start position: top-left region. Goal position: bottom-right region.
- Walls rendered as solid brown/earth-toned blocks. Paths are lighter dirt/sand colored.

### Visual Theming
- **Underground/earth tone palette.** Think ant tunnels: warm browns, tans, dark soil, occasional roots or pebbles as decorative sprites.
- The maze "floor" has a subtle dirt texture or noise pattern.
- Walls have a slightly darker, raised look (simple drop shadow or border) to visually separate them from paths.

---

## UI / HUD

### In-Game HUD (minimal, non-intrusive)
- **Top-left:** Current level number (`Level 3`).
- **Top-center:** Elapsed time for current level (counts up: `0:12.4`).
- **Top-right:** Total score.
- **Bottom-center:** Streak indicator — a small icon (fire/star) that appears if the player hasn't hit a wall this level.

### Screens
1. **Title Screen:** Game logo ("Ant Maze"), animated ant walking across the screen, "Press any key to start" prompt.
2. **Game Screen:** The maze with HUD overlay.
3. **Level Complete Overlay:** Semi-transparent overlay showing time, points earned, streak status. Auto-advances after 1.5s or on keypress.
4. **Game Over / High Score Screen:** Shown if the player chooses to quit (Escape key) or after a final level. Shows total score and level reached. "Play Again" button.

---

## Audio (Optional / Stretch)

- Soft ambient loop (underground hum).
- Footstep tick synced to movement.
- Wall-hit sound (thud/crunch).
- Level-complete jingle.
- All audio via the Web Audio API or Howler.js. Can be toggled with an (M) mute button.

---

## Controls

| Input | Action |
|---|---|
| ↑ / W | Face up |
| ↓ / S | Face down |
| ← / A | Face left |
| → / D | Face right |
| Escape | Pause / Quit to title |
| M | Toggle mute |
| Any key (title) | Start game |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Language** | TypeScript | Type safety, great DX, catches bugs early |
| **Bundler** | Vite | Fast HMR, zero-config TS support, instant dev server |
| **Rendering** | HTML5 Canvas (2D context) | Simple, performant for 2D tile games, no framework overhead |
| **Game Loop** | Custom `requestAnimationFrame` loop with delta-time | Standard pattern, smooth frame-rate-independent movement |
| **State Management** | Plain TS classes/modules | No need for React/Redux — game state is simple and frame-driven |
| **Maze Generation** | Custom recursive backtracker | Well-documented algorithm, produces good mazes, easy to implement |
| **Audio (stretch)** | Howler.js (optional) | Simple API, handles cross-browser quirks |
| **Testing** | Vitest | Pairs with Vite, fast, good TS support |
| **Deployment** | Static files (Vite build) | Deploy anywhere: Netlify, Vercel, GitHub Pages |

---

## Project Structure

```
ant-maze/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── fonts/
├── src/
│   ├── main.ts             # Entry point, canvas setup, starts game
│   ├── game.ts             # Game class — owns the loop, state machine
│   ├── maze.ts             # Maze generation + grid data structure
│   ├── player.ts           # Ant entity — position, direction, movement
│   ├── renderer.ts         # All Canvas drawing logic
│   ├── input.ts            # Keyboard input handler
│   ├── collision.ts        # Wall collision detection
│   ├── hud.ts              # Score, timer, level display
│   ├── particles.ts        # Simple particle system (wall hit, level clear)
│   ├── screens.ts          # Title, level-complete, game-over screens
│   ├── scoring.ts          # Score calculation logic
│   ├── constants.ts        # Tuning values (speeds, sizes, colors)
│   └── types.ts            # Shared TypeScript types/interfaces
└── tests/
    ├── maze.test.ts
    ├── collision.test.ts
    └── scoring.test.ts
```

---

## Design Reference

### Color Palette

| Element | Hex | Usage |
|---|---|---|
| Wall | `#5C3A1E` | Maze walls (dark wood/earth) |
| Path | `#D2B48C` | Walkable corridors (sandy tan) |
| Background | `#3E2723` | Canvas background (deep soil) |
| Ant Body | `#1A1A1A` | Player ant (near-black) |
| Goal | `#4CAF50` | Goal marker (vibrant green) |
| HUD Text | `#FFFFFF` | Score/timer text |
| HUD BG | `rgba(0,0,0,0.5)` | Strip behind HUD |
| Confetti | `#4CAF50, #FFC107, #FF9800, #8BC34A` | Level-complete particles |
| Streak | `#FF5722` | Streak indicator accent |

### Level Scaling Table

| Level | Grid | Ant Speed (px/s) | Time for Max Score |
|---|---|---|---|
| 1 | 7×7 | 120 | ~10s |
| 2 | 9×9 | 128 | ~15s |
| 3 | 11×11 | 136 | ~20s |
| 4 | 13×13 | 144 | ~25s |
| 5 | 15×15 | 152 | ~30s |
| 6+ | 17×17 → 21×21 | 160 → 200 | ~35s+ |
