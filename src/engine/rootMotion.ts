import * as THREE from 'three';

// Extracts planar (x,z) root motion from a playing clip so the *animation* drives
// the character's movement. Each frame it reads the root bone's local horizontal
// displacement, converts it through the bone's parent world transform (so it's
// unit/scale/orientation correct), adds it to the target's world position, then
// pins the bone's horizontal back to base so the mesh doesn't double-move.
//
//   const rm = createRootMotion(model, { getTime: () => animator.currentAction?.time ?? 0 });
//   loop.onFrame((t, dt) => { animator.update(dt); rm.apply(); });
//   rm.reset();   // when (re)starting a clip
//
// Loop wrap is detected via getTime() decreasing (unit-independent), so the
// jump-back at the end of a looping clip never registers as a giant step.
export function createRootMotion(target: any, { bone, getTime, applyToTarget = true }: any = {}) {
  let root: any = null;
  target.traverse((o: any) => { if (!root && o.isBone && (!bone || o.name === bone)) root = o; });
  if (!root) target.traverse((o: any) => { if (!root && o.isBone) root = o; }); // fallback: first bone

  const last = new THREE.Vector3();
  const base = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const delta = new THREE.Vector3();   // this frame's world (x, 0, z) displacement
  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  let primed = false;
  let lastTime = 0;

  function reset() { primed = false; lastTime = 0; delta.set(0, 0, 0); }

  // Returns this frame's world (x, 0, z) displacement. With applyToTarget (default)
  // it also moves the target; pass false to let a character controller own the move.
  function apply() {
    delta.set(0, 0, 0);
    if (!root || !root.parent) return delta;
    const t = getTime ? getTime() : 0;
    const wrapped = t < lastTime - 1e-4;
    lastTime = t;

    // (Re)prime on first frame or a loop wrap — record the baseline, no motion.
    if (!primed || wrapped) {
      last.copy(root.position);
      if (!primed) base.copy(root.position);
      primed = true;
      return delta;
    }

    const dx = root.position.x - last.x;
    const dz = root.position.z - last.z;
    last.copy(root.position);

    // local horizontal delta → world, via the bone parent's world rotation+scale
    root.parent.updateWorldMatrix(true, false);
    root.parent.matrixWorld.decompose(_p, _q, _s);
    tmp.set(dx, 0, dz).multiply(_s).applyQuaternion(_q);
    delta.set(tmp.x, 0, tmp.z);
    if (applyToTarget) { target.position.x += delta.x; target.position.z += delta.z; }

    // pin the root bone's horizontal so the skeleton stays under the target
    root.position.x = base.x;
    root.position.z = base.z;
    return delta;
  }

  return { apply, reset, delta, get bone() { return root; } };
}
