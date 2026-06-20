// ── Composition root ──────────────────────────────────────────────────────────
// Wires the reusable engine modules together with the robot-specific pieces and
// runs the render loop. Read top-to-bottom: build the scene, build the robot,
// wire the UI, then animate.
import * as THREE from 'three';

import { createScene } from './engine/scene.js';
import { addLighting } from './engine/lighting.js';
import { addEnvironment } from './engine/environment.js';
import { createCameraZoom } from './engine/cameraZoom.js';

import { buildRobot } from './robot/robot.js';
import { ANIMATIONS, ANIM_COLORS, ZOOM_TARGETS } from './robot/animations.js';
import { THEMES, applyTheme } from './robot/themes.js';

import { setupUI } from './ui.js';

// ── Build the stage ──
const { renderer, scene, camera, controls, BASE_CAM } = createScene();
const lights = addLighting(scene);
const env = addEnvironment(scene);
const robot = buildRobot(scene);

// What a theme needs to recolor
const themeCtx = {
  materials: robot.materials,
  eyeHalos: robot.eyeHalos,
  groundRing: env.groundRing,
  glowDisc: env.glowDisc,
  bounce: lights.bounce,
};

// Camera fly-in helper, returns to BASE_CAM and hands control back to the user
const zoom = createCameraZoom(camera, controls, {
  base: BASE_CAM,
  lookAt: new THREE.Vector3(0, 1.6, 0),
});

// ── State ──
let curAnim = 'idle';
let animTime = 0;

// ── UI ──
const ui = setupUI({
  themes: THEMES,
  onAnim: (name) => {
    curAnim = name;
    animTime = 0;                  // restart the move from t=0
    zoom.trigger(ZOOM_TARGETS[name]);
  },
  onTheme: (i) => applyTheme(THEMES[i], themeCtx),
});

// Initial selection (these fire the callbacks above)
ui.selectTheme(0);
ui.selectAnim('idle');

// ── Render loop ──
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  animTime += dt;
  const t = animTime;

  // Pose the robot: reset to neutral, then apply the current animation
  robot.rig.reset();
  (ANIMATIONS[curAnim] || ANIMATIONS.idle)(robot.rig, t);

  // Ambient life: breathing rim lights, bounce, and ground glow pulse
  lights.rimL.intensity = 4 + Math.sin(t * 0.7) * 1.2;
  lights.rimR.intensity = 2.5 + Math.sin(t * 0.9 + 1) * 0.8;
  lights.bounce.intensity = 2.0 + Math.sin(t * 2.2) * 0.6;
  env.groundRing.material.opacity = 0.22 + Math.sin(t * 2) * 0.1;
  env.glowDisc.material.opacity = 0.1 + Math.sin(t * 1.5) * 0.04;

  // Camera: don't force lookAt while spinning (let the subject rotate freely)
  zoom.update(dt, curAnim !== 'spin');

  renderer.render(scene, camera);
});

// Expose a couple of handles for tinkering from the devtools console
window.threej = { scene, camera, robot, ANIM_COLORS };
