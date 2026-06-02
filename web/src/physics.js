// Matter is loaded as a global UMD script before the module entry point.
import { G } from "./state.js";
import {
  W, H, GROUND_H, GROUND_TOP, SLING, CAT_R, CHICK_R, GRAVITY_SCALE, CAT_CATEGORY,
} from "./config.js";

const Matter = window.Matter;
const { Engine, Composite, Bodies, Body } = Matter;

// ---- Engine ---------------------------------------------------------------
export const engine = Engine.create();
engine.gravity.y = 1;
engine.gravity.scale = GRAVITY_SCALE;
export const world = engine.world;

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

// ---- Body factories -------------------------------------------------------
export function makeBlock(b) {
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
  G.blocks.push(body);
  Composite.add(world, body);
  return body;
}

export function makeChicken(c) {
  const body = Bodies.circle(c.x, c.y, CHICK_R, {
    friction: 0.5,
    restitution: 0.05,
    density: 0.001,
    collisionFilter: { category: CAT_CATEGORY.chicken },
    gameType: "chicken",
    alive: true,
  });
  G.chickens.push(body);
  Composite.add(world, body);
  return body;
}

export function makeCat() {
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

export function clearBodies(list) {
  list.forEach((b) => Composite.remove(world, b));
  list.length = 0;
}
