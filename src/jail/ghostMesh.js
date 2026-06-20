import * as THREE from 'three';

// Procedural ghost mesh — ported from GhostJail3D (GhostMesh3D.ts), plain JS.
// buildGhostGroup(config) -> THREE.Group ; animateGhost(group, t) floats it.

const SIZE_SCALE = { small: 0.72, medium: 1.0, large: 1.3, massive: 1.7 };

function ghostMat(color, opacity = 0.88, emissive = 0.4) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: true,
    opacity,
    roughness: 0.55,
    metalness: 0.0,
  });
  mat.userData.baseOpacity = opacity;
  return mat;
}

// Body proportions per ghost "form"
const FORMS = {
  classic:   { bodyRadius: 0.44, bodyYScale: 1.45, bodyY: 0.28, midTopR: 0.36, midBotR: 0.38, midH: 0.3,  midY: -0.24, scallops: 3, scallopR: 0.19, scallopY: -0.52, scallopSpread: 0.22, eyeXSpread: 0.14, eyeY: 0.36, eyeZ: 0.40, eyeSize: 0.065 },
  wispy:     { bodyRadius: 0.38, bodyYScale: 1.9,  bodyY: 0.4,  midTopR: 0.28, midBotR: 0.26, midH: 0.5,  midY: -0.18, scallops: 5, scallopR: 0.12, scallopY: -0.58, scallopSpread: 0.18, eyeXSpread: 0.12, eyeY: 0.48, eyeZ: 0.34, eyeSize: 0.055 },
  skeletal:  { bodyRadius: 0.34, bodyYScale: 2.0,  bodyY: 0.45, midTopR: 0.22, midBotR: 0.18, midH: 0.55, midY: -0.18, scallops: 4, scallopR: 0.10, scallopY: -0.62, scallopSpread: 0.14, eyeXSpread: 0.11, eyeY: 0.56, eyeZ: 0.30, eyeSize: 0.048 },
  orb:       { bodyRadius: 0.52, bodyYScale: 1.0,  bodyY: 0.1,  midTopR: 0.0,  midBotR: 0.0,  midH: 0.0,  midY: 0,     scallops: 0, scallopR: 0,    scallopY: 0,     scallopSpread: 0,    eyeXSpread: 0.16, eyeY: 0.14, eyeZ: 0.50, eyeSize: 0.07 },
  shadow:    { bodyRadius: 0.52, bodyYScale: 1.3,  bodyY: 0.22, midTopR: 0.46, midBotR: 0.5,  midH: 0.28, midY: -0.22, scallops: 4, scallopR: 0.20, scallopY: -0.48, scallopSpread: 0.3,  eyeXSpread: 0.17, eyeY: 0.28, eyeZ: 0.48, eyeSize: 0.07 },
  blob:      { bodyRadius: 0.50, bodyYScale: 1.15, bodyY: 0.18, midTopR: 0.44, midBotR: 0.46, midH: 0.25, midY: -0.2,  scallops: 5, scallopR: 0.17, scallopY: -0.45, scallopSpread: 0.28, eyeXSpread: 0.16, eyeY: 0.22, eyeZ: 0.46, eyeSize: 0.07 },
  flame:     { bodyRadius: 0.36, bodyYScale: 2.2,  bodyY: 0.5,  midTopR: 0.24, midBotR: 0.10, midH: 0.6,  midY: -0.15, scallops: 3, scallopR: 0.09, scallopY: -0.6,  scallopSpread: 0.12, eyeXSpread: 0.11, eyeY: 0.6,  eyeZ: 0.32, eyeSize: 0.050 },
  geometric: { bodyRadius: 0.42, bodyYScale: 1.4,  bodyY: 0.28, midTopR: 0.38, midBotR: 0.38, midH: 0.3,  midY: -0.22, scallops: 6, scallopR: 0.13, scallopY: -0.50, scallopSpread: 0.25, eyeXSpread: 0.14, eyeY: 0.34, eyeZ: 0.38, eyeSize: 0.06 },
};

export const GHOST_FORMS = Object.keys(FORMS);

// config: { glowColor, ghostForm, size }
export function buildGhostGroup(config = {}) {
  const color = new THREE.Color(config.glowColor || '#33f589');
  const scale = SIZE_SCALE[config.size ?? 'medium'];
  const group = new THREE.Group();

  const cfg = FORMS[config.ghostForm] ?? FORMS.classic;
  const mat = ghostMat(color);

  // Main body (rounded ovoid)
  const body = new THREE.Mesh(new THREE.SphereGeometry(cfg.bodyRadius, 20, 14), mat);
  body.scale.set(1, cfg.bodyYScale, 1);
  body.position.y = cfg.bodyY;
  group.add(body);

  // Mid connector
  if (cfg.midH > 0 && (cfg.midTopR > 0 || cfg.midBotR > 0)) {
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(cfg.midTopR, cfg.midBotR, cfg.midH, 16), mat);
    mid.position.y = cfg.midY;
    group.add(mid);
  }

  // Scallop bumps at the bottom
  for (let i = 0; i < cfg.scallops; i++) {
    const angle = (i / cfg.scallops) * Math.PI * 2;
    const scallop = new THREE.Mesh(new THREE.SphereGeometry(cfg.scallopR, 12, 8), mat);
    scallop.position.set(
      Math.sin(angle) * cfg.scallopSpread,
      cfg.scallopY,
      Math.cos(angle) * cfg.scallopSpread,
    );
    group.add(scallop);
  }

  // Eyes (glowing white, fade-able)
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.95,
  });
  eyeMat.userData.baseOpacity = 0.95;
  const eyeGeo = new THREE.SphereGeometry(cfg.eyeSize, 10, 8);

  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-cfg.eyeXSpread, cfg.eyeY, cfg.eyeZ);
  group.add(eyeL);

  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(cfg.eyeXSpread, cfg.eyeY, cfg.eyeZ);
  group.add(eyeR);

  // Glow point light
  const glow = new THREE.PointLight(color, 1.0, 3.2);
  glow.position.y = cfg.bodyY;
  group.add(glow);

  group.scale.setScalar(scale);
  group.userData.floatOffset = Math.random() * Math.PI * 2;
  group.userData.glowLight = glow;
  group.userData.eyeL = eyeL;
  group.userData.eyeR = eyeR;
  group.userData.baseY = 0;
  group.userData.restY = 0;

  return group;
}

export function animateGhost(group, t) {
  const offset = group.userData.floatOffset ?? 0;

  // Float relative to baseY — GSAP tweens baseY for entrances; the sinusoidal
  // hover is added on top so the two never fight over position.y.
  const baseY = group.userData.baseY ?? 0;
  group.position.y = baseY + Math.sin(t * 1.3 + offset) * 0.055;

  group.rotation.z = Math.sin(t * 0.7 + offset) * 0.06;          // gentle sway
  group.rotation.y = Math.sin(t * 0.4 + offset * 0.5) * 0.18;     // slow drift

  const glow = group.userData.glowLight;
  if (glow) glow.intensity = 0.85 + Math.sin(t * 2.0 + offset) * 0.25;

  const eyeL = group.userData.eyeL;
  const eyeR = group.userData.eyeR;
  if (eyeL && eyeR) {
    const blink = t % 4 > 3.85 ? 0.0 : 1.0; // blink every ~4s
    const intensity = blink * (1.5 + Math.sin(t * 3.0 + offset) * 0.4);
    eyeL.material.emissiveIntensity = intensity;
    eyeR.material.emissiveIntensity = intensity;
  }
}
