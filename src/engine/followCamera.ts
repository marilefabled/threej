import * as THREE from 'three';

// A third-person follow camera. It trails a target each frame with frame-rate-
// independent smoothing and aims a little above the target's origin. `update(dt)`
// in the render loop; `snap()` to teleport (e.g. on enable, to avoid a long swoop).
// While it owns the camera, disable OrbitControls and skip other camera drivers.
//
//   const follow = createFollowCamera(camera, { target: hero, offset: new THREE.Vector3(0, 2.4, -4.8) });
//   follow.enabled = true; controls.enabled = false; follow.snap();
//   loop.onFrame((t, dt) => { if (follow.enabled) follow.update(dt); });
//
// rotateWithTarget=true swings the camera behind the target as it turns (classic
// third-person); false trails from a fixed world direction (calmer, no spin).
// Pass `obstacles` (meshes) to keep the camera from clipping through walls — it
// raycasts from the target out to the camera and pulls in on a hit.
const UP = new THREE.Vector3(0, 1, 0);

export function createFollowCamera(camera: any, {
  target = null,
  offset = new THREE.Vector3(0, 2.4, -4.8),
  lookHeight = 1.1,
  stiffness = 5,
  rotateWithTarget = true,
  obstacles = null as any,
  minDistance = 1.2,
}: any = {}) {
  let enabled = false;
  const desired = new THREE.Vector3();
  const tp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const ray = new THREE.Raycaster();

  function place() {
    target.getWorldPosition(tp);
    if (rotateWithTarget) desired.copy(offset).applyAxisAngle(UP, target.rotation.y).add(tp);
    else desired.copy(tp).add(offset);
    if (obstacles && obstacles.length) {                 // pull the camera in if a wall is in the way
      from.copy(tp); from.y += lookHeight;
      dir.copy(desired).sub(from);
      const dist = dir.length(); dir.divideScalar(dist || 1);
      ray.set(from, dir); ray.far = dist;
      const hit = ray.intersectObjects(obstacles, true)[0];
      if (hit) desired.copy(from).addScaledVector(dir, Math.max(minDistance, hit.distance - 0.25));
    }
  }

  function aim() { target.getWorldPosition(look); look.y += lookHeight; camera.lookAt(look); }

  function update(dt: number) {
    if (!target) return;
    place();
    camera.position.lerp(desired, 1 - Math.exp(-stiffness * dt));   // exponential damping (dt-independent)
    aim();
  }
  function snap() { if (!target) return; place(); camera.position.copy(desired); aim(); }

  return {
    update, snap,
    get enabled() { return enabled; }, set enabled(v: boolean) { enabled = v; },
    get target() { return target; }, setTarget(t: any) { target = t; },
    get stiffness() { return stiffness; }, set stiffness(v: number) { stiffness = v; },
    offset,
  };
}
