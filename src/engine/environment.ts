import * as THREE from 'three';

// The "stage": a dark reflective floor, a two-layer grid (fine + coarse), a soft
// radial glow disc, and a crisp ring beneath the figure. Returns the pieces that
// get animated (opacity pulse) or recolored by themes.
export function addEnvironment(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x0b0b18, roughness: 0.85, metalness: 0.3 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Fine grid — 1-unit cells, very faint
  const gridFine = new THREE.GridHelper(80, 80, 0x0d1e3a, 0x0a182e);
  gridFine.position.y = 0.001;
  scene.add(gridFine);

  // Coarse grid — 5-unit cells, brighter electric-blue
  const gridCoarse = new THREE.GridHelper(80, 16, 0x1a4488, 0x122e66);
  gridCoarse.position.y = 0.002;
  scene.add(gridCoarse);

  // Soft radial haze under the figure
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x2244bb, transparent: true, opacity: 0.13, depthWrite: false })
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.003;
  scene.add(glowDisc);

  // Crisp inner ring
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.05, 64),
    new THREE.MeshBasicMaterial({ color: 0x3366ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.004;
  scene.add(groundRing);

  return { floor, gridFine, gridCoarse, glowDisc, groundRing };
}
