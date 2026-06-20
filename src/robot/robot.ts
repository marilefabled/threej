import * as THREE from 'three';

// Arms hang DOWN by default. Positive Z rotation swings an arm toward the body
// centre, negative Z away. Shoulder-level T-pose = left -ARM_SIDE, right +ARM_SIDE.
export const ARM_SIDE = Math.PI * 0.5;

// Builds the robot over a FIXED skeleton of pivot groups (which the animations
// drive) and fills each part with a swappable visual "variant". Swapping a part
// only rebuilds the meshes inside that pivot — the kinematics never change, so
// every animation keeps working. Returns:
//   materials  — shared material set (themes recolor these)
//   rig        — handles the animations move, plus rig.reset()
//   parts      — { options, current, set(part, name), randomize() }
export function buildRobot(scene) {
  // ── Materials (recolored by themes.js) ──
  const M = {
    body:  new THREE.MeshStandardMaterial({ color: 0x7799bb, roughness: 0.25, metalness: 0.7,  emissive: 0x223355, emissiveIntensity: 0.6 }),
    head:  new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.2,  metalness: 0.72, emissive: 0x2a4466, emissiveIntensity: 0.7 }),
    limb:  new THREE.MeshStandardMaterial({ color: 0x5577aa, roughness: 0.3,  metalness: 0.75, emissive: 0x162244, emissiveIntensity: 0.5 }),
    joint: new THREE.MeshStandardMaterial({ color: 0xaabbd0, roughness: 0.45, metalness: 0.55, emissive: 0x334455, emissiveIntensity: 0.3 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.6,  metalness: 0.5,  emissive: 0x111e2e, emissiveIntensity: 0.4 }),
    eye:   new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 4.0, roughness: 0, metalness: 0 }),
    eyeHalo: new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.12 }),
    glow:  new THREE.MeshStandardMaterial({ color: 0x22eeff, emissive: 0x22eeff, emissiveIntensity: 2.5, roughness: 0 }),
  };

  const fig = new THREE.Group();
  scene.add(fig);

  // mesh helpers
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const box = (w, h, d, mat) => mk(new THREE.BoxGeometry(w, h, d), mat);
  const cyl = (rt, rb, h, mat, s = 10) => mk(new THREE.CylinderGeometry(rt, rb, h, s), mat);
  const sph = (r, mat, a = 12, b = 8) => mk(new THREE.SphereGeometry(r, a, b), mat);
  const tor = (r, t, mat, seg = 20) => mk(new THREE.TorusGeometry(r, t, 10, seg), mat);
  const halo = (r, pos) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), M.eyeHalo); m.position.copy(pos); return m; };
  const clear = (g) => { while (g.children.length) { const c = g.children[0]; g.remove(c); c.geometry?.dispose(); } };
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

  // ── Skeleton: persistent pivots the animations reference ──
  const torsoGroup = new THREE.Group(); torsoGroup.position.y = 1.45; fig.add(torsoGroup);
  const torsoVis = new THREE.Group(); torsoGroup.add(torsoVis);

  // Hips + neck are static (not part of the variation set)
  const hips = new THREE.Group(); hips.position.y = 0.93; fig.add(hips);
  hips.add(box(0.64, 0.24, 0.4, M.body));
  [-1, 1].forEach(s => hips.add(at(box(0.1, 0.2, 0.38, M.panel), s * 0.28, 0, 0)));
  fig.add(at(cyl(0.09, 0.12, 0.2, M.joint), 0, 1.9, 0));

  const headGroup = new THREE.Group(); headGroup.position.y = 2.1; fig.add(headGroup);
  const headVis = new THREE.Group(); headGroup.add(headVis);

  function makeArm(sign) {
    const root = new THREE.Group(); root.position.set(sign * 0.52, 1.62, 0); fig.add(root);
    const upperVis = new THREE.Group(); root.add(upperVis);
    const foreGroup = new THREE.Group(); foreGroup.position.y = -0.45; root.add(foreGroup);
    const foreVis = new THREE.Group(); foreGroup.add(foreVis);
    return { root, foreGroup, upperVis, foreVis };
  }
  const LA = makeArm(-1), RA = makeArm(1);

  function makeLeg(sign) {
    const root = new THREE.Group(); root.position.set(sign * 0.22, 0.93, 0); fig.add(root);
    const upperVis = new THREE.Group(); root.add(upperVis);
    const lowerGroup = new THREE.Group(); lowerGroup.position.y = -0.48; root.add(lowerGroup);
    const lowerVis = new THREE.Group(); lowerGroup.add(lowerVis);
    return { root, lowerGroup, upperVis, lowerVis };
  }
  const LL = makeLeg(-1), RL = makeLeg(1);

  // ── Part variants ───────────────────────────────────────────────────────────
  // Each head variant fills headVis and returns the antenna ball (animated glow).
  const HEAD = {
    boxy(g) {
      g.add(at(box(0.6, 0.56, 0.5, M.head), 0, 0.28, 0));
      g.add(at(box(0.5, 0.18, 0.5, M.panel), 0, 0.32, 0.001));
      [-0.13, 0.13].forEach(x => {
        const e = at(sph(0.068, M.eye, 12, 12), x, 0.33, 0.26); g.add(e); g.add(halo(0.1, e.position));
      });
      for (let i = 0; i < 4; i++) g.add(at(box(0.28, 0.028, 0.5, M.panel), 0, 0.08 + i * 0.048, 0));
      [-1, 1].forEach(s => g.add(at(box(0.06, 0.2, 0.3, M.panel), s * 0.3, 0.28, 0)));
      g.add(at(cyl(0.016, 0.016, 0.3, M.joint, 8), 0, 0.71, 0));
      const ball = at(sph(0.058, M.glow, 12, 12), 0, 0.86, 0); g.add(ball);
      return ball;
    },
    round(g) {
      const h = at(sph(0.33, M.head, 20, 16), 0, 0.34, 0); h.scale.set(1, 0.95, 1); g.add(h);
      g.add(at(box(0.5, 0.14, 0.06, M.panel), 0, 0.42, 0.26));         // brow band
      [-0.13, 0.13].forEach(x => {
        const e = at(sph(0.082, M.eye, 14, 14), x, 0.34, 0.29); g.add(e); g.add(halo(0.12, e.position));
      });
      g.add(at(box(0.18, 0.03, 0.04, M.panel), 0, 0.2, 0.31));          // little mouth
      g.add(at(cyl(0.014, 0.014, 0.26, M.joint, 8), 0, 0.66, 0));
      const ball = at(sph(0.06, M.glow, 12, 12), 0, 0.8, 0); g.add(ball);
      return ball;
    },
    slim(g) {
      g.add(at(box(0.44, 0.64, 0.44, M.head), 0, 0.32, 0));
      g.add(at(box(0.34, 0.5, 0.02, M.panel), 0, 0.34, 0.225));         // tall visor plate
      [-0.1, 0.1].forEach(x => {
        const e = at(sph(0.052, M.eye, 12, 12), x, 0.42, 0.24); g.add(e); g.add(halo(0.082, e.position));
      });
      g.add(at(box(0.22, 0.025, 0.46, M.panel), 0, 0.16, 0));           // single mouth slit
      g.add(at(cyl(0.014, 0.014, 0.42, M.joint, 8), 0, 0.85, 0));
      const ball = at(sph(0.05, M.glow, 12, 12), 0, 1.08, 0); g.add(ball);
      return ball;
    },
    dome(g) {
      const h = at(sph(0.34, M.head, 20, 16), 0, 0.28, 0); h.scale.set(1.05, 0.72, 1.05); g.add(h);
      g.add(at(cyl(0.32, 0.36, 0.14, M.panel, 18), 0, 0.1, 0));        // collar base
      [-0.12, 0.12].forEach(x => { const e = at(sph(0.07, M.eye, 14, 14), x, 0.26, 0.27); g.add(e); g.add(halo(0.1, e.position)); });
      g.add(at(box(0.16, 0.025, 0.04, M.panel), 0, 0.12, 0.3));        // mouth
      g.add(at(cyl(0.013, 0.013, 0.22, M.joint, 6), 0, 0.5, 0));       // antenna cluster
      [-0.1, 0.1].forEach(x => g.add(at(cyl(0.011, 0.011, 0.14, M.joint, 6), x, 0.46, 0)));
      const ball = at(sph(0.05, M.glow, 12, 12), 0, 0.63, 0); g.add(ball);
      [-0.1, 0.1].forEach(x => g.add(at(sph(0.03, M.glow, 10, 10), x, 0.55, 0)));
      return ball;
    },
    visor(g) {
      g.add(at(box(0.6, 0.5, 0.5, M.head), 0, 0.3, 0));
      g.add(at(box(0.54, 0.16, 0.06, M.panel), 0, 0.34, 0.24));        // visor housing
      g.add(at(box(0.48, 0.07, 0.04, M.eye), 0, 0.34, 0.27));          // single glowing visor bar
      for (let i = 0; i < 3; i++) g.add(at(box(0.3, 0.026, 0.5, M.panel), 0, 0.1 + i * 0.05, 0));
      [-1, 1].forEach(s => g.add(at(box(0.05, 0.22, 0.34, M.panel), s * 0.31, 0.3, 0)));
      g.add(at(cyl(0.016, 0.016, 0.28, M.joint, 8), 0, 0.7, 0));
      const ball = at(sph(0.055, M.glow, 12, 12), 0, 0.84, 0); g.add(ball);
      return ball;
    },
  };

  const TORSO = {
    boxy(g) {
      g.add(box(0.76, 0.92, 0.44, M.body));
      g.add(at(box(0.38, 0.46, 0.44, M.panel), 0, 0, 0.001));
      g.add(box(0.06, 0.5, 0.445, M.panel));
      g.add(at(sph(0.075, M.glow, 16, 16), 0, 0, 0.225));
      [-1, 1].forEach(s => g.add(at(box(0.14, 0.16, 0.36, M.panel), s * 0.39, 0.32, 0)));
    },
    barrel(g) {
      g.add(cyl(0.42, 0.42, 0.94, M.body, 18));
      g.add(at(cyl(0.45, 0.45, 0.1, M.panel, 18), 0, 0.22, 0));
      g.add(at(cyl(0.45, 0.45, 0.1, M.panel, 18), 0, -0.22, 0));
      g.add(at(sph(0.085, M.glow, 16, 16), 0, 0, 0.4));
      [-1, 1].forEach(s => g.add(at(sph(0.13, M.joint, 12, 12), s * 0.4, 0.34, 0)));
    },
    slim(g) {
      g.add(box(0.58, 0.96, 0.34, M.body));
      g.add(at(box(0.3, 0.54, 0.35, M.panel), 0, 0, 0.001));
      g.add(at(sph(0.07, M.glow, 16, 16), 0, 0.02, 0.18));
      [-1, 1].forEach(s => g.add(at(box(0.1, 0.5, 0.3, M.limb), s * 0.32, 0, 0)));
    },
    tank(g) {
      g.add(box(0.92, 0.86, 0.5, M.body));
      g.add(at(box(0.5, 0.5, 0.52, M.panel), 0, 0, 0.001));            // chest armor
      g.add(at(sph(0.08, M.glow, 16, 16), 0, 0.05, 0.27));
      [-1, 1].forEach(s => {                                          // shoulder armor
        g.add(at(box(0.26, 0.22, 0.46, M.panel), s * 0.5, 0.34, 0));
        g.add(at(box(0.26, 0.1, 0.46, M.limb), s * 0.5, 0.46, 0));
      });
      g.add(at(box(0.94, 0.12, 0.52, M.limb), 0, -0.4, 0));            // belt
    },
    orb(g) {
      g.add(at(sph(0.4, M.body, 22, 18), 0, 0, 0));                    // spherical core
      const ring = at(tor(0.42, 0.05, M.panel, 24), 0, 0, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      g.add(at(sph(0.12, M.glow, 16, 16), 0, 0, 0.34));               // glowing core
      [-1, 1].forEach(s => g.add(at(sph(0.14, M.joint, 14, 14), s * 0.38, 0.28, 0)));
      g.add(at(cyl(0.16, 0.2, 0.18, M.panel, 12), 0, 0.42, 0));        // neck cap
      g.add(at(cyl(0.2, 0.16, 0.18, M.panel, 12), 0, -0.42, 0));       // hip cap
    },
  };

  // Arm variants fill upperVis (at the shoulder) + foreVis (at the elbow). Keep
  // the elbow at y=-0.45 and hand at y=-0.5 so the kinematics match.
  const ARM = {
    tube(upperVis, foreVis) {
      upperVis.add(sph(0.11, M.joint, 10, 10));
      upperVis.add(at(cyl(0.088, 0.082, 0.42, M.limb), 0, -0.23, 0));
      upperVis.add(at(sph(0.092, M.joint, 10, 10), 0, -0.45, 0));
      foreVis.add(at(cyl(0.068, 0.06, 0.36, M.limb), 0, -0.19, 0));
      foreVis.add(at(sph(0.065, M.joint, 8, 8), 0, -0.39, 0));
      foreVis.add(at(box(0.15, 0.15, 0.1, M.body), 0, -0.5, 0));
    },
    blocky(upperVis, foreVis) {
      upperVis.add(box(0.2, 0.2, 0.2, M.joint));
      upperVis.add(at(box(0.16, 0.42, 0.16, M.limb), 0, -0.23, 0));
      upperVis.add(at(box(0.19, 0.13, 0.19, M.joint), 0, -0.45, 0));
      foreVis.add(at(box(0.14, 0.36, 0.14, M.limb), 0, -0.19, 0));
      foreVis.add(at(box(0.17, 0.16, 0.13, M.body), 0, -0.5, 0));
    },
    claw(upperVis, foreVis) {
      upperVis.add(sph(0.11, M.joint, 10, 10));
      upperVis.add(at(cyl(0.085, 0.078, 0.42, M.limb), 0, -0.23, 0));
      upperVis.add(at(sph(0.09, M.joint, 10, 10), 0, -0.45, 0));
      foreVis.add(at(cyl(0.065, 0.058, 0.34, M.limb), 0, -0.18, 0));
      foreVis.add(at(sph(0.06, M.joint, 8, 8), 0, -0.38, 0));          // claw base
      const p1 = at(box(0.05, 0.16, 0.05, M.body), -0.05, -0.48, 0.02); p1.rotation.z = 0.35; foreVis.add(p1);
      const p2 = at(box(0.05, 0.16, 0.05, M.body), 0.05, -0.48, 0.02); p2.rotation.z = -0.35; foreVis.add(p2);
    },
    piston(upperVis, foreVis) {
      upperVis.add(box(0.18, 0.14, 0.18, M.joint));                    // shoulder block
      upperVis.add(at(cyl(0.06, 0.06, 0.42, M.limb), 0, -0.23, 0));    // thin rod
      upperVis.add(at(cyl(0.1, 0.1, 0.2, M.panel), 0, -0.2, 0));       // piston sleeve
      upperVis.add(at(sph(0.09, M.joint, 10, 10), 0, -0.45, 0));
      foreVis.add(at(cyl(0.055, 0.055, 0.34, M.limb), 0, -0.18, 0));
      foreVis.add(at(cyl(0.09, 0.09, 0.16, M.panel), 0, -0.14, 0));    // sleeve
      foreVis.add(at(box(0.15, 0.12, 0.13, M.body), 0, -0.5, 0));      // hand
    },
  };

  // Leg variants fill upperVis (hip) + lowerVis (at the knee, y=-0.48).
  const LEG = {
    tube(upperVis, lowerVis) {
      upperVis.add(at(cyl(0.115, 0.105, 0.46, M.limb), 0, -0.24, 0));
      upperVis.add(at(sph(0.11, M.joint, 10, 10), 0, -0.48, 0));
      lowerVis.add(at(cyl(0.08, 0.072, 0.4, M.limb), 0, -0.21, 0));
      lowerVis.add(at(sph(0.075, M.joint, 8, 8), 0, -0.43, 0));
      lowerVis.add(at(box(0.18, 0.1, 0.3, M.body), 0, -0.5, 0.07));
      lowerVis.add(at(box(0.16, 0.06, 0.08, M.panel), 0, -0.5, 0.25));
    },
    blocky(upperVis, lowerVis) {
      upperVis.add(at(box(0.2, 0.46, 0.2, M.limb), 0, -0.24, 0));
      upperVis.add(at(box(0.19, 0.14, 0.19, M.joint), 0, -0.48, 0));
      lowerVis.add(at(box(0.16, 0.4, 0.16, M.limb), 0, -0.21, 0));
      lowerVis.add(at(box(0.22, 0.12, 0.34, M.body), 0, -0.5, 0.08));
      lowerVis.add(at(box(0.2, 0.07, 0.1, M.panel), 0, -0.5, 0.27));
    },
    wheel(upperVis, lowerVis) {
      upperVis.add(at(cyl(0.11, 0.1, 0.44, M.limb), 0, -0.24, 0));
      upperVis.add(at(sph(0.11, M.joint, 10, 10), 0, -0.48, 0));
      lowerVis.add(at(cyl(0.075, 0.07, 0.34, M.limb), 0, -0.18, 0));
      // wheel (cylinder laid on its side, sized so it rests on the floor)
      const w = at(cyl(0.17, 0.17, 0.13, M.body, 18), 0, -0.38, 0.02); w.rotation.z = Math.PI / 2; lowerVis.add(w);
      const hub = at(cyl(0.07, 0.07, 0.15, M.panel, 12), 0, -0.38, 0.02); hub.rotation.z = Math.PI / 2; lowerVis.add(hub);
    },
    hover(upperVis, lowerVis) {
      upperVis.add(at(cyl(0.12, 0.1, 0.4, M.limb), 0, -0.22, 0));
      upperVis.add(at(sph(0.11, M.joint, 10, 10), 0, -0.46, 0));
      lowerVis.add(at(cyl(0.08, 0.18, 0.3, M.panel, 16), 0, -0.22, 0)); // flared thruster nozzle
      lowerVis.add(at(cyl(0.16, 0.16, 0.04, M.limb, 16), 0, -0.37, 0)); // rim
      lowerVis.add(at(sph(0.1, M.glow, 14, 14), 0, -0.42, 0));          // thruster glow
    },
  };

  // ── Build / swap ──
  const current = { head: 'boxy', torso: 'boxy', arms: 'tube', legs: 'tube' };
  let antBall = null;

  function buildHead(name) { clear(headVis); antBall = HEAD[name](headVis); rig.antBall = antBall; current.head = name; }
  function buildTorso(name) { clear(torsoVis); TORSO[name](torsoVis); current.torso = name; }
  function buildArms(name) {
    [LA, RA].forEach(a => { clear(a.upperVis); clear(a.foreVis); ARM[name](a.upperVis, a.foreVis); });
    current.arms = name;
  }
  function buildLegs(name) {
    [LL, RL].forEach(l => { clear(l.upperVis); clear(l.lowerVis); LEG[name](l.upperVis, l.lowerVis); });
    current.legs = name;
  }

  const BUILDERS = { head: buildHead, torso: buildTorso, arms: buildArms, legs: buildLegs };
  const options = { head: Object.keys(HEAD), torso: Object.keys(TORSO), arms: Object.keys(ARM), legs: Object.keys(LEG) };

  function setVariant(part, name) { if (BUILDERS[part] && options[part].includes(name)) BUILDERS[part](name); }
  function randomize() {
    for (const part of Object.keys(options)) {
      const list = options[part];
      setVariant(part, list[Math.floor(Math.random() * list.length)]);
    }
    return { ...current };
  }

  // Restore neutral pose each frame before an animation runs.
  function reset() {
    fig.position.y = 0; fig.rotation.set(0, 0, 0);
    torsoGroup.rotation.set(0, 0, 0); torsoGroup.scale.set(1, 1, 1);
    headGroup.rotation.set(0, 0, 0);
    LA.root.rotation.set(0, 0, -ARM_SIDE); RA.root.rotation.set(0, 0, ARM_SIDE);
    LA.foreGroup.rotation.set(0, 0, 0); RA.foreGroup.rotation.set(0, 0, 0);
    LL.root.rotation.set(0, 0, 0); RL.root.rotation.set(0, 0, 0);
    LL.lowerGroup.rotation.set(0, 0, 0); RL.lowerGroup.rotation.set(0, 0, 0);
  }

  const rig = { fig, torso: torsoGroup, head: headGroup, antBall: null, glow: M.glow, LA, RA, LL, RL, reset };

  // Build the defaults
  buildTorso('boxy'); buildHead('boxy'); buildArms('tube'); buildLegs('tube');

  const parts = { options, current, set: setVariant, randomize };

  return { materials: M, rig, parts };
}
