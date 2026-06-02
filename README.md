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

### Levels

1. **Tutorial** — a single exposed chicken. Get a feel for the slingshot.
2. **The Coop** — one chicken in the open and one boxed inside a crate you
   have to topple.
3. **Twin Towers** — three chickens across two towers and a center platform.

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
├── index.html        # page shell + HUD overlay
├── style.css         # layout, HUD, overlay styling
├── game.js           # game loop, slingshot, physics, levels, scoring
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
