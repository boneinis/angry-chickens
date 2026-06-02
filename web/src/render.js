// ---- Rendering ------------------------------------------------------------
import { G } from "./state.js";
import {
  W, H, GROUND_H, GROUND_TOP, SLING, FORK_BASE_Y, LAUNCH_FACTOR, FIXED_DT, CAT_R, CHICK_R,
  MATERIALS, CAT_TYPES, DEFAULT_CAT_TYPE, CHICKEN_TYPES, DEFAULT_CHICKEN_TYPE,
  CAM_FOLLOW_ZOOM, CAM_EASE, CAM_HOME_EASE, SHAKE_DECAY,
} from "./config.js";
import { engine } from "./physics.js";
import { LEVELS } from "./levels.js";

const Matter = window.Matter;
const { Vector } = Matter;

// Respect the user's reduced-motion preference: disables screen shake.
const prefersReducedMotion = (() => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
})();

// ---- Canvas ---------------------------------------------------------------
export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

// Match the backing store to the displayed size × DPR so the art stays crisp
// on high-density screens; we keep drawing in fixed W×H logical coordinates.
export function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
window.addEventListener("resize", setupCanvas);

// ---- Camera ---------------------------------------------------------------
// The level's HOME view. For width<=1280 this is the identity transform, which
// keeps aiming pixel-accurate. Wider levels (future-proofing) scroll to fit the
// arena width without distorting the vertical axis.
function homeView() {
  const lvl = LEVELS[G.levelIndex] || {};
  const lw = lvl.width || W;
  if (lw <= W) return { x: 0, y: 0, zoom: 1 };
  return { x: 0, y: 0, zoom: W / lw };
}

// The cat (or first split piece) we should be tracking, if any.
function followBody() {
  if (G.cat) return G.cat;
  if (G.catPieces && G.catPieces.length) return G.catPieces[0];
  return null;
}

const lerp = (a, b, t) => a + (b - a) * t;

// Advance the camera toward its target each rendered frame. HARD INVARIANT:
// while "ready"/"aiming" the camera is forced to the level HOME view so the
// pointer<->world mapping (and thus aiming) is exact.
function updateCamera() {
  const cam = G.camera;
  const home = homeView();

  if (G.state === "ready" || G.state === "aiming") {
    // Aiming must be pixel-accurate, so the camera is locked to the exact home
    // view with no shake — input.toWorld then maps 1:1. (The smooth ease toward
    // home happens during the preceding "between" state.)
    cam.x = home.x; cam.y = home.y; cam.zoom = home.zoom;
    cam.shakeT = 0;
    cam.introT = 0;
  } else if (G.state === "flying" || G.state === "between") {
    const body = followBody();
    let tx = home.x, ty = home.y, tz = home.zoom;
    if (body) {
      const z = home.zoom * CAM_FOLLOW_ZOOM;
      // Center on the body, but clamp so we never reveal outside the arena.
      const halfW = W / (2 * z), halfH = H / (2 * z);
      let cx = Math.max(halfW, Math.min((home.x === 0 ? W : W) - halfW, body.position.x));
      let cy = Math.max(halfH, Math.min(H - halfH, body.position.y));
      tx = cx - W / 2;
      ty = cy - H / 2;
      tz = z;
    }
    cam.x = lerp(cam.x, tx, CAM_EASE);
    cam.y = lerp(cam.y, ty, CAM_EASE);
    cam.zoom = lerp(cam.zoom, tz, CAM_EASE);
  } else {
    // Menus / results: ease gently home.
    cam.x = lerp(cam.x, home.x, CAM_HOME_EASE);
    cam.y = lerp(cam.y, home.y, CAM_HOME_EASE);
    cam.zoom = lerp(cam.zoom, home.zoom, CAM_HOME_EASE);
  }

  // Decay screen shake (time-based, ~per frame at 60fps).
  if (cam.shakeT > 0) cam.shakeT = Math.max(0, cam.shakeT - SHAKE_DECAY * (1000 / 60));
  // Decay the squash/stretch timer so the cat self-heals after launch/impact.
  if (G.catSquashT > 0) G.catSquashT = Math.max(0, G.catSquashT - 0.06);
}

// Current shake offset in world units (zero when reduced-motion or expired).
function shakeOffset() {
  const cam = G.camera;
  if (prefersReducedMotion || cam.shakeT <= 0) return { x: 0, y: 0 };
  const m = cam.shakeMag * cam.shakeT;
  return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
}

// Trigger a screen shake. `mag` in world px, `dur` a 0..1 intensity timer.
export function shakeCamera(mag, dur = 1) {
  if (prefersReducedMotion) return;
  const cam = G.camera;
  cam.shakeMag = Math.max(cam.shakeMag, mag);
  cam.shakeT = Math.max(cam.shakeT, dur);
}

// World coords of the current camera so input.js can invert the mapping.
export function getCamera() {
  const cam = G.camera;
  const sh = shakeOffset();
  return { x: cam.x + sh.x, y: cam.y + sh.y, zoom: cam.zoom };
}

export function render() {
  updateCamera();
  const cam = G.camera;
  const sh = shakeOffset();

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  // Camera transform composed on top of the DPR base transform: zoom about the
  // origin, then translate by the (negated) camera + shake offset.
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-(cam.x + sh.x), -(cam.y + sh.y));

  drawClouds();
  drawGround();
  drawSlingshotBack();

  G.blocks.forEach(drawBlock);
  G.chickens.forEach((c) => { if (c.alive) drawChicken(c); });

  if (G.state === "aiming") drawTrajectory();
  drawCatTrail();
  // Splitter pieces (if any) are separate bodies; draw each.
  if (G.catPieces && G.catPieces.length) G.catPieces.forEach(drawCat);
  if (G.cat && !(G.catPieces && G.catPieces.includes(G.cat))) drawCat(G.cat);

  drawSlingshotFront();
  drawCatQueue();
  drawParticles();
  drawPopups();

  ctx.restore();
}

// Show the upcoming cats (after the one on the sling) as small chips near the
// fork base so the player can plan which ability comes next.
function drawCatQueue() {
  if (!G.started) return;
  const lvl = LEVELS[G.levelIndex];
  const queue = (lvl && lvl.cats) || [];
  const used = queue.length - G.remainingCats;   // index of the cat in hand
  const upcoming = queue.slice(used + 1);        // those still waiting
  if (!upcoming.length) return;
  const baseX = SLING.x - 26;
  const y = FORK_BASE_Y + 30;
  for (let i = 0; i < upcoming.length && i < 5; i++) {
    const def = CAT_TYPES[upcoming[i]] || CAT_TYPES[DEFAULT_CAT_TYPE];
    const x = baseX + i * 30;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.strokeStyle = def.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 3, y - 2, 3, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 2, 3, 0, Math.PI * 2);
    ctx.fillStyle = def.accent;
    ctx.fill();
  }
}

function drawClouds() {
  G.cloudOffset = (G.cloudOffset + 0.15) % (W + 200);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  const clouds = [[150, 120, 60], [520, 90, 48], [900, 150, 70], [1150, 100, 50]];
  for (const [bx, by, r] of clouds) {
    let x = bx - G.cloudOffset;
    if (x < -150) x += W + 200;
    ctx.beginPath();
    ctx.arc(x, by, r, 0, Math.PI * 2);
    ctx.arc(x + r, by + 8, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r, by + 10, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround() {
  ctx.fillStyle = "#6ab150";
  ctx.fillRect(0, GROUND_TOP, W, GROUND_H);
  ctx.fillStyle = "#5a9e43";
  ctx.fillRect(0, GROUND_TOP, W, 14);
  // little grass tufts
  ctx.strokeStyle = "#4e8c3a";
  ctx.lineWidth = 3;
  for (let x = 20; x < W; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_TOP);
    ctx.lineTo(x - 5, GROUND_TOP - 12);
    ctx.moveTo(x, GROUND_TOP);
    ctx.lineTo(x + 6, GROUND_TOP - 14);
    ctx.stroke();
  }
}

// A slingshot band from a fork anchor to the cat (shown while it's in the pocket).
function drawBand(anchorX, anchorY, color) {
  if (!G.cat || (G.state !== "aiming" && G.state !== "ready")) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(anchorX, anchorY);
  ctx.lineTo(G.cat.position.x, G.cat.position.y);
  ctx.stroke();
}

function drawSlingshotBack() {
  // The far band, drawn before the cat so the cat sits in the pocket.
  drawBand(SLING.x + 14, SLING.y - 30, "#5b3a1a");
}

function drawSlingshotFront() {
  const baseX = SLING.x;
  // wooden Y-fork
  ctx.strokeStyle = "#7a4a22";
  ctx.lineCap = "round";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(baseX, FORK_BASE_Y);
  ctx.lineTo(baseX, SLING.y - 6);
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(baseX, SLING.y + 6);
  ctx.lineTo(baseX - 16, SLING.y - 34);
  ctx.moveTo(baseX, SLING.y + 6);
  ctx.lineTo(baseX + 16, SLING.y - 34);
  ctx.stroke();

  // near band
  drawBand(baseX - 16, SLING.y - 30, "#7a4a22");
}

function drawBlock(b) {
  ctx.save();
  ctx.translate(b.position.x, b.position.y);
  ctx.rotate(b.angle);
  const w = b.gameW, h = b.gameH;
  const mat = MATERIALS[b.gameMaterial] || MATERIALS.wood;
  ctx.fillStyle = mat.color;
  ctx.strokeStyle = mat.stroke;
  ctx.lineWidth = 3;
  roundRect(-w / 2, -h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  // surface grain / texture line
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, 0);
  ctx.lineTo(w / 2 - 6, 0);
  ctx.stroke();

  // Progressive cracks as the block loses hit points.
  const frac = (b.gameMaxHp && b.gameHp != null) ? b.gameHp / b.gameMaxHp : 1;
  if (frac < 0.66) drawCracks(w, h, frac < 0.33 ? 5 : 2);
  ctx.restore();
}

// Draw a small set of deterministic jagged crack lines clipped to the block.
function drawCracks(w, h, count) {
  ctx.save();
  roundRect(-w / 2, -h / 2, w, h, 4);
  ctx.clip();
  ctx.strokeStyle = "rgba(20,20,20,0.55)";
  ctx.lineWidth = 1.5;
  // Deterministic pseudo-random offsets keyed off block size so cracks are
  // stable per block and don't flicker frame to frame.
  const seed = (w * 31 + h * 17);
  for (let i = 0; i < count; i++) {
    const r1 = ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
    const r2 = ((seed * (i + 3) * 4096 + 7919) % 233280) / 233280;
    const sx = (-0.5 + r1) * w;
    const sy = (-0.5 + r2) * h;
    ctx.beginPath();
    ctx.moveTo(sx, -h / 2);
    ctx.lineTo(sx + (r2 - 0.5) * w * 0.5, sy);
    ctx.lineTo(sx + (r1 - 0.5) * w * 0.4, h / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChicken(c) {
  // Radius from the body when available so "big" chickens visibly grow.
  const r = c.gameR || CHICK_R;
  const s = r / CHICK_R;                       // sprite scale vs the base art
  const armor = c.gameArmor;
  ctx.save();
  ctx.translate(c.position.x, c.position.y);
  ctx.rotate(c.angle);
  ctx.scale(s, s);
  // body
  ctx.fillStyle = "#ffd23f";
  ctx.strokeStyle = "#f08c00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, CHICK_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // comb
  ctx.fillStyle = "#e5383b";
  ctx.beginPath();
  ctx.arc(-6, -CHICK_R + 2, 5, 0, Math.PI * 2);
  ctx.arc(4, -CHICK_R - 1, 6, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-8, -6, 7, 0, Math.PI * 2);
  ctx.arc(8, -6, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(-7, -6, 3.2, 0, Math.PI * 2);
  ctx.arc(9, -6, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // beak
  ctx.fillStyle = "#f48c06";
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 16);
  ctx.closePath();
  ctx.fill();
  // helmet: a steel dome with a chin strap, hiding the comb.
  if (armor === "helmet") {
    ctx.fillStyle = "#7f8a96";
    ctx.strokeStyle = "#4c545c";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -4, CHICK_R - 2, Math.PI * 1.04, Math.PI * 1.96);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // rivet + strap accent
    ctx.fillStyle = "#cfd6dc";
    ctx.beginPath();
    ctx.arc(0, -CHICK_R + 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Squash/stretch factors driven by G.catSquashT (>0). The cat stretches along
// its travel direction at launch and squashes on a hard impact; the timer
// decays in render so it self-heals. The main body is the one that gets it.
function squashScale(c) {
  if (!G.catSquashT || c !== (G.cat || (G.catPieces && G.catPieces[0]))) return { sx: 1, sy: 1, ang: 0 };
  const t = G.catSquashT;                       // 0..1
  // Stretch along velocity direction; amount eases out as t decays.
  const v = c.velocity || { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  const ang = speed > 0.2 ? Math.atan2(v.y, v.x) : 0;
  const amt = 0.35 * t * (G.catSquashSign || 1);
  return { sx: 1 + amt, sy: 1 - amt, ang };
}

function drawCat(c) {
  const type = c.gameCatType || DEFAULT_CAT_TYPE;
  const def = CAT_TYPES[type] || CAT_TYPES[DEFAULT_CAT_TYPE];
  const r = c.gameR || CAT_R;
  const s = r / CAT_R;                          // sprite scale vs the base art
  const sq = squashScale(c);
  ctx.save();
  ctx.translate(c.position.x, c.position.y);
  // Squash/stretch is applied in the velocity frame so it reads as motion.
  if (sq.sx !== 1 || sq.sy !== 1) {
    ctx.rotate(sq.ang);
    ctx.scale(sq.sx, sq.sy);
    ctx.rotate(-sq.ang);
  }
  ctx.rotate(c.angle);
  ctx.scale(s, s);
  // ears
  ctx.fillStyle = def.stroke;
  ctx.beginPath();
  ctx.moveTo(-CAT_R + 4, -CAT_R + 6); ctx.lineTo(-8, -CAT_R - 8); ctx.lineTo(-2, -CAT_R + 8); ctx.closePath();
  ctx.moveTo(CAT_R - 4, -CAT_R + 6); ctx.lineTo(8, -CAT_R - 8); ctx.lineTo(2, -CAT_R + 8); ctx.closePath();
  ctx.fill();
  // head
  ctx.fillStyle = def.color;
  ctx.strokeStyle = def.stroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, CAT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eyes (accent color per type)
  ctx.fillStyle = def.accent;
  ctx.beginPath();
  ctx.arc(-8, -2, 6, 0, Math.PI * 2);
  ctx.arc(8, -2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.fillRect(-9.5, -8, 3, 12);
  ctx.fillRect(6.5, -8, 3, 12);
  // nose
  ctx.fillStyle = "#e5383b";
  ctx.beginPath();
  ctx.moveTo(-3, 7); ctx.lineTo(3, 7); ctx.lineTo(0, 11); ctx.closePath();
  ctx.fill();
  // whiskers
  ctx.strokeStyle = "rgba(40,40,40,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(4, 9); ctx.lineTo(20, 6);
  ctx.moveTo(4, 11); ctx.lineTo(20, 13);
  ctx.moveTo(-4, 9); ctx.lineTo(-20, 6);
  ctx.moveTo(-4, 11); ctx.lineTo(-20, 13);
  ctx.stroke();
  // Per-type forehead marking so types read at a glance.
  drawCatMark(type, def);
  ctx.restore();
}

// A small badge on the cat's forehead that identifies its type/ability.
function drawCatMark(type, def) {
  ctx.save();
  ctx.translate(0, -CAT_R + 9);
  ctx.lineWidth = 2.2;
  if (type === "speedy") {                      // forward chevrons (dash)
    ctx.strokeStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(-6, -4); ctx.lineTo(0, 0); ctx.lineTo(-6, 4);
    ctx.moveTo(0, -4); ctx.lineTo(6, 0); ctx.lineTo(0, 4);
    ctx.stroke();
  } else if (type === "bomber") {               // fuse spark (explode)
    ctx.fillStyle = def.accent;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = def.accent;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, -9); ctx.stroke();
  } else if (type === "splitter") {             // three dots (split)
    ctx.fillStyle = def.accent;
    for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(dx, 0, 2.4, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === "heavy") {                // down arrow (slam)
    ctx.strokeStyle = def.accent;
    ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(0, 5);
    ctx.moveTo(-4, 1); ctx.lineTo(0, 5); ctx.lineTo(4, 1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrajectory() {
  if (!G.dragPoint) return;
  const pull = Vector.sub(SLING, G.dragPoint);
  let vx = pull.x * LAUNCH_FACTOR;
  let vy = pull.y * LAUNCH_FACTOR;
  let px = G.cat.position.x;
  let py = G.cat.position.y;
  // Mirror the engine's per-step integration so the preview matches the shot.
  const g = engine.gravity.y * engine.gravity.scale * FIXED_DT * FIXED_DT;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 28; i++) {
    vx *= 0.996; vy *= 0.996;   // approximate the cat's frictionAir
    px += vx;
    py += vy;
    vy += g;
    if (py > GROUND_TOP) break;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Fading motion trail behind the flying cat. Samples are pushed by stepSim;
// here we just render them as shrinking, fading discs in the cat's color.
function drawCatTrail() {
  const trail = G.catTrail;
  if (!trail || !trail.length) return;
  const def = CAT_TYPES[G.catType] || CAT_TYPES[DEFAULT_CAT_TYPE];
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const f = p.life / p.max;                   // 1 -> 0
    ctx.globalAlpha = 0.28 * f;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (p.r || CAT_R) * (0.4 + 0.5 * f), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 50);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.textAlign = "center";
  ctx.font = "bold 34px 'Trebuchet MS', sans-serif";
  for (const p of G.popups) {
    ctx.globalAlpha = Math.max(0, p.life / 60);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#e85d04";
    ctx.lineWidth = 4;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
