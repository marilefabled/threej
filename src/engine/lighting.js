import * as THREE from 'three';

// A cinematic lighting rig: soft ambient, a shadow-casting key "sun", a front
// fill so faces aren't dark, cool/warm rim lights, and an upward ground bounce.
// Returns the lights you'll want to animate or recolor later.
export function addLighting(scene) {
  // Ambient — enough to read the model even in shadow
  scene.add(new THREE.AmbientLight(0x5577aa, 7.0));

  // Key — the "sun", casts shadows from the top-right-front
  const sun = new THREE.DirectionalLight(0xffffff, 3.5);
  sun.position.set(4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -7;
  sun.shadow.camera.right = sun.shadow.camera.top = 7;
  scene.add(sun);

  // Front fill — soft light from the camera's side so the face is lit
  const fill = new THREE.DirectionalLight(0xaaccff, 3.5);
  fill.position.set(0, 3, 8);
  scene.add(fill);

  // Left rim — cool blue edge light
  const rimL = new THREE.PointLight(0x0077ff, 5, 14);
  rimL.position.set(-4.5, 3.5, 1.5);
  scene.add(rimL);

  // Right rim — warm orange back-rim
  const rimR = new THREE.PointLight(0xff4400, 3, 12);
  rimR.position.set(4.5, 1.5, -2.5);
  scene.add(rimR);

  // Ground bounce — upward glow from just below the figure (recolored by themes)
  const bounce = new THREE.PointLight(0x0044cc, 2.5, 5);
  bounce.position.set(0, 0.05, 0);
  scene.add(bounce);

  return { sun, fill, rimL, rimR, bounce };
}
