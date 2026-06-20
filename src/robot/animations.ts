import * as THREE from 'three';
import { ARM_SIDE } from './robot.js';

// Each animation is a function (rig, t) that poses the rig at time t (seconds).
// The render loop calls rig.reset() first, so a function only sets what it moves.
// To add a new move: add an entry here, a color in ANIM_COLORS, a camera target
// in ZOOM_TARGETS, and a matching <button data-anim="..."> in index.html.
export const ANIMATIONS = {
  idle(rig, t) {
    const { fig, torso, head, LA, RA, antBall, glow } = rig;
    torso.scale.y = 1 + Math.sin(t * 1.3) * 0.03;
    head.rotation.y = Math.sin(t * 0.55) * 0.14;
    LA.root.rotation.z = -ARM_SIDE + Math.sin(t * 1.3) * 0.05;
    RA.root.rotation.z =  ARM_SIDE - Math.sin(t * 1.3) * 0.05;
    fig.position.y = Math.sin(t * 1.3) * 0.02;
    antBall.material.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.5;
    glow.emissiveIntensity = 1.0 + Math.sin(t * 1.8) * 0.25;
  },

  wave(rig, t) {
    const { fig, head, LA, RA, antBall, glow } = rig;
    RA.root.rotation.z = ARM_SIDE;                          // other arm rests
    LA.root.rotation.z = -Math.PI * 0.82;                   // raised up and out
    LA.foreGroup.rotation.z = -0.2 + Math.sin(t * 6) * 0.5; // forearm swings = wave
    head.rotation.y = Math.sin(t * 2) * 0.22;
    head.rotation.z = Math.sin(t * 2) * 0.05;
    fig.position.y = Math.sin(t * 2.5) * 0.025;
    antBall.material.emissiveIntensity = 1.8 + Math.sin(t * 5) * 0.4;
    glow.emissiveIntensity = 1.4 + Math.sin(t * 5) * 0.5;
  },

  dance(rig, t) {
    const { fig, torso, head, LA, RA, LL, RL, antBall, glow } = rig;
    const s = Math.sin(t * 3.5);
    fig.rotation.y = s * 0.25;
    torso.rotation.z = s * 0.14;
    torso.rotation.x = Math.sin(t * 3.5 + 0.5) * 0.07;
    head.rotation.z = -s * 0.12;
    head.rotation.y = Math.sin(t * 3.5 + 1) * 0.2;
    LA.root.rotation.z = -(ARM_SIDE + s * 0.4); // pump arms from shoulder
    RA.root.rotation.z =   ARM_SIDE + s * 0.4;
    LA.root.rotation.x =  s * 0.4;
    RA.root.rotation.x = -s * 0.4;
    LL.root.rotation.x =  s * 0.28;
    RL.root.rotation.x = -s * 0.28;
    fig.position.y = Math.abs(s) * 0.12;
    antBall.material.emissiveIntensity = 1.2 + Math.abs(s) * 1.2;
    glow.emissiveIntensity = 1.3 + Math.abs(s) * 0.6;
  },

  spin(rig, t) {
    const { fig, LA, RA, antBall, glow } = rig;
    fig.rotation.y = t * 4.5;
    LA.root.rotation.z = -Math.PI * 0.5; // full T-pose
    RA.root.rotation.z =  Math.PI * 0.5;
    LA.root.rotation.x = -0.2;
    RA.root.rotation.x = -0.2;
    fig.position.y = Math.sin(t * 9) * 0.04;
    antBall.material.emissiveIntensity = 2.2;
    glow.emissiveIntensity = 1.8;
  },

  jump(rig, t) {
    const { fig, LA, RA, LL, RL, antBall, glow } = rig;
    const phase = t * 1.8 % (Math.PI * 2);
    const h = Math.max(0, Math.sin(phase));
    fig.position.y = h * 1.4;
    if (h > 0.05) {
      LL.root.rotation.x = 0.45;
      RL.root.rotation.x = 0.45;
      LL.lowerGroup.rotation.x = -0.65;
      RL.lowerGroup.rotation.x = -0.65;
      LA.root.rotation.x = -0.7;
      RA.root.rotation.x = -0.7;
      LA.root.rotation.z = -ARM_SIDE;
      RA.root.rotation.z =  ARM_SIDE;
      fig.rotation.x = Math.sin(phase) * 0.1;
    } else {
      LL.root.rotation.x = -0.1;
      RL.root.rotation.x = -0.1;
    }
    antBall.material.emissiveIntensity = 0.8 + h * 1.8;
    glow.emissiveIntensity = 1.0 + h * 0.8;
  },

  punch(rig, t) {
    const { fig, head, LA, RA, antBall, glow } = rig;
    const sp = t * 7;
    const lp = Math.max(0, Math.sin(sp));
    const rp = Math.max(0, Math.sin(sp + Math.PI));
    fig.rotation.y = (lp - rp) * 0.2;          // torso twists into the punch
    LA.root.rotation.z = -0.3;
    RA.root.rotation.z =  0.3;
    LA.root.rotation.x = -Math.PI * 0.5;
    RA.root.rotation.x = -Math.PI * 0.5;
    LA.foreGroup.rotation.x = -1.5 + lp * 1.5; // bent -> snaps straight on jab
    RA.foreGroup.rotation.x = -1.5 + rp * 1.5;
    head.rotation.y = (lp - rp) * 0.15;
    fig.position.y = Math.abs(Math.sin(sp)) * 0.03;
    antBall.material.emissiveIntensity = 1.0 + (lp + rp) * 1.0;
    glow.emissiveIntensity = 1.2 + (lp + rp) * 0.6;
  },

  flex(rig, t) {
    const { fig, torso, head, LA, RA, antBall, glow } = rig;
    const f = Math.sin(t * 2);
    LA.root.rotation.z = -ARM_SIDE;
    RA.root.rotation.z =  ARM_SIDE;
    LA.root.rotation.x = -0.25;
    RA.root.rotation.x = -0.25;
    LA.foreGroup.rotation.x = -2.4 + Math.sin(t * 4) * 0.08; // bicep curl
    RA.foreGroup.rotation.x = -2.4 + Math.sin(t * 4) * 0.08;
    torso.rotation.y = f * 0.18;
    head.rotation.y = f * 0.22;
    fig.position.y = Math.abs(f) * 0.03;
    antBall.material.emissiveIntensity = 1.4 + Math.abs(Math.sin(t * 4)) * 1.2;
    glow.emissiveIntensity = 1.3 + Math.abs(f) * 0.5;
  },

  walk(rig, t) {
    const { fig, head, LA, RA, LL, RL, antBall, glow } = rig;
    const w = t * 4.2;
    const sw = Math.sin(w);
    LL.root.rotation.x =  sw * 0.55;
    RL.root.rotation.x = -sw * 0.55;
    LL.lowerGroup.rotation.x = Math.max(0, -sw) * 0.7;
    RL.lowerGroup.rotation.x = Math.max(0,  sw) * 0.7;
    LA.root.rotation.z = -ARM_SIDE * 0.22; // arms mostly down, swinging
    RA.root.rotation.z =  ARM_SIDE * 0.22;
    LA.root.rotation.x = -sw * 0.5;
    RA.root.rotation.x =  sw * 0.5;
    head.rotation.y = sw * 0.06;
    fig.position.y = Math.abs(Math.sin(w * 2)) * 0.04;
    antBall.material.emissiveIntensity = 1.0 + Math.abs(sw) * 0.6;
    glow.emissiveIntensity = 1.1 + Math.abs(sw) * 0.3;
  },

  think(rig, t) {
    const { fig, head, LA, RA, antBall, glow } = rig;
    RA.root.rotation.z = 0.45;
    RA.root.rotation.x = -Math.PI * 0.62;
    RA.foreGroup.rotation.x = -1.7;          // forearm up toward chin
    LA.root.rotation.z = -ARM_SIDE * 0.5;    // other arm relaxed lower
    LA.root.rotation.x = -0.15;
    head.rotation.z = 0.16;
    head.rotation.x = 0.13;
    head.rotation.y = Math.sin(t * 0.9) * 0.12;
    fig.position.y = Math.sin(t * 1.2) * 0.015;
    antBall.material.emissiveIntensity = 0.5 + Math.sin(t * 2.5) * 0.3;
    glow.emissiveIntensity = 0.9 + Math.sin(t * 1.5) * 0.2;
  },
};

// Label / button accent color per animation
export const ANIM_COLORS = {
  idle:  '#aabbff', wave:  '#00ffaa', dance: '#ff6644', spin:  '#44aaff',
  jump:  '#ffcc22', punch: '#ff5533', flex:  '#ffdd33', walk:  '#33ddff',
  think: '#cc88ff',
};

// Where the camera flies to when each animation starts
export const ZOOM_TARGETS = {
  idle:  new THREE.Vector3(0,    2.2, 8.5),
  wave:  new THREE.Vector3(-1.5, 2.8, 5.5),
  dance: new THREE.Vector3(0,    1.5, 5.0),
  spin:  new THREE.Vector3(1.5,  3.0, 5.0),
  jump:  new THREE.Vector3(0,    4.5, 6.5),
  punch: new THREE.Vector3(1.6,  2.4, 5.2),
  flex:  new THREE.Vector3(0,    2.2, 4.8),
  walk:  new THREE.Vector3(2.6,  2.6, 6.0),
  think: new THREE.Vector3(-1.2, 2.9, 4.8),
};
