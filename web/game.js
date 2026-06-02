/*
 * Angry Chickens — browser edition
 * Fling cats from a slingshot to knock down structures and defeat chickens.
 * Physics: Matter.js (rigid bodies). Rendering: hand-drawn on a 2D canvas.
 */
(() => {
  "use strict";

  const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;

  // ---- World constants (fixed logical resolution, scaled to fit screen) ----
  const W = 1280;
  const H = 720;
  const GROUND_H = 110;
  const GROUND_TOP = H - GROUND_H;          // y of the ground surface

  const SLING = { x: 230, y: 470 };          // cat rest position (fork pocket)
  const FORK_BASE_Y = GROUND_TOP;            // bottom of the slingshot post
  const MAX_STRETCH = 150;                   // max pull distance
  const LAUNCH_FACTOR = 0.16;                // pull distance -> launch speed
  const GRAVITY_SCALE = 0.0022;              // tuned so shots arc within the arena
  const CAT_R = 26;
  const CHICK_R = 28;
  const CATS_PER_LEVEL = 3;
  const FIXED_DT = 1000 / 60;                // fixed physics timestep (ms)
  const MAX_SUBSTEPS = 5;                     // cap steps/frame to avoid spiral

  // ---- Collision categories (mirrors the old PhysicsCategory.swift) ----
  const CAT_CATEGORY = {
    cat: 0x0001,
    chicken: 0x0002,
    block: 0x0004,
    ground: 0x0008,
  };

  // ---- Levels: structures + chickens, in world coordinates -----------------
  // b = block {x,y,w,h}, c = chicken {x,y}
  const LEVELS = [
    {
      name: "Tutorial",
      blocks: [
        { x: 1000, y: 600, w: 200, h: 20 },   // exposed platform on the ground
      ],
      chickens: [{ x: 1000, y: 562 }],         // chicken sits out in the open
    },
    {
      name: "The Coop",
      blocks: [
        // open platform with an exposed chicken
        { x: 720, y: 600, w: 140, h: 20 },
        // a crated chicken: knock the structure to defeat it
        { x: 1010, y: 600, w: 160, h: 20 },
        { x: 945, y: 530, w: 20, h: 120 },
        { x: 1075, y: 530, w: 20, h: 120 },
        { x: 1010, y: 460, w: 160, h: 20 },
      ],
      chickens: [{ x: 720, y: 562 }, { x: 1010, y: 562 }],
    },
    {
      name: "Twin Towers",
      blocks: [
        // left tower
        { x: 790, y: 530, w: 20, h: 120 },
        { x: 870, y: 530, w: 20, h: 120 },
        { x: 830, y: 460, w: 120, h: 20 },
        // right tower
        { x: 1090, y: 530, w: 20, h: 120 },
        { x: 1170, y: 530, w: 20, h: 120 },
        { x: 1130, y: 460, w: 120, h: 20 },
        // middle platform
        { x: 980, y: 600, w: 160, h: 20 },
      ],
      chickens: [{ x: 830, y: 432 }, { x: 1130, y: 432 }, { x: 980, y: 562 }],
    },
  ];

  // ---- DOM ------------------------------------------------------------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // Match the backing store to the displayed size × DPR so the art stays crisp
  // on high-density screens; we keep drawing in fixed W×H logical coordinates.
  function setupCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  window.addEventListener("resize", setupCanvas);

  const levelPill = document.getElementById("level-pill");
  const catsPill = document.getElementById("cats-pill");
  const scorePill = document.getElementById("score-pill");
  const muteBtn = document.getElementById("mute-btn");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayBtn = document.getElementById("overlay-btn");
  const hint = document.getElementById("hint");

  // ---- Engine ---------------------------------------------------------------
  const engine = Engine.create();
  engine.gravity.y = 1;
  engine.gravity.scale = GRAVITY_SCALE;
  const world = engine.world;

  // Static scenery: ground + side/top walls
  const ground = Bodies.rectangle(W / 2, GROUND_TOP + GROUND_H / 2, W, GROUND_H, {
    isStatic: true,
    friction: 0.9,
    collisionFilter: { category: CAT_CATEGORY.ground },
    gameType: "ground",
  });
  // Containment walls (left, right, top) so bodies can't escape the arena.
  const walls = [
    Bodies.rectangle(-30, H / 2, 60, H * 3, { isStatic: true }),
    Bodies.rectangle(W + 30, H / 2, 60, H * 3, { isStatic: true }),
    Bodies.rectangle(W / 2, -H, W, 60, { isStatic: true }),
  ];
  Composite.add(world, [ground, ...walls]);

  // ---- Game state -----------------------------------------------------------
  let state = "ready";        // ready | aiming | flying | between | gameover | win
  let levelIndex = 0;
  let score = 0;
  let levelStartScore = 0;    // score on entering the current level (for retries)
  let remainingCats = CATS_PER_LEVEL;
  let blocks = [];
  let chickens = [];
  let cat = null;             // current launchable cat body
  let dragPoint = null;       // current pointer position while aiming (world coords)
  let stillMs = 0;            // ms the cat has been (near) still
  let flyingMs = 0;           // ms since launch (hard timeout)
  let settleMs = -1;          // ms left in 'between' before the next cat (-1 = idle)
  let particles = [];         // feather/dust bits
  let popups = [];            // floating score text
  let started = false;

  // ---- Audio (tiny WebAudio blips, no asset files) --------------------------
  let muted = false;
  let audioCtx = null;
  function beep(freq, dur, type = "sine", vol = 0.2) {
    if (muted) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.stop(t + dur);
    } catch (e) { /* audio not available */ }
  }
  // Create/resume the AudioContext from a user gesture (browsers start it
  // suspended otherwise, silently dropping all sound).
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) { /* audio not available */ }
  }
  const sndLaunch = () => beep(220, 0.18, "triangle", 0.25);
  const sndHit = () => { beep(640, 0.08, "square", 0.18); beep(320, 0.16, "square", 0.12); };
  const sndThud = () => beep(90, 0.1, "sine", 0.15);

  // ---- Body factories -------------------------------------------------------
  function makeBlock(b) {
    const body = Bodies.rectangle(b.x, b.y, b.w, b.h, {
      friction: 0.6,
      frictionStatic: 0.8,
      restitution: 0.02,
      density: 0.0016,
      chamfer: { radius: 3 },
      collisionFilter: { category: CAT_CATEGORY.block },
      gameType: "block",
      gameW: b.w,
      gameH: b.h,
    });
    blocks.push(body);
    Composite.add(world, body);
    return body;
  }

  function makeChicken(c) {
    const body = Bodies.circle(c.x, c.y, CHICK_R, {
      friction: 0.5,
      restitution: 0.05,
      density: 0.001,
      collisionFilter: { category: CAT_CATEGORY.chicken },
      gameType: "chicken",
      alive: true,
    });
    chickens.push(body);
    Composite.add(world, body);
    return body;
  }

  function makeCat() {
    // Create dynamic first, THEN freeze with setStatic so Matter records the
    // body's real mass — otherwise unfreezing on launch leaves mass = Infinity.
    const body = Bodies.circle(SLING.x, SLING.y, CAT_R, {
      friction: 0.4,
      restitution: 0.25,
      density: 0.005,            // heavy, for impact
      frictionAir: 0.004,
      collisionFilter: { category: CAT_CATEGORY.cat },
      gameType: "cat",
    });
    Body.setStatic(body, true);  // held until launched
    Composite.add(world, body);
    return body;
  }

  // ---- Level management -----------------------------------------------------
  function clearBodies(list) {
    list.forEach((b) => Composite.remove(world, b));
    list.length = 0;
  }

  function loadLevel(idx) {
    clearBodies(blocks);
    clearBodies(chickens);
    if (cat) { Composite.remove(world, cat); cat = null; }
    particles = [];
    popups = [];

    const lvl = LEVELS[idx];
    lvl.blocks.forEach(makeBlock);
    lvl.chickens.forEach(makeChicken);

    remainingCats = CATS_PER_LEVEL;
    prepareCat();
    state = "ready";
    updateHUD();
  }

  function prepareCat() {
    if (remainingCats <= 0) { checkEndOfRound(); return; }
    cat = makeCat();
    dragPoint = null;
    state = "ready";
  }

  // ---- Launching ------------------------------------------------------------
  function launch() {
    if (!cat || !dragPoint) return;
    const pull = Vector.sub(SLING, dragPoint);          // points opposite the drag
    const v = Vector.mult(pull, LAUNCH_FACTOR);
    Body.setStatic(cat, false);
    Body.setVelocity(cat, v);
    Body.setAngularVelocity(cat, 0.2);
    remainingCats -= 1;
    state = "flying";
    stillMs = 0;
    flyingMs = 0;
    settleMs = -1;
    dragPoint = null;
    sndLaunch();
    updateHUD();
  }

  // Settle the round once the launched cat comes to rest or leaves the arena.
  function catSettled() {
    if (cat) { Composite.remove(world, cat); cat = null; }
    if (aliveChickens() === 0) { winLevel(); return; }
    if (remainingCats <= 0) { checkEndOfRound(); return; }
    prepareCat();
  }

  function aliveChickens() {
    return chickens.filter((c) => c.alive).length;
  }

  function checkEndOfRound() {
    if (aliveChickens() === 0) winLevel();
    else gameOver();
  }

  function winLevel() {
    if (state === "win" || state === "levelcomplete" || state === "gameover") return;
    state = "levelcomplete";
    if (levelIndex + 1 >= LEVELS.length) {
      state = "win";
      showOverlay("You Win! 🏆", `Final score: ${score}`, "Play Again", () => {
        levelIndex = 0;
        score = 0;
        levelStartScore = 0;
        loadLevel(levelIndex);
      });
    } else {
      showOverlay("Level Complete! ⭐", `Score: ${score}`, "Next Level", () => {
        levelIndex += 1;
        levelStartScore = score;     // cumulative score carries into the next level
        loadLevel(levelIndex);
      });
    }
  }

  function gameOver() {
    state = "gameover";
    showOverlay("Out of Cats! 😿", `Score: ${score}`, "Try Again", () => {
      score = levelStartScore;       // roll back points earned in the failed attempt
      loadLevel(levelIndex);
    });
  }

  // ---- Collisions -----------------------------------------------------------
  Events.on(engine, "collisionStart", (evt) => {
    for (const pair of evt.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const rel = Vector.magnitude(Vector.sub(a.velocity, b.velocity));

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

  function pickType(a, b, type) {
    if (a.gameType === type) return a;
    if (b.gameType === type) return b;
    return null;
  }

  function defeatChicken(chicken, points) {
    if (!chicken.alive) return;
    chicken.alive = false;
    score += points;
    spawnFeathers(chicken.position.x, chicken.position.y);
    popups.push({ x: chicken.position.x, y: chicken.position.y, text: "+" + points, life: 60 });
    Composite.remove(world, chicken);
    updateHUD();

    // End the round promptly once the last chicken falls, rather than waiting
    // for the still-moving cat to come to rest.
    if (aliveChickens() === 0 && (state === "flying" || state === "between")) {
      state = "between";
      settleMs = Math.min(settleMs < 0 ? Infinity : settleMs, 600);
    }
  }

  function spawnFeathers(x, y) {
    for (let i = 0; i < 12; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 2,
        r: 3 + Math.random() * 4,
        life: 40 + Math.random() * 25,
        color: Math.random() < 0.5 ? "#fff" : "#ffd23f",
      });
    }
  }

  // ---- HUD / overlay --------------------------------------------------------
  function updateHUD() {
    levelPill.textContent = `Level ${levelIndex + 1} — ${LEVELS[levelIndex].name}`;
    catsPill.textContent = `🐱 × ${Math.max(0, remainingCats)}`;
    scorePill.textContent = `Score: ${score}`;
  }

  function showOverlay(title, text, btn, onClick) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btn;
    overlay.classList.remove("hidden");
    overlayBtn.onclick = () => {
      unlockAudio();
      overlay.classList.add("hidden");
      onClick();
    };
  }

  // ---- Input ----------------------------------------------------------------
  function toWorld(evt) {
    const rect = canvas.getBoundingClientRect();
    const cx = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
    const cy = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
    return { x: cx * (W / rect.width), y: cy * (H / rect.height) };
  }

  function onDown(evt) {
    if (state !== "ready" || !cat) return;
    const p = toWorld(evt);
    if (Vector.magnitude(Vector.sub(p, cat.position)) <= CAT_R * 2.2) {
      state = "aiming";
      dragPoint = clampPull(p);
      Body.setPosition(cat, dragPoint);
      canvas.classList.add("grabbing");
      hint.classList.add("hidden");
      evt.preventDefault();
    }
  }

  function onMove(evt) {
    if (state !== "aiming") return;
    dragPoint = clampPull(toWorld(evt));
    Body.setPosition(cat, dragPoint);
    evt.preventDefault();
  }

  function onUp(evt) {
    if (state !== "aiming") return;
    canvas.classList.remove("grabbing");
    // A tiny pull is treated as a cancel (snap back).
    if (Vector.magnitude(Vector.sub(SLING, dragPoint)) < 12) {
      Body.setPosition(cat, SLING);
      dragPoint = null;
      state = "ready";
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

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
  });

  // ---- Rendering ------------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, W, H);
    drawClouds();
    drawGround();
    drawSlingshotBack();

    blocks.forEach(drawBlock);
    chickens.forEach((c) => { if (c.alive) drawChicken(c); });

    if (state === "aiming") drawTrajectory();
    if (cat) drawCat(cat);

    drawSlingshotFront();
    drawParticles();
    drawPopups();
  }

  let cloudOffset = 0;
  function drawClouds() {
    cloudOffset = (cloudOffset + 0.15) % (W + 200);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const clouds = [[150, 120, 60], [520, 90, 48], [900, 150, 70], [1150, 100, 50]];
    for (const [bx, by, r] of clouds) {
      let x = bx - cloudOffset;
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
    if (!cat || (state !== "aiming" && state !== "ready")) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(cat.position.x, cat.position.y);
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
    if (!dragPoint) return;
    const pull = Vector.sub(SLING, dragPoint);
    let vx = pull.x * LAUNCH_FACTOR;
    let vy = pull.y * LAUNCH_FACTOR;
    let px = cat.position.x;
    let py = cat.position.y;
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
    for (const p of particles) {
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
    for (const p of popups) {
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

  // ---- Simulation step ------------------------------------------------------
  function updateEffects() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;
      p.life -= 1;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of popups) { p.y -= 1.1; p.life -= 1; }
    popups = popups.filter((p) => p.life > 0);
  }

  function checkFlying(dt) {
    if (state !== "flying" || !cat) return;
    const speed = Vector.magnitude(cat.velocity);
    const offscreen = cat.position.y > H + 150 || cat.position.x > W + 200 || cat.position.x < -200;
    stillMs = speed < 0.45 ? stillMs + dt : 0;
    flyingMs += dt;
    // Settle when the cat rests for a while, leaves the arena, or hits the
    // hard time limit (guarantees the next cat always loads). Time-based so the
    // feel is identical across refresh rates.
    if (stillMs > 750 || offscreen || flyingMs > 6000) {
      state = "between";
      settleMs = 350;
    }
  }

  // Defeat chickens that get knocked off the screen.
  function cullChickens() {
    for (const c of chickens) {
      if (c.alive && (c.position.y > H + 100 || c.position.x < -100 || c.position.x > W + 100)) {
        defeatChicken(c, 50);
      }
    }
  }

  // ---- Simulation + main loop -----------------------------------------------
  // Game logic advanced once per fixed physics step (dt in ms).
  function stepSim(dt) {
    checkFlying(dt);
    cullChickens();
    updateEffects();
    if (state === "between" && settleMs >= 0) {
      settleMs -= dt;
      if (settleMs <= 0) { settleMs = -1; catSettled(); }
    }
  }

  // Fixed-timestep accumulator: Matter is only stable with a constant dt, so we
  // step it a whole number of times per frame and carry the remainder.
  let accumulator = 0;
  let last = performance.now();
  function loop(now) {
    let frame = now - last;
    last = now;
    if (started) {
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
    started = true;
    levelIndex = 0;
    score = 0;
    levelStartScore = 0;
    loadLevel(levelIndex);
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
})();
