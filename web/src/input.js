// ---- Input ----------------------------------------------------------------
import { G } from "./state.js";
import { W, H, SLING, MAX_STRETCH, CAT_R } from "./config.js";
import { canvas } from "./render.js";
import { hint } from "./ui.js";
import { launch } from "./rules.js";

const Matter = window.Matter;
const { Body, Vector } = Matter;

function toWorld(evt) {
  const rect = canvas.getBoundingClientRect();
  const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
  const cy = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
  return { x: cx * (W / rect.width), y: cy * (H / rect.height) };
}

function onDown(evt) {
  if (G.state !== "ready" || !G.cat) return;
  const p = toWorld(evt);
  if (Vector.magnitude(Vector.sub(p, G.cat.position)) <= CAT_R * 2.2) {
    G.state = "aiming";
    G.dragPoint = clampPull(p);
    Body.setPosition(G.cat, G.dragPoint);
    canvas.classList.add("grabbing");
    hint.classList.add("hidden");
    evt.preventDefault();
  }
}

function onMove(evt) {
  if (G.state !== "aiming") return;
  G.dragPoint = clampPull(toWorld(evt));
  Body.setPosition(G.cat, G.dragPoint);
  evt.preventDefault();
}

function onUp(evt) {
  if (G.state !== "aiming") return;
  canvas.classList.remove("grabbing");
  // A tiny pull is treated as a cancel (snap back).
  if (Vector.magnitude(Vector.sub(SLING, G.dragPoint)) < 12) {
    Body.setPosition(G.cat, SLING);
    G.dragPoint = null;
    G.state = "ready";
  } else {
    launch();
  }
  if (evt) evt.preventDefault();
}

// Constrain the pull: behind the fork (x <= sling.x) and within max stretch.
function clampPull(p) {
  let dx = p.x - SLING.x;
  let dy = p.y - SLING.y;
  if (dx > 0) dx = 0;                          // can't push forward
  const dist = Math.hypot(dx, dy);
  if (dist > MAX_STRETCH) {
    const s = MAX_STRETCH / dist;
    dx *= s; dy *= s;
  }
  return { x: SLING.x + dx, y: SLING.y + dy };
}

canvas.addEventListener("mousedown", onDown);
window.addEventListener("mousemove", onMove);
window.addEventListener("mouseup", onUp);
canvas.addEventListener("touchstart", onDown, { passive: false });
window.addEventListener("touchmove", onMove, { passive: false });
window.addEventListener("touchend", onUp, { passive: false });
