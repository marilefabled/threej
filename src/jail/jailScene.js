import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildLocation } from './locationBuilder.js';
import { buildGhostGroup, animateGhost } from './ghostMesh.js';

// Period (time-of-day) tint for the mood light + a fog-color nudge.
const PERIOD = {
  dawn:  { color: new THREE.Color(0xff8844), intensity: 1.2 },
  day:   { color: new THREE.Color(0x99aacc), intensity: 0.9 },
  dusk:  { color: new THREE.Color(0xff5533), intensity: 1.3 },
  night: { color: new THREE.Color(0x3344aa), intensity: 1.8 },
};

// Manages the jail "stage" inside an existing scene: the current location's
// geometry, the floating ghosts, period lighting, and GSAP transitions.
//   createJail(scene, { moodLight, getBloomPass })
export function createJail(scene, { moodLight, getBloomPass } = {}) {
  const locationGroup = new THREE.Group();
  scene.add(locationGroup);
  const ghosts = [];

  function clearLocation() {
    while (locationGroup.children.length) {
      const o = locationGroup.children[0];
      locationGroup.remove(o);
    }
  }

  function setLocation(id, { animate = true } = {}) {
    const data = buildLocation(id);
    // Damp the original (game-moody) fog so the robot stays clearly visible.
    scene.fog = new THREE.FogExp2(data.fogColor, Math.min(data.fogDensity * 0.32, 0.05));
    clearLocation();
    for (const o of data.objects) locationGroup.add(o);

    if (animate) {
      const bloom = getBloomPass?.();
      if (bloom) gsap.fromTo(bloom, { strength: 2.0 }, { strength: 0.7, duration: 0.6, ease: 'power2.out' });
      ghosts.forEach((g, i) => enterGhost(g, i * 0.1));
    }
  }

  // config: { glowColor, ghostForm, size } ; pos: {x,y,z}
  function addGhost(config, pos) {
    const g = buildGhostGroup(config);
    g.position.set(pos.x, pos.y ?? 0, pos.z);
    g.userData.restY = pos.y ?? 0;
    g.userData.baseY = pos.y ?? 0;
    scene.add(g);
    ghosts.push(g);
    return g;
  }

  // Rise-up + fade-in entrance. Tweens userData.baseY (animateGhost adds its
  // hover on top) and each transparent material's opacity.
  function enterGhost(group, delay = 0) {
    const restY = group.userData.restY ?? 0;
    group.userData.baseY = restY - 1.8;
    group.traverse((c) => {
      if (c.isMesh && c.material && c.material.transparent) c.material.opacity = 0;
    });
    gsap.to(group.userData, { baseY: restY, duration: 0.75, delay, ease: 'back.out(1.2)' });
    group.traverse((c) => {
      if (c.isMesh && c.material && c.material.transparent) {
        gsap.to(c.material, {
          opacity: c.material.userData.baseOpacity ?? 0.88,
          duration: 0.55, delay, ease: 'power2.out',
        });
      }
    });
  }

  function setPeriod(p) {
    const cfg = PERIOD[p] ?? PERIOD.night;
    if (moodLight) {
      gsap.to(moodLight, { intensity: cfg.intensity, duration: 0.8 });
      moodLight.color.lerp(cfg.color, 0.6);
    }
  }

  function update(t) {
    for (const g of ghosts) animateGhost(g, t);
  }

  return { setLocation, addGhost, enterGhost, setPeriod, update, ghosts, locationGroup };
}
