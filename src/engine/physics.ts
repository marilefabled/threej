import RAPIER from '@dimforge/rapier3d-compat';

// Rapier (WASM) physics wrapper. Rapier must init() once before use, so this is
// async: `const physics = await createPhysics()`. Link a THREE mesh to a rigid
// body with addDynamic(); step(dt) advances the world and copies each body's
// transform back onto its mesh.
//
//   const physics = await createPhysics();
//   physics.addGround(0);
//   physics.addDynamic(mesh, { type: 'box', hx: 0.2, hy: 0.2, hz: 0.2 });
//   loop.onFrame((t, dt) => physics.step(dt));   // engine/loop.js
export async function createPhysics({ gravity = { x: 0, y: -9.81, z: 0 } }: any = {}) {
  await RAPIER.init();
  const world = new RAPIER.World(gravity);
  const links: { body: any; mesh: any }[] = [];

  // A fixed floor plane (thin cuboid) — match your visible floor's y.
  function addGround(y = 0, half = 40) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, y - 0.1, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(half, 0.1, half), body);
    return body;
  }

  // Link a mesh to a dynamic body spawned at the mesh's current transform.
  function addDynamic(mesh: any, shape: any, { restitution = 0.35, friction = 0.7, density = 1 }: any = {}) {
    const p = mesh.position, q = mesh.quaternion;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );
    const desc = shape.type === 'ball'
      ? RAPIER.ColliderDesc.ball(shape.r)
      : RAPIER.ColliderDesc.cuboid(shape.hx, shape.hy, shape.hz);
    desc.setRestitution(restitution).setFriction(friction).setDensity(density);
    world.createCollider(desc, body);
    links.push({ body, mesh });
    return body;
  }

  function remove(body: any) {
    const i = links.findIndex((l) => l.body === body);
    if (i >= 0) links.splice(i, 1);
    world.removeRigidBody(body);
  }

  // Advance the simulation and sync meshes. dt is clamped so a stall doesn't
  // explode the integrator.
  function step(dt: number) {
    world.timestep = Math.min(dt || 1 / 60, 1 / 30);
    world.step();
    for (const l of links) {
      const t = l.body.translation();
      const r = l.body.rotation();
      l.mesh.position.set(t.x, t.y, t.z);
      l.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  return { world, step, addGround, addDynamic, remove, links, RAPIER };
}
