# Angry Chickens 🐱🐔

A browser-based, physics-driven slingshot game. Fling cats at structures to
defeat the chickens — an Angry Birds–style puzzle that runs in any modern
browser, no install required.

## Play

Open `web/index.html` in a browser, or serve the `web/` folder:

```bash
cd web
npx http-server -p 8080      # then visit http://localhost:8080
```

(Any static file server works — `python3 -m http.server` from inside `web/`
is fine too.)

## How to play

1. **Pull back** — press and drag the cat backward on the slingshot.
2. **Aim** — the dotted line previews the cat's flight path; angle and power
   come from how far you pull.
3. **Release** — let go to fling the cat.

Defeat every chicken in a level to advance. You get **3 cats per level** — run
out before the coop is clear and it's game over.

- Direct cat-to-chicken hit: **100 points**
- Chicken crushed by falling debris or knocked off the screen: **50 points**
- **Cats-left bonus:** +1000 per unused cat when you clear a level
- **Stars:** each level awards 1–3 stars based on your score

### Progression

- **12 levels** with a difficulty curve, played from a **Level Select** screen.
- **Stars and best scores are saved** in your browser (`localStorage`) and shown
  on each level tile; clearing a level unlocks the next.
- Jump straight to a level with `?level=N` (1-based), e.g. `index.html?level=5`.
- The **☰** button (top-right) opens Level Select / pause; **Resume** returns
  to play. A **Settings** screen (from the title) toggles SFX, sets music
  volume, and can reset progress.

## Cats, chickens & blocks

- **Cat types with tap-to-activate powers** — tap mid-flight to trigger:
  **speedy** (dash), **bomber** (explode), **splitter** (splits into pieces),
  **heavy** (slam down). Each level has its own cat queue (shown on deck).
- **Chicken variety** — **basic**, **helmet** (shrugs off debris; needs a
  direct hit or an explosion), and **big**.
- **Destructible materials** — **wood**, **ice** (shatters easily), and
  **stone** (tough); structures crack and break apart, and debris can crush
  chickens. Destroying blocks scores points.

## Game feel

Motion trails, squash/stretch, screen shake on big impacts, a brief slow-mo on
the finishing blow, a follow camera, and procedural sound effects + music.

## Tech

- **Rendering:** hand-drawn on an HTML5 `<canvas>` (cartoon cats, chickens,
  wooden blocks, parallax clouds, particle "feathers").
- **Physics:** [Matter.js](https://brm.io/matter-js/) rigid-body engine
  (gravity, stacking, collapse, collision impulses), vendored locally in
  `web/vendor/` so the game is fully self-contained and works offline.
- **No build step:** plain HTML/CSS/JS. Nothing to compile or bundle.
- **Input:** mouse and touch, so it plays on desktop and mobile.

## Project structure

```
web/
├── index.html        # page shell + HUD + overlay host
├── style.css         # layout, HUD, screens, level-select grid
├── src/              # ES modules (no build step)
│   ├── main.js       # boot, fixed-timestep loop, deep-link, debug accessor
│   ├── state.js      # the single mutable game-state object (G)
│   ├── config.js     # tunables: physics, materials, cat/chicken types, camera
│   ├── levels.js     # the 12 levels (schema v2)
│   ├── physics.js    # Matter engine + body factories
│   ├── rules.js      # screen flow, scoring/stars, collisions, abilities
│   ├── render.js     # canvas drawing, camera, juice
│   ├── input.js      # pointer aim/launch + ability tap
│   ├── ui.js         # HUD + title/results/game-over/level-select/settings
│   ├── audio.js      # procedural SFX + music
│   └── save.js       # localStorage progress (unlocks, best score/stars)
└── vendor/
    └── matter.min.js # Matter.js physics engine (pinned 0.20.0)
```

## Deploying

It's a static site, so it deploys anywhere. For Vercel, point the project at
the `web/` directory (no framework, no build command) and it serves as-is.

## Tuning / customizing

All the knobs live at the top of `web/game.js`:

- `LEVELS` — add or edit level layouts (`blocks` and `chickens` in world
  coordinates).
- `LAUNCH_FACTOR` — how much pull distance converts to launch speed.
- `GRAVITY_SCALE` — arc tightness.
- `CATS_PER_LEVEL`, `MAX_STRETCH`, body `density`/`friction`/`restitution` —
  feel of the projectiles and structures.

## History

This started life as a native iOS/SpriteKit prototype. It was reimplemented as
a self-contained web game so it runs anywhere a browser does.
