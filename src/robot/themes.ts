// Color themes. Each recolors the robot materials, the eye/glow accent, and the
// ground glow + bounce light so the whole scene re-tints together.
// To add a theme: add an entry here — the swatch UI is generated from this list.
export const THEMES = [
  { name: 'Steel',   accent: 0x22eeff, eye: 0x00ffff, ground: 0x3366ff,
    body: 0x7799bb, head: 0x88aacc, limb: 0x5577aa, joint: 0xaabbd0, panel: 0x334455 },
  { name: 'Crimson', accent: 0xff4455, eye: 0xff5566, ground: 0xff3355,
    body: 0xbb5566, head: 0xcc6677, limb: 0xaa4455, joint: 0xdd99aa, panel: 0x552233 },
  { name: 'Emerald', accent: 0x33ffaa, eye: 0x44ffbb, ground: 0x00ff88,
    body: 0x55aa88, head: 0x66bb99, limb: 0x449977, joint: 0x99ddbb, panel: 0x224433 },
  { name: 'Gold',    accent: 0xffcc22, eye: 0xffdd44, ground: 0xffaa22,
    body: 0xbb9955, head: 0xccaa66, limb: 0xaa8844, joint: 0xddccaa, panel: 0x554422 },
  { name: 'Violet',  accent: 0xcc66ff, eye: 0xdd88ff, ground: 0xaa44ff,
    body: 0x8866bb, head: 0x9977cc, limb: 0x7755aa, joint: 0xbbaadd, panel: 0x332255 },
  { name: 'Mono',    accent: 0xffffff, eye: 0xffffff, ground: 0xccddee,
    body: 0xaab0b8, head: 0xc0c6ce, limb: 0x889098, joint: 0xd8dde2, panel: 0x444a52 },
];

// Apply a theme. `ctx` carries the things a theme recolors:
//   { materials, groundRing, glowDisc, bounce }
export function applyTheme(th, ctx) {
  const { materials: M, groundRing, glowDisc, bounce } = ctx;

  M.body.color.setHex(th.body);
  M.head.color.setHex(th.head);
  M.limb.color.setHex(th.limb);
  M.joint.color.setHex(th.joint);
  M.panel.color.setHex(th.panel);
  M.eye.color.setHex(th.eye);      M.eye.emissive.setHex(th.eye);
  M.eyeHalo.color.setHex(th.eye);
  M.glow.color.setHex(th.accent);  M.glow.emissive.setHex(th.accent);

  groundRing.material.color.setHex(th.ground);
  glowDisc.material.color.setHex(th.ground);
  bounce.color.setHex(th.ground);
}
