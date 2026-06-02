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
