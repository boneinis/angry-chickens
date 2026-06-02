// Single mutable object holding all game state. Every module imports G and
// reads/writes its properties (ES module live bindings can't be reassigned by
// importers, so we mutate a shared object instead).
export const G = {
  state: "ready",        // ready | aiming | flying | between | gameover | win
  levelIndex: 0,
  score: 0,
  levelStartScore: 0,    // score on entering the current level (for retries)
  remainingCats: 3,
  blocks: [],
  chickens: [],
  cat: null,             // current launchable cat body
  dragPoint: null,       // current pointer position while aiming (world coords)
  stillMs: 0,            // ms the cat has been (near) still
  flyingMs: 0,           // ms since launch (hard timeout)
  settleMs: -1,          // ms left in 'between' before the next cat (-1 = idle)
  particles: [],         // feather/dust bits
  popups: [],            // floating score text
  started: false,
  cloudOffset: 0,
  muted: false,
  audioCtx: null,

  // ---- Camera --------------------------------------------------------------
  // Composed with the DPR base transform in render(). At HOME the camera is the
  // identity (x=0,y=0,zoom=1) so aiming stays pixel-accurate. It only animates
  // during flight/between and eases back home before the next "ready".
  camera: { x: 0, y: 0, zoom: 1, shakeT: 0, shakeMag: 0, introT: 0 },

  // Timestep multiplier honored by the main loop (brief slow-motion on the
  // final chicken of a level). 1 = normal speed.
  timeScale: 1,
  // ms left of the active slow-motion window (-1 = idle).
  slowMoMs: -1,

  // Per-cat squash/stretch animation driver (set on launch / hard impact).
  catSquashT: 0,
  // Last impact speed used to scale impact squash.
  catLastSpeed: 0,
  // Motion-trail samples for the flying cat (most-recent first).
  catTrail: [],
};
