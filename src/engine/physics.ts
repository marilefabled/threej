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

  // Spawn a dynamic body at the mesh's current transform. By default the mesh is
  // linked so step() syncs it; pass link:false to sync it yourself (e.g. from ECS).
  function addDynamic(mesh: any, shape: any, { restitution = 0.35, friction = 0.7, density = 1, link = true }: any = {}) {
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
    if (link) links.push({ body, mesh });
    return body;
  }

  function remove(body: any) {
    const i = links.findIndex((l) => l.body === body);
    if (i >= 0) links.splice(i, 1);
    world.removeRigidBody(body);
  }

  // A static box collider (walls, platforms). No mesh — invisible bounds.
  function addStaticBox(hx: number, hy: number, hz: number, x = 0, y = 0, z = 0) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
    return body;
  }

  // A capsule character: a kinematic body + Rapier's KinematicCharacterController
  // (move-and-slide) with gravity + jump. move(dx, dz, dt) applies a horizontal
  // step plus integrated vertical velocity, corrected by collisions (slides along
  // walls, pushes dynamic bodies), and follows `mesh`. `feetOffset` is the
  // mesh.position.y that puts the model's feet on the floor (y=0).
  function addCharacter(mesh: any, { radius = 0.4, half = 0.5, feetOffset = 0, gravity = 20, jumpSpeed = 7, offset = 0.02 }: any = {}) {
    const controller = world.createCharacterController(offset);
    controller.enableAutostep(0.3, 0.2, true);
    controller.enableSnapToGround(0.3);
    controller.setApplyImpulsesToDynamicBodies(true);   // shove crates out of the way
    const centerY0 = half + radius;                      // capsule bottom rests on floor (y=0)
    const p = mesh.position;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, centerY0, p.z));
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(half, radius), body);
    let vy = 0, grounded = true;

    function move(dx: number, dz: number, dt = 1 / 60) {
      vy -= gravity * dt;
      if (vy > 0) controller.disableSnapToGround(); else controller.enableSnapToGround(0.3);  // don't snap mid-jump
      controller.computeColliderMovement(collider, { x: dx, y: vy * dt, z: dz });
      grounded = controller.computedGrounded();
      if (grounded && vy < 0) vy = 0;
      const c = controller.computedMovement();
      const t = body.translation();
      const nx = t.x + c.x, ny = t.y + c.y, nz = t.z + c.z;
      body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
      mesh.position.set(nx, ny - centerY0 + feetOffset, nz);
      return { grounded, vy };
    }
    function jump(v = jumpSpeed) { if (grounded) { vy = v; grounded = false; } }
    function teleport(x: number, z: number) { vy = 0; body.setNextKinematicTranslation({ x, y: centerY0, z }); mesh.position.set(x, feetOffset, z); }
    function dispose() { world.removeRigidBody(body); world.removeCharacterController(controller); }

    return { body, collider, controller, move, jump, teleport, dispose, get grounded() { return grounded; } };
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

  return { world, step, addGround, addStaticBox, addDynamic, addCharacter, remove, links, RAPIER };
}
