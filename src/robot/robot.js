import * as THREE from 'three';

// Arms hang DOWN by default. Positive Z rotation swings an arm toward the body
// centre, negative Z swings it away. So raising arms OUT to the sides at
// shoulder level = left arm -ARM_SIDE, right arm +ARM_SIDE.
export const ARM_SIDE = Math.PI * 0.5; // 90° — arms straight out, true shoulder level

// Builds the blocky robot from primitives and adds it to the scene. Returns:
//   materials  — the shared material set (themes recolor these)
//   eyeHalos   — the transparent eye-glow sprites (recolored by themes)
//   rig        — the handles the animations move, plus rig.reset() which
//                restores the neutral pose each frame before an animation runs.
export function buildRobot(scene) {
  // ── Materials (gunmetal grey + bright accents; recolored by themes.js) ──
  const M = {
    body:  new THREE.MeshStandardMaterial({ color: 0x7799bb, roughness: 0.25, metalness: 0.7,  emissive: 0x223355, emissiveIntensity: 0.6 }),
    head:  new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.2,  metalness: 0.72, emissive: 0x2a4466, emissiveIntensity: 0.7 }),
    limb:  new THREE.MeshStandardMaterial({ color: 0x5577aa, roughness: 0.3,  metalness: 0.75, emissive: 0x162244, emissiveIntensity: 0.5 }),
    joint: new THREE.MeshStandardMaterial({ color: 0xaabbd0, roughness: 0.45, metalness: 0.55, emissive: 0x334455, emissiveIntensity: 0.3 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.6,  metalness: 0.5,  emissive: 0x111e2e, emissiveIntensity: 0.4 }),
    eye:   new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 4.0, roughness: 0, metalness: 0 }),
    glow:  new THREE.MeshStandardMaterial({ color: 0x22eeff, emissive: 0x22eeff, emissiveIntensity: 2.5, roughness: 0 }),
  };

  const fig = new THREE.Group();
  scene.add(fig);

  const mesh = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // ── Torso ──
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.45;
  fig.add(torsoGroup);
  torsoGroup.add(mesh(new THREE.BoxGeometry(0.76, 0.92, 0.44), M.body));

  const chestPanel = mesh(new THREE.BoxGeometry(0.38, 0.46, 0.44), M.panel);
  chestPanel.position.z = 0.001;
  torsoGroup.add(chestPanel);

  const spine = mesh(new THREE.BoxGeometry(0.06, 0.5, 0.445), M.panel);
  torsoGroup.add(spine);

  const chestDot = mesh(new THREE.SphereGeometry(0.075, 16, 16), M.glow);
  chestDot.position.z = 0.225;
  torsoGroup.add(chestDot);

  [-1, 1].forEach(s => {
    const pad = mesh(new THREE.BoxGeometry(0.14, 0.16, 0.36), M.panel);
    pad.position.set(s * 0.39, 0.32, 0);
    torsoGroup.add(pad);
  });

  // ── Hips ──
  const hipsGroup = new THREE.Group();
  hipsGroup.position.y = 0.93;
  fig.add(hipsGroup);
  hipsGroup.add(mesh(new THREE.BoxGeometry(0.64, 0.24, 0.4), M.body));
  [-1, 1].forEach(s => {
    const plate = mesh(new THREE.BoxGeometry(0.1, 0.2, 0.38), M.panel);
    plate.position.x = s * 0.28;
    hipsGroup.add(plate);
  });

  // ── Neck ──
  const neck = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.2, 10), M.joint);
  neck.position.y = 1.9;
  fig.add(neck);

  // ── Head ──
  const headGroup = new THREE.Group();
  headGroup.position.y = 2.1;
  fig.add(headGroup);

  const headMesh = mesh(new THREE.BoxGeometry(0.6, 0.56, 0.5), M.head);
  headMesh.position.y = 0.28;
  headGroup.add(headMesh);

  const visor = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), M.panel);
  visor.position.set(0, 0.32, 0.001);
  headGroup.add(visor);

  const eyeHalos = [];
  [-0.13, 0.13].forEach(x => {
    const e = mesh(new THREE.SphereGeometry(0.068, 12, 12), M.eye);
    e.position.set(x, 0.33, 0.26);
    headGroup.add(e);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.12 })
    );
    halo.position.copy(e.position);
    headGroup.add(halo);
    eyeHalos.push(halo);
  });

  for (let i = 0; i < 4; i++) {
    const slit = mesh(new THREE.BoxGeometry(0.28, 0.028, 0.5), M.panel);
    slit.position.set(0, 0.08 + i * 0.048, 0);
    headGroup.add(slit);
  }

  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.3), M.panel);
    ear.position.set(s * 0.3, 0.28, 0);
    headGroup.add(ear);
  });

  const antenna = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8), M.joint);
  antenna.position.y = 0.71;
  headGroup.add(antenna);
  const antBall = mesh(new THREE.SphereGeometry(0.058, 12, 12), M.glow);
  antBall.position.y = 0.86;
  headGroup.add(antBall);

  // ── Arms (root pivot at the shoulder, forearm pivots at the elbow) ──
  function makeArm(sign) {
    const root = new THREE.Group();
    root.position.set(sign * 0.52, 1.62, 0); // shoulder near top of torso
    fig.add(root);

    root.add(mesh(new THREE.SphereGeometry(0.11, 10, 10), M.joint)); // shoulder

    const upper = mesh(new THREE.CylinderGeometry(0.088, 0.082, 0.42, 10), M.limb);
    upper.position.y = -0.23;
    root.add(upper);

    const elbow = mesh(new THREE.SphereGeometry(0.092, 10, 10), M.joint);
    elbow.position.y = -0.45;
    root.add(elbow);

    const foreGroup = new THREE.Group();
    foreGroup.position.y = -0.45;
    root.add(foreGroup);

    const fore = mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.36, 10), M.limb);
    fore.position.y = -0.19;
    foreGroup.add(fore);

    const wrist = mesh(new THREE.SphereGeometry(0.065, 8, 8), M.joint);
    wrist.position.y = -0.39;
    foreGroup.add(wrist);

    const hand = mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), M.body);
    hand.position.y = -0.5;
    foreGroup.add(hand);

    return { root, foreGroup };
  }

  const LA = makeArm(-1);
  const RA = makeArm(1);

  // ── Legs (root pivot at the hip, lower leg pivots at the knee) ──
  function makeLeg(sign) {
    const root = new THREE.Group();
    root.position.set(sign * 0.22, 0.93, 0);
    fig.add(root);

    const upper = mesh(new THREE.CylinderGeometry(0.115, 0.105, 0.46, 10), M.limb);
    upper.position.y = -0.24;
    root.add(upper);

    const knee = mesh(new THREE.SphereGeometry(0.11, 10, 10), M.joint);
    knee.position.y = -0.48;
    root.add(knee);

    const lowerGroup = new THREE.Group();
    lowerGroup.position.y = -0.48;
    root.add(lowerGroup);

    const lower = mesh(new THREE.CylinderGeometry(0.08, 0.072, 0.4, 10), M.limb);
    lower.position.y = -0.21;
    lowerGroup.add(lower);

    const ankle = mesh(new THREE.SphereGeometry(0.075, 8, 8), M.joint);
    ankle.position.y = -0.43;
    lowerGroup.add(ankle);

    const foot = mesh(new THREE.BoxGeometry(0.18, 0.1, 0.3), M.body);
    foot.position.set(0, -0.5, 0.07);
    lowerGroup.add(foot);

    const toe = mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), M.panel);
    toe.position.set(0, -0.5, 0.25);
    lowerGroup.add(toe);

    return { root, lowerGroup };
  }

  const LL = makeLeg(-1);
  const RL = makeLeg(1);

  // Restore the neutral pose. The render loop calls this every frame before
  // applying the current animation, so animations only set what they change.
  function reset() {
    fig.position.y = 0;
    fig.rotation.set(0, 0, 0);
    torsoGroup.rotation.set(0, 0, 0);
    torsoGroup.scale.set(1, 1, 1);
    headGroup.rotation.set(0, 0, 0);
    LA.root.rotation.set(0, 0, -ARM_SIDE);
    RA.root.rotation.set(0, 0,  ARM_SIDE);
    LA.foreGroup.rotation.set(0, 0, 0);
    RA.foreGroup.rotation.set(0, 0, 0);
    LL.root.rotation.set(0, 0, 0);
    RL.root.rotation.set(0, 0, 0);
    LL.lowerGroup.rotation.set(0, 0, 0);
    RL.lowerGroup.rotation.set(0, 0, 0);
  }

  const rig = {
    fig,
    torso: torsoGroup,
    head: headGroup,
    antBall,
    glow: M.glow,
    LA, RA, LL, RL,
    reset,
  };

  return { materials: M, eyeHalos, rig };
}
