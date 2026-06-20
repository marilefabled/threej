// Camera shake using the trauma model (Jan Bitters, "Game Feel").
//
// Trauma is a 0..1 accumulator: addTrauma(amount) adds to it (capped at 1).
// Each frame, trauma decays at traumaDecay units/sec. The actual shake magnitude
// is trauma² — this gives a punchy feel: strong onset, quick trailing off, and
// multiple hits accumulate naturally without overflowing.
//
// The shake is applied in camera-local space (right + up offset, roll) AFTER all
// other camera systems (follow cam, orbit, zoom) have positioned the camera for
// that frame. Call shake.update(dt) LAST in your camera frame callback.
//
//   const shake = createShake(camera)
//   loop.onFrame((_, dt) => {
//     followCam.update(dt)          // position camera first
//     shake.update(dt)              // offset on top, after
//   })
//   shake.addTrauma(0.3)           // light hit
//   shake.addTrauma(0.8)           // heavy hit; accumulates with any existing trauma
//
// Trauma scale guide:
//   0.15 – 0.25  subtle: footstep land, small pickup
//   0.3  – 0.45  medium: grenade nearby, hard landing
//   0.5  – 0.7   strong: explosion, heavy impact
//   0.75 – 1.0   max: direct hit, dramatic event

import * as THREE from 'three'

export function createShake(camera: THREE.Camera, {
  maxOffset   = 0.18,   // max positional displacement in world units
  maxRoll     = 0.05,   // max camera roll in radians (~2.9°)
  traumaDecay = 1.5,    // trauma units lost per second
}: {
  maxOffset?:   number
  maxRoll?:     number
  traumaDecay?: number
} = {}) {

  let _trauma = 0
  let _enabled = true

  // Pre-allocated to avoid per-frame allocations on the hot path.
  const _right = new THREE.Vector3()
  const _up    = new THREE.Vector3()

  function addTrauma(amount: number) {
    _trauma = Math.min(1, _trauma + amount)
  }

  function update(dt: number) {
    if (!_enabled || _trauma <= 0) return

    _trauma = Math.max(0, _trauma - traumaDecay * dt)
    const mag = _trauma * _trauma   // squared: more punch, faster apparent decay

    // Extract camera axes from the current quaternion.
    // Using applyQuaternion (not matrixWorld) so this is correct before render.
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion)

    // Random jitter in camera-local right/up and a roll offset.
    camera.position.addScaledVector(_right, (Math.random() * 2 - 1) * mag * maxOffset)
    camera.position.addScaledVector(_up,    (Math.random() * 2 - 1) * mag * maxOffset)
    // camera.rotation.z: Three.js Euler (order XYZ). lookAt() resets roll to ~0 each
    // frame, so adding delta roll here is naturally cleaned up next frame — no drift.
    ;(camera as any).rotation.z += (Math.random() * 2 - 1) * mag * maxRoll
  }

  // Hard-zero trauma (e.g. on scene transition so you don't carry shake across).
  function reset() { _trauma = 0 }

  return {
    addTrauma,
    update,
    reset,
    get trauma()           { return _trauma },
    set trauma(v: number)  { _trauma = Math.max(0, Math.min(1, v)) },
    get enabled()          { return _enabled },
    set enabled(v: boolean){ _enabled = v },
  }
}
