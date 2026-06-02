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
};
