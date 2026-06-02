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
