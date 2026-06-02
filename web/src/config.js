// ---- World constants (fixed logical resolution, scaled to fit screen) ----
export const W = 1280;
export const H = 720;
export const GROUND_H = 110;
export const GROUND_TOP = H - GROUND_H;          // y of the ground surface

export const SLING = { x: 230, y: 470 };          // cat rest position (fork pocket)
export const FORK_BASE_Y = GROUND_TOP;            // bottom of the slingshot post
export const MAX_STRETCH = 150;                   // max pull distance
export const LAUNCH_FACTOR = 0.16;                // pull distance -> launch speed
export const GRAVITY_SCALE = 0.0022;              // tuned so shots arc within the arena
export const CAT_R = 26;
export const CHICK_R = 28;
export const CATS_PER_LEVEL = 3;
export const CAT_BONUS = 1000;                     // points per unused cat on clear
export const FIXED_DT = 1000 / 60;                // fixed physics timestep (ms)
export const MAX_SUBSTEPS = 5;                     // cap steps/frame to avoid spiral

// ---- Collision categories (mirrors the old PhysicsCategory.swift) ----
export const CAT_CATEGORY = {
  cat: 0x0001,
  chicken: 0x0002,
  block: 0x0004,
  ground: 0x0008,
};

// ---- Destructible block materials ----------------------------------------
// Per-material tuning: `density` feeds Matter's mass calc, `strength` scales a
// block's hit points (and thus how hard it is to destroy), color/stroke drive
// rendering.
export const MATERIALS = {
  wood:  { density: 0.0016, strength: 1.0,  color: "#b5793b", stroke: "#8a5524" },
  ice:   { density: 0.0011, strength: 0.45, color: "#bfe6f5", stroke: "#8fcbe0" }, // weak, shatters easily
  stone: { density: 0.0030, strength: 2.4,  color: "#9aa1a8", stroke: "#6f767d" }, // tough, heavy
};
export const DEFAULT_MATERIAL = "wood";

// Base hit points before the material strength multiplier is applied.
export const BLOCK_BASE_HP = 100;
// Points awarded for destroying a block.
export const BLOCK_POINTS = 50;
// Minimum relative impact speed that deals ANY damage. Must sit comfortably
// above the speeds seen while blocks rest/settle on load (those are < ~3),
// so idle structures never self-destruct.
export const DAMAGE_THRESHOLD = 7;
// Converts excess impact speed (above the threshold) into hit-point damage.
export const DAMAGE_SCALE = 9;

// ---- Cat (projectile) types ----------------------------------------------
// Each cat type optionally carries an in-flight ability triggered by a tap.
// `ability` is null for plain cats. `densityMul`/`radiusMul` scale the base
// CAT_R / density so heavier/bigger types feel distinct. `color`/`accent`
// drive rendering so the player can tell them apart. Every type is at LEAST
// as capable as "basic" on a direct hit, so levels stay beatable without taps.
export const CAT_TYPES = {
  basic:   { ability: null,      densityMul: 1.0, radiusMul: 1.0,  color: "#8a8a8a", stroke: "#5e5e5e", accent: "#a5d65b" },
  speedy:  { ability: "dash",    densityMul: 0.8, radiusMul: 0.92, color: "#7fc4ff", stroke: "#3f86c4", accent: "#dff3ff" },
  bomber:  { ability: "explode", densityMul: 1.1, radiusMul: 1.0,  color: "#3a3a3a", stroke: "#111111", accent: "#ff8c1a" },
  splitter:{ ability: "split",   densityMul: 1.0, radiusMul: 1.0,  color: "#c98bff", stroke: "#8a4fc4", accent: "#ffe27a" },
  heavy:   { ability: "slam",    densityMul: 2.2, radiusMul: 1.18, color: "#6b5436", stroke: "#3f3018", accent: "#d8b06a" },
};
export const DEFAULT_CAT_TYPE = "basic";

// Ability tuning.
export const DASH_SPEED = 26;          // target speed (logical px/step) after a dash
export const SLAM_SPEED = 30;          // downward speed after a heavy slam
export const SPLIT_COUNT = 3;          // pieces a splitter becomes
export const SPLIT_SPREAD = 0.35;      // fan half-angle (radians) between pieces
export const SPLIT_RADIUS_MUL = 0.6;   // size of each split piece vs base
export const EXPLODE_RADIUS = 170;     // blast radius (logical px)
export const EXPLODE_IMPULSE = 0.32;   // radial impulse strength at the center

// ---- Chicken (target) types ----------------------------------------------
// `radiusMul`/`densityMul` scale the base CHICK_R / density. `armor:"helmet"`
// makes a chicken immune to crush/debris (only a direct cat hit or a bomber
// explosion defeats it). All types remain ONE-hit on a direct strike.
export const CHICKEN_TYPES = {
  basic:  { radiusMul: 1.0,  densityMul: 1.0, armor: null,     points: 100 },
  helmet: { radiusMul: 1.0,  densityMul: 1.3, armor: "helmet", points: 150 },
  big:    { radiusMul: 1.45, densityMul: 2.4, armor: null,     points: 150 },
};
export const DEFAULT_CHICKEN_TYPE = "basic";
