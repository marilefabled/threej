import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Reusable bloom pipeline. Renders the scene through an EffectComposer with an
// UnrealBloomPass so emissive / bright surfaces glow, then an OutputPass for the
// tone-map + sRGB conversion.
//
// NOTE: when you render through this, leave renderer.outputColorSpace at its
// default (linear) — OutputPass does the sRGB conversion. Setting it to sRGB as
// well double-converts and washes everything out.
export function createBloom(renderer, scene, camera, { strength = 0.7, radius = 0.5, threshold = 0.15 } = {}) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(size.clone(), strength, radius, threshold);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  return {
    composer,
    bloomPass,
    render: () => composer.render(),
    setSize: (w, h) => { composer.setSize(w, h); bloomPass.setSize(w, h); },
  };
}
