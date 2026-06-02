// ---- Levels: structures + chickens, in world coordinates -----------------
// Schema v2. Each level:
//   { id, name, cats, stars, bg, width, blocks, chickens }
// - block  = { x, y, w, h, material:"wood"|"ice"|"stone", angle:0 }
// - chicken = { x, y, type:"basic"|"helmet"|"big" }
// - cats    = ["basic"|"speedy"|"bomber"|"splitter"|"heavy", ...] (queue order)
// The engine reads block x,y,w,h+material, chicken x,y+type, and the cats queue.
// Design rules honored here:
//   - chickens are never fully enclosed (always reachable / perched in the open)
//   - everything sits inside the arena (targets x ~600..1180, on ground/platforms)
//   - a platform's top edge = (y - h/2); a chicken resting on it has y = top - 28
//   - every level is clearable with PLAIN DIRECT HITS (no ability taps required):
//     special cats are >= basic, helmet/big chickens die to one direct cat hit.
//
// GROUND_TOP = 610. A block resting flat on the ground has y = 610 - h/2.
// CHICK_R = 28: a chicken on the ground has y = 610 - 28 = 582.
export const LEVELS = [
  // 1-1 — single exposed target, dead simple.
  {
    id: "1-1",
    name: "First Fling",
    cats: ["basic", "basic", "basic"],
    stars: [100, 1100, 2100],
    bg: "day",
    width: 1280,
    blocks: [
      { x: 1000, y: 600, w: 200, h: 20, material: "wood", angle: 0 }, // low open platform
    ],
    chickens: [{ x: 1000, y: 562, type: "basic" }],                    // out in the open
  },

  // 1-2 — two ground-level targets, no cover.
  {
    id: "1-2",
    name: "Sunny Pasture",
    cats: ["basic", "basic", "basic"],
    stars: [200, 1200, 2200],
    bg: "day",
    width: 1280,
    blocks: [],
    chickens: [
      { x: 760, y: 582, type: "basic" },   // resting on the ground
      { x: 1040, y: 582, type: "basic" },
    ],
  },

  // 1-3 — a chicken perched on a short, knock-down stack (open, no roof).
  // Introduces the speedy cat (still a normal direct-hit projectile).
  {
    id: "1-3",
    name: "Little Lookout",
    cats: ["speedy", "basic", "basic"],
    stars: [200, 1200, 2200],
    bg: "day",
    width: 1280,
    blocks: [
      { x: 980, y: 590, w: 90, h: 40, material: "wood", angle: 0 },  // base block
      { x: 980, y: 555, w: 90, h: 30, material: "wood", angle: 0 },  // cap (top edge y=540)
    ],
    chickens: [
      { x: 720, y: 582, type: "basic" },   // ground target
      { x: 980, y: 512, type: "basic" },   // perched on the open stack
    ],
  },

  // 2-1 — two simple posts holding an open lintel; chicken on top.
  {
    id: "2-1",
    name: "The Gateway",
    cats: ["basic", "basic", "basic"],
    stars: [200, 1200, 2200],
    bg: "day",
    width: 1280,
    blocks: [
      { x: 940, y: 560, w: 20, h: 100, material: "wood", angle: 0 },  // left post
      { x: 1040, y: 560, w: 20, h: 100, material: "wood", angle: 0 }, // right post
      { x: 990, y: 500, w: 140, h: 20, material: "wood", angle: 0 },  // lintel (top edge y=490)
    ],
    chickens: [
      { x: 700, y: 582, type: "helmet" },  // exposed ground target wearing a helmet (direct hit clears it)
      { x: 990, y: 462, type: "basic" },   // perched on the lintel (open above)
    ],
  },

  // 2-2 — ice tower: tall stack with a chicken on top, one on the ground.
  {
    id: "2-2",
    name: "Frozen Perch",
    cats: ["basic", "basic", "basic"],
    stars: [200, 1200, 2300],
    bg: "snow",
    width: 1280,
    blocks: [
      // a single solid ice pillar (no inter-block settling) — top edge y=510
      { x: 1000, y: 560, w: 90, h: 100, material: "ice", angle: 0 },
    ],
    chickens: [
      { x: 680, y: 582, type: "basic" },   // ground
      { x: 1000, y: 482, type: "basic" },  // top of the open tower
    ],
  },

  // 2-3 — two small towers, exposed chicken between them on the ground.
  {
    id: "2-3",
    name: "Twin Lookouts",
    cats: ["speedy", "basic", "basic"],
    stars: [300, 1300, 2400],
    bg: "day",
    width: 1280,
    blocks: [
      // left tower
      { x: 760, y: 560, w: 20, h: 100, material: "wood", angle: 0 },
      { x: 820, y: 560, w: 20, h: 100, material: "wood", angle: 0 },
      { x: 790, y: 500, w: 100, h: 20, material: "wood", angle: 0 },  // top edge y=490
      // right tower
      { x: 1100, y: 560, w: 20, h: 100, material: "wood", angle: 0 },
      { x: 1160, y: 560, w: 20, h: 100, material: "wood", angle: 0 },
      { x: 1130, y: 500, w: 100, h: 20, material: "wood", angle: 0 }, // top edge y=490
    ],
    chickens: [
      { x: 790, y: 462, type: "basic" },   // left tower top
      { x: 960, y: 568, type: "big" },     // exposed big chicken on the ground (1 direct hit)
      { x: 1130, y: 462, type: "basic" },  // right tower top
    ],
  },

  // 3-1 — stepped staircase of stone blocks, chickens on the open steps.
  {
    id: "3-1",
    name: "Stone Steps",
    cats: ["bomber", "basic", "basic"],
    stars: [300, 1300, 2400],
    bg: "day",
    width: 1280,
    blocks: [
      { x: 760, y: 585, w: 90, h: 50, material: "stone", angle: 0 },  // step 1 top edge y=560
      { x: 900, y: 570, w: 90, h: 80, material: "stone", angle: 0 },  // step 2 top edge y=530
      { x: 1040, y: 555, w: 90, h: 110, material: "stone", angle: 0 },// step 3 top edge y=500
    ],
    chickens: [
      { x: 760, y: 532, type: "basic" },   // on step 1
      { x: 1040, y: 472, type: "basic" },  // on the tallest step
    ],
  },

  // 3-2 — a low wall guards two grounded chickens behind it (open above).
  {
    id: "3-2",
    name: "Behind the Wall",
    cats: ["basic", "basic", "basic"],
    stars: [300, 1300, 2400],
    bg: "day",
    width: 1280,
    blocks: [
      { x: 820, y: 560, w: 30, h: 100, material: "stone", angle: 0 }, // wall (top edge y=510)
    ],
    chickens: [
      { x: 940, y: 582, type: "basic" },   // behind the wall, open above
      { x: 1080, y: 582, type: "basic" },  // behind the wall, open above
    ],
  },

  // 3-3 — three perches at varied heights; arc practice.
  {
    id: "3-3",
    name: "Rolling Hills",
    cats: ["splitter", "basic", "basic"],
    stars: [300, 1300, 2400],
    bg: "day",
    width: 1280,
    blocks: [
      { x: 700, y: 600, w: 110, h: 20, material: "wood", angle: 0 },  // low platform top edge y=590
      { x: 1010, y: 555, w: 60, h: 110, material: "wood", angle: 0 }, // solid mid pillar top edge y=500
    ],
    chickens: [
      { x: 700, y: 562, type: "basic" },   // left low perch
      { x: 880, y: 582, type: "helmet" },  // exposed on the ground (direct hit clears the helmet)
      { x: 1010, y: 472, type: "basic" },  // mid-high perch on the open pillar
    ],
  },

  // 4-1 — mixed-material fort: posts + open platform, plus a ground guard.
  {
    id: "4-1",
    name: "Mixed Fort",
    cats: ["heavy", "basic", "basic", "basic"],
    stars: [300, 1300, 2500],
    bg: "dusk",
    width: 1280,
    blocks: [
      { x: 700, y: 585, w: 80, h: 50, material: "stone", angle: 0 },  // front guard block (top edge y=560)
      { x: 980, y: 555, w: 20, h: 110, material: "wood", angle: 0 },  // left post
      { x: 1080, y: 555, w: 20, h: 110, material: "wood", angle: 0 }, // right post
      { x: 1030, y: 490, w: 140, h: 20, material: "wood", angle: 0 }, // platform top edge y=480
    ],
    chickens: [
      { x: 700, y: 532, type: "basic" },   // on the front block
      { x: 1030, y: 452, type: "basic" },  // perched up top (open)
    ],
  },

  // 4-2 — two-tier open structure, three chickens spread across heights.
  {
    id: "4-2",
    name: "Layer Cake",
    cats: ["splitter", "basic", "basic", "basic"],
    stars: [300, 1400, 2600],
    bg: "dusk",
    width: 1280,
    blocks: [
      // ground tier posts + platform
      { x: 860, y: 560, w: 20, h: 100, material: "wood", angle: 0 },
      { x: 1080, y: 560, w: 20, h: 100, material: "wood", angle: 0 },
      { x: 970, y: 500, w: 260, h: 20, material: "wood", angle: 0 },  // tier-1 top edge y=490
      // upper tier posts + platform
      { x: 920, y: 460, w: 18, h: 60, material: "ice", angle: 0 },
      { x: 1020, y: 460, w: 18, h: 60, material: "ice", angle: 0 },
      { x: 970, y: 420, w: 140, h: 20, material: "ice", angle: 0 },   // tier-2 top edge y=410
    ],
    chickens: [
      { x: 700, y: 568, type: "big" },     // exposed big ground target (1 direct hit)
      { x: 880, y: 462, type: "basic" },   // on tier-1 platform (left of upper posts, open)
      { x: 970, y: 382, type: "basic" },   // on top tier (open)
    ],
  },

  // 4-3 — finale: a tall tower flanked by a low outpost; four targets, open.
  {
    id: "4-3",
    name: "Castle Siege",
    cats: ["bomber", "heavy", "splitter", "basic"],
    stars: [400, 1500, 2800],
    bg: "dusk",
    width: 1280,
    blocks: [
      // low outpost
      { x: 680, y: 590, w: 100, h: 40, material: "stone", angle: 0 }, // top edge y=570
      // central tower: solid stone side walls hold a wide platform (top edge y=490)
      { x: 1000, y: 560, w: 36, h: 100, material: "stone", angle: 0 },// left wall
      { x: 1100, y: 560, w: 36, h: 100, material: "stone", angle: 0 },// right wall
      { x: 1050, y: 500, w: 150, h: 20, material: "wood", angle: 0 }, // tier-1 top edge y=490
      // upper tier: a single solid wood pedestal (top edge y=410)
      { x: 1075, y: 450, w: 90, h: 80, material: "wood", angle: 0 },
    ],
    chickens: [
      { x: 680, y: 542, type: "basic" },   // on the outpost
      { x: 870, y: 582, type: "helmet" },  // exposed on the ground (direct hit clears the helmet)
      { x: 985, y: 462, type: "basic" },   // on tier-1 (left, open)
      { x: 1075, y: 382, type: "basic" },  // on the upper pedestal (open)
    ],
  },
];
