// ---- Game rules -----------------------------------------------------------
import { G } from "./state.js";
import {
  W, H, SLING, MAX_STRETCH, LAUNCH_FACTOR, CATS_PER_LEVEL, CAT_BONUS,
  MATERIALS, BLOCK_POINTS, DAMAGE_THRESHOLD, DAMAGE_SCALE,
} from "./config.js";
import { LEVELS } from "./levels.js";
import {
  engine, world, makeBlock, makeChicken, makeCat, clearBodies,
} from "./physics.js";
import { sndLaunch, sndHit, sndThud, sndBreak } from "./audio.js";
import { updateHUD, showResults, showGameOver, showMenu, showLevelSelect } from "./ui.js";
import { recordResult, getBest } from "./save.js";

const Matter = window.Matter;
const { Composite, Body, Events, Vector } = Matter;

// ---- Screen flow ----------------------------------------------------------
// Start a fresh attempt at a level (per-level scoring: score resets each level).
export function startLevel(idx) {
  G.started = true;
  G.levelIndex = idx;
  G.score = 0;
  G.levelStartScore = 0;
  loadLevel(idx);
}

export function openMenu() {
  G.started = false;
  showMenu({ onPlay: () => startLevel(0), onLevels: openLevelSelect });
}

export function openLevelSelect() {
  G.started = false;                       // pause physics while choosing
  showLevelSelect({ onSelect: startLevel, onBack: openMenu });
}

function computeStars(score, thresholds) {
  if (!thresholds || !thresholds.length) return 1;
  let n = 0;
  for (const t of thresholds) if (score >= t) n++;
  return Math.max(1, Math.min(3, n));        // clearing always earns >= 1 star
}

// ---- Level management -----------------------------------------------------
export function loadLevel(idx) {
  clearBodies(G.blocks);
  clearBodies(G.chickens);
  if (G.cat) { Composite.remove(world, G.cat); G.cat = null; }
  G.particles = [];
  G.popups = [];

  const lvl = LEVELS[idx];
  lvl.blocks.forEach(makeBlock);
  lvl.chickens.forEach(makeChicken);

  // Honor each level's cat queue length; fall back to the default.
  G.remainingCats = (lvl.cats && lvl.cats.length) || CATS_PER_LEVEL;
  prepareCat();
  G.state = "ready";
  updateHUD();
}

export function prepareCat() {
  if (G.remainingCats <= 0) { checkEndOfRound(); return; }
  G.cat = makeCat();
  G.dragPoint = null;
  G.state = "ready";
}

// ---- Launching ------------------------------------------------------------
export function launch() {
  if (!G.cat || !G.dragPoint) return;
  const pull = Vector.sub(SLING, G.dragPoint);          // points opposite the drag
  const v = Vector.mult(pull, LAUNCH_FACTOR);
  Body.setStatic(G.cat, false);
  Body.setVelocity(G.cat, v);
  Body.setAngularVelocity(G.cat, 0.2);
  G.remainingCats -= 1;
  G.state = "flying";
  G.stillMs = 0;
  G.flyingMs = 0;
  G.settleMs = -1;
  G.dragPoint = null;
  sndLaunch();
  updateHUD();
}

// Settle the round once the launched cat comes to rest or leaves the arena.
export function catSettled() {
  if (G.cat) { Composite.remove(world, G.cat); G.cat = null; }
  if (aliveChickens() === 0) { winLevel(); return; }
  if (G.remainingCats <= 0) { checkEndOfRound(); return; }
  prepareCat();
}

export function aliveChickens() {
  return G.chickens.filter((c) => c.alive).length;
}

export function checkEndOfRound() {
  if (aliveChickens() === 0) winLevel();
  else gameOver();
}

export function winLevel() {
  if (G.state === "win" || G.state === "levelcomplete" || G.state === "gameover") return;
  const idx = G.levelIndex;
  const isLast = idx + 1 >= LEVELS.length;
  G.state = isLast ? "win" : "levelcomplete";

  const base = G.score;                              // points from chickens this level
  const bonus = G.remainingCats * CAT_BONUS;         // leftover-cat bonus
  G.score += bonus;
  const total = G.score;
  const stars = computeStars(total, LEVELS[idx].stars);
  recordResult(idx, total, stars);                   // persist best score/stars + unlock next
  updateHUD();

  showResults({
    won: true, isLast, base, bonus, total, stars,
    best: getBest(idx),
    onNext: isLast ? null : () => startLevel(idx + 1),
    onReplay: () => startLevel(idx),
    onLevels: openLevelSelect,
  });
}

export function gameOver() {
  G.state = "gameover";
  showGameOver({
    score: G.score,
    onRetry: () => startLevel(G.levelIndex),
    onLevels: openLevelSelect,
  });
}

// ---- Collisions -----------------------------------------------------------
Events.on(engine, "collisionStart", (evt) => {
  for (const pair of evt.pairs) {
    const a = pair.bodyA;
    const b = pair.bodyB;
    const rel = Vector.magnitude(Vector.sub(a.velocity, b.velocity));

    // Block damage is independent of (and runs before) the chicken logic so a
    // destroyed block can still crush a chicken on the same impact.
    applyBlockDamage(a, b, rel);

    const chicken = pickType(a, b, "chicken");
    if (chicken && chicken.alive) {
      const byCat = a.gameType === "cat" || b.gameType === "cat";
      if (byCat) {            // direct cat -> chicken hit always defeats it
        defeatChicken(chicken, 100);
        sndHit();
        continue;
      }
      if (rel > 9) {          // crushed by debris / hard impact
        defeatChicken(chicken, 50);
        sndHit();
        continue;
      }
    }

    // Audible thud for heavy structural impacts.
    if (rel > 11 && (a.gameType === "block" || b.gameType === "block")) sndThud();
  }
});

// Apply impact damage to any block(s) in a collision pair. Gentle resting /
// settling contacts (rel <= DAMAGE_THRESHOLD) deal no damage at all.
function applyBlockDamage(a, b, rel) {
  if (rel <= DAMAGE_THRESHOLD) return;
  damageIfBlock(a, b, rel);
  damageIfBlock(b, a, rel);
}

function damageIfBlock(block, other, rel) {
  if (block.gameType !== "block" || block.gameHp == null) return;
  // Heavier strikers (cat/stone) hit harder; clamp the mass factor so it can
  // neither trivialize nor over-amplify damage.
  const otherMass = (other && other.mass && isFinite(other.mass)) ? other.mass : 1;
  const massFactor = Math.max(0.6, Math.min(2.2, otherMass / 1.2));
  const dmg = (rel - DAMAGE_THRESHOLD) * DAMAGE_SCALE * massFactor;
  block.gameHp -= dmg;
  if (block.gameHp <= 0) destroyBlock(block);
}

function destroyBlock(block) {
  const i = G.blocks.indexOf(block);
  if (i === -1) return;                 // already destroyed
  G.blocks.splice(i, 1);
  const mat = MATERIALS[block.gameMaterial] || MATERIALS.wood;
  spawnDebris(block.position.x, block.position.y, mat.color);
  Composite.remove(world, block);
  sndBreak();
  G.score += BLOCK_POINTS;
  G.popups.push({ x: block.position.x, y: block.position.y, text: "+" + BLOCK_POINTS, life: 60 });
  updateHUD();
}

function pickType(a, b, type) {
  if (a.gameType === type) return a;
  if (b.gameType === type) return b;
  return null;
}

export function defeatChicken(chicken, points) {
  if (!chicken.alive) return;
  chicken.alive = false;
  G.score += points;
  spawnFeathers(chicken.position.x, chicken.position.y);
  G.popups.push({ x: chicken.position.x, y: chicken.position.y, text: "+" + points, life: 60 });
  Composite.remove(world, chicken);
  updateHUD();

  // End the round promptly once the last chicken falls, rather than waiting
  // for the still-moving cat to come to rest.
  if (aliveChickens() === 0 && (G.state === "flying" || G.state === "between")) {
    G.state = "between";
    G.settleMs = Math.min(G.settleMs < 0 ? Infinity : G.settleMs, 600);
  }
}

export function spawnFeathers(x, y) {
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    G.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 2,
      r: 3 + Math.random() * 4,
      life: 40 + Math.random() * 25,
      color: Math.random() < 0.5 ? "#fff" : "#ffd23f",
    });
  }
}

// Material-colored shards flung out when a block shatters.
export function spawnDebris(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 5;
    G.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 2,
      r: 2 + Math.random() * 4,
      life: 35 + Math.random() * 25,
      color,
    });
  }
}

// ---- Simulation step ------------------------------------------------------
function updateEffects() {
  for (const p of G.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25;
    p.life -= 1;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const p of G.popups) { p.y -= 1.1; p.life -= 1; }
  G.popups = G.popups.filter((p) => p.life > 0);
}

export function checkFlying(dt) {
  if (G.state !== "flying" || !G.cat) return;
  const speed = Vector.magnitude(G.cat.velocity);
  const offscreen = G.cat.position.y > H + 150 || G.cat.position.x > W + 200 || G.cat.position.x < -200;
  G.stillMs = speed < 0.45 ? G.stillMs + dt : 0;
  G.flyingMs += dt;
  // Settle when the cat rests for a while, leaves the arena, or hits the
  // hard time limit (guarantees the next cat always loads). Time-based so the
  // feel is identical across refresh rates.
  if (G.stillMs > 750 || offscreen || G.flyingMs > 6000) {
    G.state = "between";
    G.settleMs = 350;
  }
}

// Defeat chickens that get knocked off the screen.
export function cullChickens() {
  for (const c of G.chickens) {
    if (c.alive && (c.position.y > H + 100 || c.position.x < -100 || c.position.x > W + 100)) {
      defeatChicken(c, 50);
    }
  }
}

// Remove blocks that fall off-screen so the body count can't grow unbounded.
// Mirrors the chicken cull bounds; off-screen blocks award no points.
export function cullBlocks() {
  for (let i = G.blocks.length - 1; i >= 0; i--) {
    const b = G.blocks[i];
    if (b.position.y > H + 100 || b.position.x < -100 || b.position.x > W + 100) {
      G.blocks.splice(i, 1);
      Composite.remove(world, b);
    }
  }
}

// Game logic advanced once per fixed physics step (dt in ms).
export function stepSim(dt) {
  checkFlying(dt);
  cullChickens();
  cullBlocks();
  updateEffects();
  if (G.state === "between" && G.settleMs >= 0) {
    G.settleMs -= dt;
    if (G.settleMs <= 0) { G.settleMs = -1; catSettled(); }
  }
}
