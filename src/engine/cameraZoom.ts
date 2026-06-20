import { easeInOut } from './easing.js';

// A one-shot camera move: trigger() flies the camera from where it is now to a
// target, holds, then eases back to its resting `base`, handing control back to
// OrbitControls. Call update(dt) every frame.
//
//   const zoom = createCameraZoom(camera, controls, { base, lookAt });
//   zoom.trigger(someTargetVec3);          // on a button press
//   zoom.update(dt, applyLookAt);          // in the render loop
//
// `applyLookAt` (default true) keeps the camera pointed at `lookAt` during the
// move; pass false when the subject itself is spinning and you don't want to
// fight its rotation.
export function createCameraZoom(camera, controls, {
  base,
  lookAt,
  zoomIn = 0.45,
  hold = 0.9,
  zoomOut = 0.5,
}: any = {}) {
  const total = zoomIn + hold + zoomOut;
  const from = base.clone();
  const to = base.clone();
  let t = 1; // 1 === idle / finished

  function trigger(target) {
    from.copy(camera.position);
    to.copy(target);
    t = 0;
    controls.enabled = false;
  }

  function update(dt, applyLookAt = true) {
    if (t >= 1) {
      controls.update();
      return;
    }

    t = Math.min(1, t + dt / total);
    const inF = Math.min(1, t / (zoomIn / total));
    const outF = Math.max(0, (t - (zoomIn + hold) / total) / (zoomOut / total));
    const blend = outF > 0 ? 1 - easeInOut(outF) : easeInOut(inF);

    camera.position.lerpVectors(from, to, blend);
    if (applyLookAt) camera.lookAt(lookAt);

    if (t >= 1) {
      // Snap home and return the camera to the user
      controls.enabled = true;
      camera.position.copy(base);
      controls.update();
    }
  }

  return { trigger, update };
}
