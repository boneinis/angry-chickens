// ---- Entry point ----------------------------------------------------------
// Wires the modules together: fixed-timestep loop, boot overlay, and the
// initial canvas/HUD setup. Matter is loaded as a global UMD script before
// this module runs.
import { G } from "./state.js";
import { FIXED_DT, MAX_SUBSTEPS } from "./config.js";
import { engine } from "./physics.js";
import { stepSim } from "./rules.js";
import { render, setupCanvas } from "./render.js";
import { updateHUD, showOverlay, overlay } from "./ui.js";
import { loadLevel } from "./rules.js";
// input.js registers its own event listeners on import.
import "./input.js";

const Matter = window.Matter;
const { Engine } = Matter;

// ---- Simulation + main loop -----------------------------------------------
// Fixed-timestep accumulator: Matter is only stable with a constant dt, so we
// step it a whole number of times per frame and carry the remainder.
let accumulator = 0;
let last = performance.now();
function loop(now) {
  let frame = now - last;
  last = now;
  if (G.started) {
    if (frame > 250) frame = 250;          // clamp after a tab was backgrounded
    accumulator += frame;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      Engine.update(engine, FIXED_DT);
      stepSim(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) accumulator = 0;   // drop backlog, avoid spiral
  }
  render();
  requestAnimationFrame(loop);
}

// ---- Boot -----------------------------------------------------------------
function startGame() {
  G.started = true;
  G.levelIndex = 0;
  G.score = 0;
  G.levelStartScore = 0;
  loadLevel(G.levelIndex);
  overlay.classList.add("hidden");
}

showOverlay(
  "Angry Chickens 🐱",
  "Drag the cat back on the slingshot and release to fling it at the chickens. Defeat them all to clear the level!",
  "Play",
  startGame
);

setupCanvas();
updateHUD();
requestAnimationFrame(loop);
