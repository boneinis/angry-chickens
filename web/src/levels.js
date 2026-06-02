// ---- Levels: structures + chickens, in world coordinates -----------------
// b = block {x,y,w,h}, c = chicken {x,y}
export const LEVELS = [
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
      // exposed chicken on a low platform
      { x: 700, y: 600, w: 140, h: 20 },
      // second chicken perched on a short, knock-down stack (open — not caged)
      { x: 1000, y: 600, w: 140, h: 20 },
      { x: 1000, y: 580, w: 140, h: 20 },
    ],
    chickens: [{ x: 700, y: 562 }, { x: 1000, y: 542 }],
  },
  {
    name: "Twin Towers",
    blocks: [
      // left tower: two posts + a platform, chicken perched on top (open)
      { x: 790, y: 560, w: 20, h: 80 },
      { x: 850, y: 560, w: 20, h: 80 },
      { x: 820, y: 510, w: 100, h: 20 },
      // right tower
      { x: 1110, y: 560, w: 20, h: 80 },
      { x: 1170, y: 560, w: 20, h: 80 },
      { x: 1140, y: 510, w: 100, h: 20 },
      // middle platform with an exposed chicken
      { x: 965, y: 600, w: 140, h: 20 },
    ],
    chickens: [{ x: 820, y: 472 }, { x: 1140, y: 472 }, { x: 965, y: 562 }],
  },
];
