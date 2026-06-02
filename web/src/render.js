// ---- Rendering ------------------------------------------------------------
import { G } from "./state.js";
import {
  W, H, GROUND_H, GROUND_TOP, SLING, FORK_BASE_Y, LAUNCH_FACTOR, FIXED_DT, CAT_R, CHICK_R,
} from "./config.js";
import { engine } from "./physics.js";

const Matter = window.Matter;
const { Vector } = Matter;

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

export function render() {
  ctx.clearRect(0, 0, W, H);
  drawClouds();
  drawGround();
  drawSlingshotBack();

  G.blocks.forEach(drawBlock);
  G.chickens.forEach((c) => { if (c.alive) drawChicken(c); });

  if (G.state === "aiming") drawTrajectory();
  if (G.cat) drawCat(G.cat);

  drawSlingshotFront();
  drawParticles();
  drawPopups();
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
  ctx.fillStyle = "#b5793b";
  ctx.strokeStyle = "#8a5524";
  ctx.lineWidth = 3;
  roundRect(-w / 2, -h / 2, w, h, 4);
  ctx.fill();
  ctx.stroke();
  // wood grain
  ctx.strokeStyle = "rgba(138,85,36,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, 0);
  ctx.lineTo(w / 2 - 6, 0);
  ctx.stroke();
  ctx.restore();
}

function drawChicken(c) {
  ctx.save();
  ctx.translate(c.position.x, c.position.y);
  ctx.rotate(c.angle);
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
  ctx.restore();
}

function drawCat(c) {
  ctx.save();
  ctx.translate(c.position.x, c.position.y);
  ctx.rotate(c.angle);
  // ears
  ctx.fillStyle = "#7d7d7d";
  ctx.beginPath();
  ctx.moveTo(-CAT_R + 4, -CAT_R + 6); ctx.lineTo(-8, -CAT_R - 8); ctx.lineTo(-2, -CAT_R + 8); ctx.closePath();
  ctx.moveTo(CAT_R - 4, -CAT_R + 6); ctx.lineTo(8, -CAT_R - 8); ctx.lineTo(2, -CAT_R + 8); ctx.closePath();
  ctx.fill();
  // head
  ctx.fillStyle = "#8a8a8a";
  ctx.strokeStyle = "#5e5e5e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, CAT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // eyes
  ctx.fillStyle = "#a5d65b";
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
