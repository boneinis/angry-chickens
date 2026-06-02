# Angry Chickens — Build Roadmap

A staged plan to take the game from "working core loop" to a fully fleshed-out,
Angry Birds–class experience. Each phase is independently shippable and ordered
so every phase leaves the game in a playable, releasable state.

Current baseline (what already works): slingshot aim/launch with trajectory
preview, Matter.js rigid-body physics, 3 data-driven levels, score (100 direct /
50 crush), feather + score-popup juice, level flow (Complete / Game Over / Win)
with retry + cumulative scoring, mouse + touch, HiDPI canvas, sound blips.

Conventions used below:
- **Touchpoints** = the existing functions/state in `web/game.js` a task edits.
- **Effort**: S ≈ ½ day, M ≈ 1–2 days, L ≈ 3–5 days (solo).
- Every phase ends with **acceptance criteria** verifiable in the headless
  Playwright harness we already use (`/tmp/*.mjs` pattern) plus a manual pass.

---

## Phase 0 — Enabling refactor (S–M)  *(optional but recommended first)*

**Goal:** make the codebase ready to grow without a bundler.

The whole game is one ~800-line IIFE. That's fine today but will fight us by
Phase 3. Split into ES modules (`<script type="module">` — still no build step):

```
web/
  index.html
  styles/ (style.css)
  src/
    main.js          # boot, loop, state machine
    config.js        # tunables (gravity, sizes, scoring constants)
    levels.js        # LEVEL data + schema helpers
    physics.js       # engine setup, body factories
    entities.js      # cat / chicken / block models + draw
    render.js        # canvas drawing, camera
    input.js         # pointer handling
    audio.js         # sfx/music
    save.js          # localStorage persistence
    ui.js            # overlays, HUD, screens
  vendor/matter.min.js
```

- **Touchpoints:** all of `game.js` (mechanical split; no behavior change).
- **Acceptance:** game plays identically; Playwright smoke test passes; no
  console errors. This is a pure refactor — verify byte-for-byte behavior.

> If we want to stay single-file, skip Phase 0 and accept growing `game.js`.

---

## Phase 1 — Meta & replay hooks (M)

**Player outcome:** a reason to replay — stars, saved progress, a results
screen, and a leftover-cat bonus.

### 1a. Star rating
- Add per-level star thresholds to level data:
  `stars: [oneStarScore, twoStarScore, threeStarScore]` (level-local score).
- Compute stars at `winLevel()` from the level's earned score (+ leftover bonus).
- Show 1–3 filled/empty stars on the Level Complete / Win overlay.
- **Touchpoints:** `LEVELS`, `winLevel`, `showOverlay` (needs a star-row variant).

### 1b. Leftover-cat bonus
- On level clear, award `remainingCats * CAT_BONUS` (e.g. 1000) and animate it.
- Fixes the current dead "use fewer cats" idea.
- **Touchpoints:** `winLevel`, scoring constants, HUD popup.

### 1c. Persistence (`localStorage`)
- Save: unlocked-level index, best score per level, best stars per level.
- Load on boot; "Play Again" keeps records; add a "Reset progress" in settings.
- **Touchpoints:** new `save.js`; read in boot, write in `winLevel`.

### 1d. Results screen polish
- Replace the single text line with: score, leftover bonus, total, star row,
  and best-so-far. Buttons: Replay / Next / Level Select.

**Acceptance:**
- Clearing a level with all chickens + ≥2 cats left shows 3 stars and the bonus.
- Reload the page → best scores/stars and unlock progress persist.
- A worse retry never lowers the stored best.

---

## Phase 2 — Content & navigation (M–L)

**Player outcome:** it stops being a 3-level demo and becomes a game with a map.

### 2a. Level schema v2 (data-driven, forward-compatible)
Extend each level object so later phases need no migration:

```js
{
  id: "1-1", name: "Tutorial",
  cats: ["basic"],                  // the projectile queue (Phase 4 uses types)
  stars: [1000, 2500, 4000],
  bg: "day",                        // theme hook (Phase 5)
  width: 1280,                      // levels may exceed the viewport (Phase 5 camera)
  blocks:  [{ x,y,w,h, material:"wood", angle:0 }],
  chickens:[{ x,y, type:"basic" }],
}
```
- Keep a loader that fills defaults (`material:"wood"`, `type:"basic"`, `angle:0`)
  so existing levels still parse.
- **Touchpoints:** `LEVELS`, `makeBlock`, `makeChicken`, `loadLevel`.

### 2b. Level-select screen
- New `state: "levelselect"` and a screen showing a grid/world-map of levels
  with lock state, best stars, and best score per tile.
- Reachable from the title screen and the results screen.
- Clicking a tile loads that level; locked tiles are disabled.
- **Touchpoints:** state machine in `main`/`loop`, `ui.js`, `render`.

### 2c. Author 8–12 levels
- Build a difficulty curve: tutorials → towers → multi-structure → "trick shot"
  levels that need ricochets/topples. Group into a "world".
- **Tooling (optional, S):** a dev-only in-page editor (drag blocks, export JSON)
  to make authoring fast. Gate behind `?edit=1`.

**Acceptance:**
- Title → Level Select → pick any unlocked level → play → return to select.
- Beating a level unlocks the next; stars/score show on each tile.
- All authored levels are verified beatable by the Playwright clear-check.

---

## Phase 3 — Destructible materials (L)

**Player outcome:** the satisfying "smash the fort" feel — blocks take damage,
crack, and shatter; materials behave differently.

### 3a. Block health + materials
- Add `material` → `{ density, strength, color, sound }` table:
  - **wood** (medium), **ice/glass** (low strength, shatters, slippery),
    **stone** (high strength, heavy).
- Give each block `hp`. On collision, apply damage from impact energy
  (≈ `relativeSpeed² × otherMass`), not just a flat threshold.
- Visual damage states (light → cracked →破) by swapping draw tint/overlay.
- On `hp ≤ 0`: remove body, spawn material-colored debris particles, play break
  sfx, award points.
- **Touchpoints:** `makeBlock`, `collisionStart` (currently only handles
  chickens), new `damageBlock`, `render`/`drawBlock`, particles.

### 3b. Scoring + chain reactions
- Award points for destroyed blocks; ensure debris can still crush chickens
  (already supported via `rel > 9`, but now also via block-on-block destruction).
- **Touchpoints:** scoring constants, `defeatChicken`/new `destroyBlock`.

### 3c. Block cleanup
- Cull blocks knocked off-screen (today `cullChickens` ignores blocks → they
  linger forever). Generalize to `cullBodies`.

**Acceptance:**
- A hard hit shatters ice in one shot; stone needs much more force.
- Destroyed blocks award points and can crush chickens beneath them.
- No body count growth across a long session (off-screen bodies are culled).

---

## Phase 4 — Projectile variety & abilities (L)

**Player outcome:** the signature Angry Birds hook — different "cats" with
tap-to-activate powers, and a visible queue.

### 4a. Cat queue + on-deck display
- Levels define `cats: ["basic","speedy","bomber","splitter"]`. Show the queue
  near the slingshot; load them in order.
- **Touchpoints:** `loadLevel`, `prepareCat`, `remainingCats` → becomes a queue.

### 4b. Abilities (tap while in flight)
- Detect a pointer tap during `state === "flying"` to trigger the active cat's
  power once:
  - **speedy:** dash in current travel direction (impulse).
  - **bomber:** detonate — radial impulse + damage to nearby blocks/chickens.
  - **splitter:** spawn 3 smaller cats fanned out.
  - **heavy:** slam straight down.
- **Touchpoints:** new `input` tap handler, `entities.js` ability fns, physics.

### 4c. Chicken variety
- `type` → size/hp/armor: **basic** (1 hit), **big** (needs 2 hits / hard crush),
  **helmet** (immune to glancing hits; needs direct/explosive).
- Adjust `defeatChicken` to respect hp/armor instead of instant-kill.
- **Touchpoints:** `makeChicken`, `defeatChicken`, `collisionStart`, `drawChicken`.

**Acceptance:**
- Each cat type's power fires exactly once per shot, on tap, and is visually
  distinct.
- A helmeted chicken survives a glancing block but dies to a bomb/direct hit.
- Levels can be tuned around specific cat queues.

---

## Phase 5 — Camera & game feel (L)

**Player outcome:** levels wider than the screen, plus the "juice" that sells it.

### 5a. Camera
- Introduce a world camera (offset + zoom) applied in `render` via
  `ctx.translate/scale`; map pointer coords back through it in `toWorld`.
- Level intro: pan from the target structures back to the slingshot, then zoom
  to fit; follow the cat in flight; ease back on settle.
- Levels can be `width > 1280` (uses schema v2 `width`).
- **Touchpoints:** `render`, `toWorld`, `setupCanvas`, wall placement.

### 5b. Juice
- Squash/stretch on cat launch/impact, flight trail, screen shake on big
  destruction, slow-mo on level-clear, chicken "pop" animation.

### 5c. Audio
- Real background music + layered sfx (launch, wood/ice/stone breaks, chicken
  defeat, win jingle), with the existing mute control and volume in settings.

### 5d. Shell screens
- Pause menu (resume / restart / level select), settings (sound, reset),
  animated title screen.

**Acceptance:**
- A level twice the screen width pans and plays correctly; aim maps correctly
  under camera zoom.
- Pause halts physics and input; resume continues cleanly.

---

## Cross-cutting concerns

- **Testing:** keep the Playwright pattern. Maintain a `levels.test.mjs` that,
  for every level, asserts it (a) doesn't self-clear at rest and (b) is clearable
  within a shot budget. Run it whenever level data or physics changes.
- **Performance budget:** 60 fps with fixed-step physics; cap particles; cull
  off-screen bodies; pre-render static scenery to an offscreen canvas once camera
  lands (Phase 5).
- **Asset strategy:** stay procedural-canvas for now (zero asset pipeline). If we
  later want richer art, add a sprite atlas — the `draw*` functions are the only
  swap points.
- **Accessibility:** keyboard aim/launch option; respect `prefers-reduced-motion`
  for screen shake.

## Suggested sequencing & rough timeline

| Order | Phase | Effort | Why here |
|------|-------|--------|----------|
| 1 | Phase 1 — Meta & replay | M | Cheapest path to "feels like a game" |
| 2 | Phase 2 — Content & nav | M–L | Turns demo into a game; needs Phase 1's save |
| 3 | Phase 0 — Refactor | S–M | Do before the heavy mechanics phases |
| 4 | Phase 3 — Materials | L | Core AB destruction feel |
| 5 | Phase 4 — Cat abilities | L | Signature differentiator |
| 6 | Phase 5 — Camera & juice | L | Final layer of polish |

**MVP-of-a-real-game milestone:** Phases 1 + 2 (stars, save, level select,
~10 levels). That alone moves it from "prototype" to "small but complete game."

**Full Angry-Birds-parity milestone:** through Phase 5.
