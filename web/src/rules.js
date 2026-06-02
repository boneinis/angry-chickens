// ---- Game rules -----------------------------------------------------------
import { G } from "./state.js";
import {
  W, H, SLING, MAX_STRETCH, LAUNCH_FACTOR, CATS_PER_LEVEL, CAT_BONUS,
  MATERIALS, BLOCK_POINTS, DAMAGE_THRESHOLD, DAMAGE_SCALE,
  CAT_TYPES, DEFAULT_CAT_TYPE,
  DASH_SPEED, SLAM_SPEED, SPLIT_COUNT, SPLIT_SPREAD, SPLIT_RADIUS_MUL,
  EXPLODE_RADIUS, EXPLODE_IMPULSE, CHICKEN_TYPES,
  SLOWMO_MS, SLOWMO_SCALE,
} from "./config.js";
import { LEVELS } from "./levels.js";
import {
  engine, world, makeBlock, makeChicken, makeCat, makeCatPiece, clearBodies,
} from "./physics.js";
import { shakeCamera } from "./render.js";
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
  // Offer Resume only when a level is actually mid-play (not on a menu/end
  // screen). Resuming just unpauses and closes the overlay.
  const playable = ["ready", "aiming", "flying", "between"].includes(G.state);
  const wasStarted = G.started;
  G.started = false;                       // pause physics while choosing
  showLevelSelect({
    onSelect: startLevel,
    onBack: openMenu,
    onResume: (playable && wasStarted) ? resumeLevel : null,
  });
}

// Continue the current attempt after pausing via the level-select / menu.
export function resumeLevel() {
  G.started = true;
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
  if (G.catPieces && G.catPieces.length) {
    G.catPieces.forEach((p) => Composite.remove(world, p));
  }
  G.catPieces = [];
  G.abilityReady = false;
  G.particles = [];
  G.popups = [];
  G.catTrail = [];
  G.catSquashT = 0;
  G.catLastSpeed = 0;
  G.slowMoMs = -1;
  G.timeScale = 1;
  G.camera.shakeT = 0;

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
  const lvl = LEVELS[G.levelIndex];
  // Cats come out of the level queue in order: index = how many already used.
  const queue = (lvl && lvl.cats) || [];
  const used = queue.length - G.remainingCats;
  const type = (queue[used] && CAT_TYPES[queue[used]]) ? queue[used] : DEFAULT_CAT_TYPE;
  G.catType = type;
  G.cat = makeCat(type);
  G.catPieces = [];
  G.abilityReady = false;       // only armed once launched
  G.dragPoint = null;
  G.catTrail = [];              // clear juice carryover from the previous cat
  G.catSquashT = 0;
  G.catLastSpeed = 0;
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
  // Arm the in-flight ability if this cat type has one.
  const def = CAT_TYPES[G.catType] || CAT_TYPES[DEFAULT_CAT_TYPE];
  G.abilityReady = !!(def && def.ability);
  G.remainingCats -= 1;
  G.state = "flying";
  G.stillMs = 0;
  G.flyingMs = 0;
  G.settleMs = -1;
  G.dragPoint = null;
  // Juice: stretch the cat along its launch direction; clear any old trail.
  G.catSquashT = 1;
  G.catSquashSign = 1;          // +1 = stretch (launch), -1 = squash (impact)
  G.catLastSpeed = Vector.magnitude(v);
  G.catTrail = [];
  sndLaunch();
  updateHUD();
}

// Settle the round once the launched cat comes to rest or leaves the arena.
export function catSettled() {
  if (G.cat) { Composite.remove(world, G.cat); G.cat = null; }
  if (G.catPieces && G.catPieces.length) {
    G.catPieces.forEach((p) => Composite.remove(world, p));
    G.catPieces = [];
  }
  G.abilityReady = false;
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
  G.started = false;                                 // freeze physics behind the results overlay
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
  G.started = false;                 // freeze physics behind the results overlay
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
        defeatChicken(chicken, chickenPoints(chicken));
        sndHit();
        continue;
      }
      // Helmet chickens shrug off crush/debris; only a direct cat (above) or a
      // bomber explosion can defeat them.
      if (rel > 9 && chicken.gameArmor !== "helmet") {
        defeatChicken(chicken, Math.round(chickenPoints(chicken) * 0.5));
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
  shakeCamera(5, 0.5);            // juice: jolt on a block shatter
  G.score += BLOCK_POINTS;
  G.popups.push({ x: block.position.x, y: block.position.y, text: "+" + BLOCK_POINTS, life: 60 });
  updateHUD();
}

function pickType(a, b, type) {
  if (a.gameType === type) return a;
  if (b.gameType === type) return b;
  return null;
}

function chickenPoints(chicken) {
  const t = CHICKEN_TYPES[chicken.gameChickenType];
  return (t && t.points) || 100;
}

export function defeatChicken(chicken, points) {
  if (!chicken.alive) return;
  chicken.alive = false;
  G.score += points;
  spawnFeathers(chicken.position.x, chicken.position.y);
  spawnPop(chicken.position.x, chicken.position.y);
  G.popups.push({ x: chicken.position.x, y: chicken.position.y, text: "+" + points, life: 60 });
  Composite.remove(world, chicken);
  updateHUD();

  // End the round promptly once the last chicken falls, rather than waiting
  // for the still-moving cat to come to rest.
  if (aliveChickens() === 0 && (G.state === "flying" || G.state === "between")) {
    G.state = "between";
    G.settleMs = Math.min(G.settleMs < 0 ? Infinity : G.settleMs, 600);
    // Juice: a brief slow-motion beat on the level's final chicken. The main
    // loop scales the timestep; the fixed step stays constant so it's stable.
    triggerSlowMo();
  }
}

// Kick off a short slow-motion window. settleMs runs in *simulated* ms, so
// scaling the timestep automatically lengthens the real-time 'between' beat to
// match — the next cat still loads cleanly when the window ends.
function triggerSlowMo() {
  if (G.slowMoMs >= 0) return;       // don't restack
  G.slowMoMs = SLOWMO_MS;
  G.timeScale = SLOWMO_SCALE;
}

// A quick scale-up "pop" burst on chicken defeat: a few large, slow, fast-
// fading puffs that read as a satisfying squish.
export function spawnPop(x, y) {
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const spd = 1.5 + Math.random() * 1.5;
    G.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 7 + Math.random() * 5,
      life: 16 + Math.random() * 8,
      color: "rgba(255,255,255,0.9)",
    });
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

// ---- In-flight abilities --------------------------------------------------
// Called by input.js on a tap while a special cat is flying. Fires once.
export function activateAbility() {
  if (G.state !== "flying" || !G.abilityReady || !G.cat) return false;
  const def = CAT_TYPES[G.catType] || CAT_TYPES[DEFAULT_CAT_TYPE];
  if (!def || !def.ability) return false;
  G.abilityReady = false;            // one-shot
  switch (def.ability) {
    case "dash":    abilityDash();    break;
    case "explode": abilityExplode(); break;
    case "split":   abilitySplit();   break;
    case "slam":    abilitySlam();    break;
    default: return false;
  }
  return true;
}

function abilityDash() {
  const v = G.cat.velocity;
  const mag = Vector.magnitude(v);
  // Boost along current travel direction; if nearly still, dash forward+down.
  const dir = mag > 0.01 ? Vector.div(v, mag) : { x: 0.85, y: 0.2 };
  Body.setVelocity(G.cat, Vector.mult(dir, DASH_SPEED));
  spawnDash(G.cat.position.x, G.cat.position.y, dir);
  sndLaunch();
}

function abilitySlam() {
  const v = G.cat.velocity;
  // Keep a little forward momentum, drive hard downward.
  Body.setVelocity(G.cat, { x: v.x * 0.4, y: SLAM_SPEED });
  shakeCamera(8, 0.7);          // juice: heavy slam jolt
  sndThud();
}

function abilitySplit() {
  const base = G.cat;
  const v = base.velocity;
  const speed = Math.max(6, Vector.magnitude(v));
  const baseAng = Math.atan2(v.y, v.x);
  const px = base.position.x, py = base.position.y;
  // Remove the original; replace with a fan of smaller pieces.
  Composite.remove(world, base);
  G.cat = null;
  G.catPieces = G.catPieces || [];
  const n = SPLIT_COUNT;
  for (let i = 0; i < n; i++) {
    const frac = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;     // -1..1
    const ang = baseAng + frac * SPLIT_SPREAD;
    const piece = makeCatPiece(px, py, "splitter");
    Body.scale(piece, SPLIT_RADIUS_MUL, SPLIT_RADIUS_MUL);
    piece.gameR = (piece.gameR || 0) * SPLIT_RADIUS_MUL;   // keep sprite size in sync
    Body.setVelocity(piece, { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed });
    Body.setAngularVelocity(piece, 0.25);
    G.catPieces.push(piece);
  }
  // Steer checkFlying / settle logic onto the first piece, and give the fresh
  // pieces a full flight window so they aren't force-settled right after a late
  // split.
  G.cat = G.catPieces[0];
  G.flyingMs = 0;
  G.stillMs = 0;
  sndLaunch();
}

function abilityExplode() {
  const cx = G.cat.position.x, cy = G.cat.position.y;
  const R = EXPLODE_RADIUS;
  // Radial impulse + damage to nearby blocks; defeat nearby chickens (incl.
  // helmets — an explosion is a direct cat effect).
  for (const c of G.chickens) {
    if (!c.alive) continue;
    if (Vector.magnitude(Vector.sub(c.position, { x: cx, y: cy })) <= R) {
      pushFromBlast(c, cx, cy, R);
      defeatChicken(c, chickenPoints(c));
    }
  }
  for (let i = G.blocks.length - 1; i >= 0; i--) {
    const blk = G.blocks[i];
    const d = Vector.magnitude(Vector.sub(blk.position, { x: cx, y: cy }));
    if (d <= R) {
      pushFromBlast(blk, cx, cy, R);
      if (blk.gameHp != null) {
        blk.gameHp -= (blk.gameMaxHp || 100) * (1 - d / R) * 1.6;
        if (blk.gameHp <= 0) destroyBlock(blk);
      }
    }
  }
  spawnBlast(cx, cy);
  shakeCamera(14, 1);            // juice: big jolt on a bomber detonation
  sndBreak();
  sndHit();
  // The bomber itself is spent on detonation.
  if (G.cat) { Composite.remove(world, G.cat); G.cat = null; }
  if (aliveChickens() === 0 && (G.state === "flying" || G.state === "between")) {
    G.state = "between";
    G.settleMs = 500;
  } else {
    G.state = "between";
    G.settleMs = 350;
  }
}

function pushFromBlast(body, cx, cy, R) {
  if (body.isStatic) return;
  const dx = body.position.x - cx;
  const dy = body.position.y - cy;
  const d = Math.max(8, Math.hypot(dx, dy));
  const falloff = Math.max(0, 1 - d / R);
  const mag = EXPLODE_IMPULSE * falloff * (body.mass || 1);
  Body.applyForce(body, body.position, { x: (dx / d) * mag, y: (dy / d) * mag });
}

function spawnBlast(x, y) {
  for (let i = 0; i < 26; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 3 + Math.random() * 7;
    G.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 3 + Math.random() * 5,
      life: 30 + Math.random() * 25,
      color: Math.random() < 0.5 ? "#ff8c1a" : "#ffd23f",
    });
  }
}

function spawnDash(x, y, dir) {
  for (let i = 0; i < 10; i++) {
    G.particles.push({
      x: x - dir.x * i * 4,
      y: y - dir.y * i * 4,
      vx: -dir.x * (1 + Math.random() * 2),
      vy: -dir.y * (1 + Math.random() * 2),
      r: 2 + Math.random() * 3,
      life: 18 + Math.random() * 12,
      color: "#dff3ff",
    });
  }
}

// ---- Simulation step ------------------------------------------------------
// Push a motion-trail sample at the cat's current position when it's moving
// fast enough to read; samples fade out (life counts down each step).
function sampleTrail(speed) {
  if (!G.cat || speed < 4) return;
  const t = G.catTrail || (G.catTrail = []);
  t.unshift({ x: G.cat.position.x, y: G.cat.position.y, r: G.cat.gameR, life: 16, max: 16 });
  if (t.length > 16) t.length = 16;
}

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
  // Age the motion trail.
  if (G.catTrail && G.catTrail.length) {
    for (const s of G.catTrail) s.life -= 1;
    G.catTrail = G.catTrail.filter((s) => s.life > 0);
  }
}

export function checkFlying(dt) {
  if (G.state !== "flying" || !G.cat) return;
  const speed = Vector.magnitude(G.cat.velocity);
  // Juice: drop a fading motion-trail sample behind a fast-moving cat, and
  // detect a hard deceleration (slam into a structure) to trigger an impact
  // squash + screen shake.
  sampleTrail(speed);
  if (G.catLastSpeed - speed > 9 && speed < G.catLastSpeed * 0.6) {
    G.catSquashT = 1;
    G.catSquashSign = -1;       // compress on a hard hit
    shakeCamera(Math.min(10, (G.catLastSpeed - speed) * 0.5), 0.7);
  }
  G.catLastSpeed = speed;
  // Consider ALL active projectiles. A splitter spawns several pieces, and
  // catSettled deletes every piece — so the round must not settle until each
  // one is at rest or off-screen, otherwise still-airborne pieces are destroyed
  // before they can land their hits.
  const active = (G.catPieces && G.catPieces.length) ? G.catPieces : [G.cat];
  const maxSpeed = active.reduce((m, p) => Math.max(m, Vector.magnitude(p.velocity)), 0);
  const allOff = active.every((p) =>
    p.position.y > H + 150 || p.position.x > W + 200 || p.position.x < -200);
  G.stillMs = maxSpeed < 0.45 ? G.stillMs + dt : 0;
  G.flyingMs += dt;
  // Settle when all projectiles rest, all leave the arena, or the hard time
  // limit hits (guarantees the next cat always loads). Time-based for refresh
  // independence.
  if (G.stillMs > 750 || allOff || G.flyingMs > 6000) {
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
