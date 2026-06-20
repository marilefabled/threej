// A volume trigger. Give it a center + radius (XZ distance — flat zones on the
// floor) and onEnter/onExit; feed it a point each frame with update(point) and it
// fires the edges. `once` latches after the first enter. Reusable for NPC talk
// zones, doors, checkpoints, hazard areas, etc.
//
//   const zone = createTrigger({ position: new THREE.Vector3(0,0,2.5), radius: 1.4,
//     onEnter: () => dialogue.run('npc'), onExit: () => hidePrompt() });
//   loop.onFrame(() => zone.update(player.position));
export function createTrigger({ position, radius = 1.5, once = false, onEnter, onExit }: any) {
  let inside = false;
  let fired = false;
  const r2 = radius * radius;

  return {
    position, radius,
    get inside() { return inside; },
    reset() { inside = false; fired = false; },
    update(point: { x: number; z: number }) {
      const dx = point.x - position.x, dz = point.z - position.z;
      const now = dx * dx + dz * dz <= r2;
      if (now && !inside) {
        inside = true;
        if (!(once && fired)) { fired = true; onEnter?.(); }
      } else if (!now && inside) {
        inside = false;
        onExit?.();
      }
    },
  };
}
