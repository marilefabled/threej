import { World } from 'miniplex';

// Thin ECS layer over miniplex: a World plus a frame-system registry. Add
// entities as plain objects of components; register systems that run each frame
// (in registration order) from the loop.
//
//   const ecs = createECS();
//   ecs.world.add({ mesh, body, ttl: 9 });
//   ecs.system((world, dt) => { for (const e of world.with('mesh','body')) {...} });
//   loop.onFrame((t, dt) => ecs.update(dt, t));   // engine/loop.js
export function createECS() {
  const world: any = new World();
  const systems: Array<(world: any, dt: number, t: number) => void> = [];

  function system(fn: (world: any, dt: number, t: number) => void) {
    systems.push(fn);
    return fn;
  }
  function update(dt: number, t: number) {
    for (let i = 0; i < systems.length; i++) systems[i](world, dt, t);
  }

  return { world, system, update };
}
