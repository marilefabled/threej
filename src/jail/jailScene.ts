import * as THREE from 'three';
import { gsap } from 'gsap';
import { buildLocation } from './locationBuilder.js';
import { buildGhostGroup, animateGhost } from './ghostMesh.js';

// Period (time of day): mood-light intensity + overall exposure.
const PERIOD = {
  dawn:  { intensity: 1.9, exposure: 1.55 },
  day:   { intensity: 1.4, exposure: 1.7 },
  dusk:  { intensity: 2.2, exposure: 1.4 },
  night: { intensity: 2.6, exposure: 1.3 },
};

// Mood: the mood-light color tint.
const MOOD = {
  neutral:   0x334455,
  danger:    0x661111,
  social:    0x225533,
  discovery: 0x334466,
  calm:      0x223344,
};

function hexToRGB(hex) {
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
}

// Manages the jail "stage" inside an existing scene: current location geometry,
// the floating ghosts, period/mood lighting, and GSAP transitions.
//   createJail(scene, { moodLight, renderer, getBloomPass })
export function createJail(scene, { moodLight, renderer, getBloomPass }: any = {}) {
  const locationGroup = new THREE.Group();
  scene.add(locationGroup);

  const ghosts = [];
  const ghostSpecs = []; // { config, pos } — kept so ghosts can be rebuilt

  function clearLocation() {
    while (locationGroup.children.length) locationGroup.remove(locationGroup.children[0]);
  }

  function setLocation(id, { animate = true } = {}) {
    const data = buildLocation(id);
    // Damp the original (game-moody) fog so the robot stays clearly visible.
    scene.fog = new THREE.FogExp2(data.fogColor, Math.min(data.fogDensity * 0.32, 0.05));
    clearLocation();
    for (const o of data.objects) locationGroup.add(o);

    if (animate) {
      const bloom = getBloomPass?.();
      if (bloom) gsap.fromTo(bloom, { strength: 2.0 }, { strength: bloom.strength, duration: 0.6, ease: 'power2.out' });
      ghosts.forEach((g, i) => enterGhost(g, i * 0.1));
    }
  }

  // ── Ghosts ──
  function spawnGhost(spec) {
    const g = buildGhostGroup(spec.config);
    g.position.set(spec.pos.x, spec.pos.y ?? 0, spec.pos.z);
    g.userData.restY = spec.pos.y ?? 0;
    g.userData.baseY = spec.pos.y ?? 0;
    scene.add(g);
    ghosts.push(g);
    return g;
  }

  function addGhost(config, pos) {
    const spec = { config, pos };
    ghostSpecs.push(spec);
    return spawnGhost(spec);
  }

  function clearGhosts() {
    for (const g of ghosts) scene.remove(g);
    ghosts.length = 0;
  }

  function rebuildGhosts({ animate = true } = {}) {
    clearGhosts();
    ghostSpecs.forEach((spec, i) => {
      const g = spawnGhost(spec);
      if (animate) enterGhost(g, i * 0.08);
    });
  }

  // Change a ghost's form (e.g. from the picker) and respawn it with an entrance.
  function setGhostForm(index, form) {
    const spec = ghostSpecs[index];
    if (!spec) return;
    spec.config = { ...spec.config, ghostForm: form };
    rebuildGhosts();
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

  // ── Period / mood ──
  function setPeriod(p) {
    const cfg = PERIOD[p] ?? PERIOD.night;
    if (moodLight) gsap.to(moodLight, { intensity: cfg.intensity, duration: 0.8 });
    if (renderer) gsap.to(renderer, { toneMappingExposure: cfg.exposure, duration: 0.8 });
  }

  function setMood(m) {
    const hex = MOOD[m] ?? MOOD.neutral;
    if (moodLight) gsap.to(moodLight.color, { ...hexToRGB(hex), duration: 0.8 });
  }

  function update(t) {
    for (const g of ghosts) animateGhost(g, t);
  }

  return {
    setLocation, addGhost, setGhostForm, rebuildGhosts,
    setPeriod, setMood, update, ghosts, locationGroup,
  };
}
