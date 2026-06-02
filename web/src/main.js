// ---- Entry point ----------------------------------------------------------
// Wires the modules together: fixed-timestep loop, boot overlay, and the
// initial canvas/HUD setup. Matter is loaded as a global UMD script before
// this module runs.
import { G } from "./state.js";
import { FIXED_DT, MAX_SUBSTEPS } from "./config.js";
import { engine } from "./physics.js";
import { stepSim, aliveChickens, startLevel, openMenu, openLevelSelect } from "./rules.js";
import { LEVELS } from "./levels.js";
import { render, setupCanvas } from "./render.js";
import { updateHUD } from "./ui.js";
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
// Lightweight state accessor for automated tests / debugging.
window.__game = () => ({
  state: G.state, level: G.levelIndex, cats: G.remainingCats, score: G.score,
  alive: aliveChickens(),
  cat: G.cat ? { x: Math.round(G.cat.position.x), y: Math.round(G.cat.position.y) } : null,
});

// HUD level-select button opens the picker (also acts as a pause).
document.getElementById("levels-btn").addEventListener("click", openLevelSelect);

// Optional deep-link: ?level=N jumps straight into level N (1-based).
const startParam = parseInt(new URLSearchParams(location.search).get("level"), 10);
if (Number.isInteger(startParam) && startParam >= 1 && startParam <= LEVELS.length) {
  startLevel(startParam - 1);
} else {
  openMenu();
}

setupCanvas();
updateHUD();
requestAnimationFrame(loop);
