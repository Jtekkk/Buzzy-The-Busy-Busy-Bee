# 🐝 Buzzy The Busy Busy Bee

A colorful, fast-paced HTML5 side-scrolling arcade game. Fly Buzzy the bee
through a living meadow, collect nectar from different flowers, grab power-ups,
and dodge spiders, birds and pesticide clouds — all the way through a rolling
day/night cycle. Built with **plain HTML5, CSS3 and JavaScript** (Canvas 2D +
Web Audio API) — no build step, no dependencies, no external assets.

![Gameplay](https://img.shields.io/badge/HTML5-Canvas-orange) ![No deps](https://img.shields.io/badge/dependencies-none-brightgreen)

## ▶️ How to Play

Just open **`index.html`** in any modern browser — that's it.

```bash
# or serve it locally (recommended so audio unlocks smoothly)
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Controls

| Action | Keys |
| ------ | ---- |
| Fly up / down / left / right | **Arrow keys** or **WASD** |
| Pause / resume | **P** or **Esc** |
| Mute / unmute | **M** |
| Mobile | **Touch & drag** — Buzzy flies toward your finger |

### Goal

- 🌼 **Collect nectar** from flowers to score points — rarer flowers are worth more.
- 🕷️ **Avoid obstacles**: spiders (dangling on webs), birds (swooping past) and toxic pesticide clouds.
- ⭐ **Grab power-ups** for a temporary edge.
- ❤️ You have **3 lives**. Lose them all and it's game over.
- 🏆 **Beat your high score** and unlock achievements!

## ✨ Features

**Core mechanics**
- Momentum-based 4-directional flight with smooth acceleration and soft screen bounds.
- Progressive difficulty — world speed and obstacle frequency ramp up over ~2 minutes.
- Circle-based collision detection for fair, forgiving hits.

**Flowers & scoring** (5 tiers, weighted by rarity)
| Flower | Points | Flower | Points |
| ------ | ------ | ------ | ------ |
| 🌼 Daisy | 10 | 🔵 Bluebell | 75 |
| 🌷 Tulip | 25 | 🌻 Sunflower | 100 |
| 🌹 Rose | 50 | | |

Survival also earns passive distance points.

**Power-ups**
- ⚡ **Speed Boost** — fly faster.
- 🛡️ **Shield** — absorbs one hit (with a satisfying block).
- 🧲 **Nectar Magnet** — pulls nearby nectar toward you.

**Presentation**
- Fully procedural cartoon art — animated bee with flapping wings, tilt, antennae and a shield bubble.
- Parallax background: gradient sky, drifting clouds, two rolling hill layers and scrolling grass.
- **Day/night cycle** with a sunrise→noon→sunset→night gradient, an arcing sun/moon and twinkling stars.
- Particle bursts, floating score pop-ups and toast notifications.

**Audio** — synthesized entirely in-browser via the Web Audio API (no audio files): nectar chimes, power-up jingles, crunch on hit, shield block, game-over fanfare, and a gentle looping background melody whose tempo rises with difficulty.

**Systems**
- 🏆 **10 achievements** with persistent unlock tracking.
- 💾 **Local storage** for the high score, achievements and mute preference.
- Game-state machine: **menu → playing → paused → game over**, plus an achievements screen.
- **Responsive** 16:9 canvas that scales/letterboxes to fit any desktop or mobile screen; auto-pauses when the tab is hidden.

## 🗂️ Project Structure

Code is organized with a clear separation of concerns. Everything lives on a
single global `BUZZY` namespace so the plain `<script>` files can share it
without a bundler (works straight from `file://`).

```
Buzzy-The-Busy-Busy-Bee/
├── index.html          # Markup: canvas, HUD and all menu/overlay screens
├── css/
│   └── styles.css      # Responsive layout, menus, HUD, toasts, animations
└── js/
    ├── utils.js        # Math/collision helpers + shared constants
    ├── storage.js      # Safe localStorage wrapper (high score, achievements, mute)
    ├── audio.js        # AudioManager — Web Audio synth for SFX + music
    ├── input.js        # InputManager — keyboard (arrows/WASD) + touch/pointer
    ├── entities.js     # Entity base class + Bee, Flower, Spider, Bird,
    │                   #   Pesticide, PowerUp, Cloud, Particle (all self-drawing)
    ├── game.js         # Game loop, state machine, spawning, difficulty,
    │                   #   day/night, collisions, achievements, rendering
    └── main.js         # Bootstrap: wiring, responsive resize, audio unlock
```

### Architecture notes
- **Object-oriented entities** — a common `Entity` base defines `update(dt, game)` / `draw(ctx)`; each game object subclasses it and renders itself procedurally.
- **Resolution independence** — all logic runs in a fixed 960×540 "design space"; the canvas is CSS-scaled to the viewport, so gameplay feels identical everywhere and stays crisp.
- **Delta-time game loop** — movement is time-based (and clamped) for consistent speed and smooth ~60fps animation regardless of frame rate.
- **Extensible** — add a flower by dropping an entry in `FLOWER_TYPES`, an achievement via the `ACHIEVEMENTS` array, or a new obstacle by subclassing `Entity`.

## 🛠️ Tech

Vanilla **HTML5 Canvas 2D** for rendering, the **Web Audio API** for all sound,
`localStorage` for persistence, and `requestAnimationFrame` for the loop. No
frameworks, no build tooling, no network requests.

---

Made with 🍯 — now go be the busiest bee in the meadow!
