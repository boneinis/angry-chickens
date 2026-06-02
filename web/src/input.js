// ---- Input ----------------------------------------------------------------
import { G } from "./state.js";
import { W, H, SLING, MAX_STRETCH, CAT_R } from "./config.js";
import { canvas, getCamera } from "./render.js";
import { hint } from "./ui.js";
import { launch, activateAbility } from "./rules.js";

const Matter = window.Matter;
const { Body, Vector } = Matter;

// Pointer-down position (screen px) used to tell a tap from a drag.
let downPt = null;
const TAP_SLOP = 8;          // max movement (screen px) still counted as a tap

function toWorld(evt) {
  const rect = canvas.getBoundingClientRect();
  const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
  const cy = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
  // Map to the logical W×H space first...
  const lx = cx * (W / rect.width);
  const ly = cy * (H / rect.height);
  // ...then invert the camera transform (scale about origin, then translate).
  // During "ready"/"aiming" the camera is the identity so this is a no-op and
  // aiming stays pixel-accurate; in flight it keeps ability taps correct.
  const cam = getCamera();
  return { x: lx / cam.zoom + cam.x, y: ly / cam.zoom + cam.y };
}

function screenPt(evt) {
  const x = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const y = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return { x, y };
}

function onDown(evt) {
  // While a special cat is in flight, a tap (not a drag) fires its ability.
  if (G.state === "flying" && G.abilityReady) {
    downPt = screenPt(evt);
    return;                                  // resolved on pointer-up as tap
  }
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
  // Tap while flying -> ability (only if the pointer barely moved).
  if (downPt && G.state === "flying" && G.abilityReady) {
    const up = evt && (evt.changedTouches ? { x: evt.changedTouches[0].clientX, y: evt.changedTouches[0].clientY } : { x: evt.clientX, y: evt.clientY });
    const moved = up ? Math.hypot(up.x - downPt.x, up.y - downPt.y) : 0;
    downPt = null;
    if (moved <= TAP_SLOP) {
      activateAbility();
      if (evt) evt.preventDefault();
      return;
    }
  }
  downPt = null;
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
