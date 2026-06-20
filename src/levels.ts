// Demo level data for the data-driven loader (engine/level.ts). Plain objects —
// `type` keys map to factories (built-in primitives + the app's `crate`, which is
// a collidable box). `objects` use [x,y,z]; `triggers` use [x,z] (flat zones).
const ring = (n: number, r: number, h: number, color: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { type: 'crate', position: [Math.cos(a) * r, h / 2, Math.sin(a) * r], size: [0.5, h, 0.5], color };
  });

export const LEVELS: Record<string, any> = {
  none: { name: 'None', objects: [], triggers: [] },

  course: {
    name: 'Obstacle Course',
    spawn: { x: 0, z: 3.4, yaw: Math.PI },
    objects: [
      { type: 'crate', position: [1.2, 0.4, 0.4], size: [0.8, 0.8, 0.8], color: 0x8a6f4a },
      { type: 'crate', position: [-1.1, 0.4, -0.2], size: [0.8, 0.8, 0.8], color: 0x8a6f4a },
      { type: 'crate', position: [0.2, 0.4, -1.4], size: [0.8, 0.8, 0.8], color: 0x9a7d54 },
      { type: 'crate', position: [0.2, 1.15, -1.4], size: [0.7, 0.7, 0.7], color: 0x9a7d54 },
      { type: 'light', position: [0, 2.6, -1], color: 0xffd2a0, intensity: 12, distance: 9 },
      { type: 'marker', position: [-2.3, 0.02, 1.3], radius: 0.9, color: 0x9fffd0 },
    ],
    triggers: [{ id: 'goal', position: [-2.3, 1.3], radius: 0.9, dialogue: 'yard_npc' }],
  },

  pillars: {
    name: 'Pillars',
    spawn: { x: 0, z: 0, yaw: 0 },
    objects: [
      ...ring(6, 2.6, 2.4, 0x5d6b86),
      { type: 'light', position: [0, 2.2, 0], color: 0xaad4ff, intensity: 14, distance: 7 },
      { type: 'sphere', position: [0, 0.5, 0], radius: 0.35, color: 0x88bbff },
    ],
    triggers: [],
  },
};
