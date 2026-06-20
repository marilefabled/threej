// ── Composition root ──────────────────────────────────────────────────────────
// Wires the reusable engine modules + the robot + the jail (location backdrop,
// ghosts, bloom) together and runs the render loop. The robot demo is unchanged;
// it now stands inside a selectable jail location with floating ghost companions.
import * as THREE from 'three';

import { createScene } from './engine/scene.js';
import { addLighting } from './engine/lighting.js';
import { addEnvironment } from './engine/environment.js';
import { createCameraZoom } from './engine/cameraZoom.js';
import { createBloom } from './engine/bloom.js';
import { createLoop } from './engine/loop.js';
import { createAssets } from './engine/assets.js';
import { createUrlState } from './engine/state.js';
import { createDebugPanel, addBloomControls, addLightControls } from './engine/debugPanel.js';

import { buildRobot } from './robot/robot.js';
import { ANIMATIONS, ZOOM_TARGETS } from './robot/animations.js';
import { THEMES, applyTheme } from './robot/themes.js';

import { createJail } from './jail/jailScene.js';
import { LOCATIONS } from './jail/locationBuilder.js';
import { GHOST_FORMS } from './jail/ghostMesh.js';

import { setupUI } from './ui.js';

// ── Stage ──
const { renderer, scene, camera, controls, BASE_CAM } = createScene();
// The robot is now in a lit room (not the dark void), and bloom adds brightness,
// so dial exposure down from the void-tuned 2.2.
renderer.toneMappingExposure = 1.5;
const lights = addLighting(scene);
const env = addEnvironment(scene);

// The robot now stands in a real room, so hide the open-grid void. Keep the
// themed glow disc + ring (they sit under the robot like a magic circle).
env.floor.visible = false;
env.gridFine.visible = false;
env.gridCoarse.visible = false;

const robot = buildRobot(scene);

// Jail mood light — color set by Mood, intensity by Period. Kept fairly close
// (shorter range) so its tint pools on the figure instead of washing out.
const moodLight = new THREE.PointLight(0x3344aa, 2.4, 13);
moodLight.position.set(0, 3.5, 1.5);
scene.add(moodLight);

// Bloom — makes emissive surfaces (robot core/eyes, ghost eyes/glow) bloom
const bloom = createBloom(renderer, scene, camera, { strength: 0.5, radius: 0.4, threshold: 1.5 });

// Asset loader — ready for GLB/GLTF (Blender/Mixamo) + textures. No models are
// loaded by default; this is the doorway. e.g. from the console:
//   const m = await window.threej.assets.loadModel('https://.../model.glb');
//   window.threej.scene.add(m.scene);
const assets = createAssets();

// Jail: location geometry + ghosts + period/mood lighting + GSAP transitions
const jail = createJail(scene, { moodLight, renderer, getBloomPass: () => bloom.bloomPass });
jail.setLocation('cell_block_a', { animate: false });
jail.addGhost({ glowColor: '#33f589', ghostForm: 'classic', size: 'medium' }, { x: 1.85, y: 0.95, z: 0.5 });
jail.addGhost({ glowColor: '#8899ff', ghostForm: 'wispy',   size: 'small'  }, { x: -1.95, y: 1.15, z: -0.2 });
jail.setPeriod('night');
jail.setMood('neutral');

// What a theme recolors
const themeCtx = {
  materials: robot.materials,
  groundRing: env.groundRing,
  glowDisc: env.glowDisc,
  bounce: lights.bounce,
};

// Camera fly-in for animations (returns to BASE_CAM, hands control back)
const zoom = createCameraZoom(camera, controls, {
  base: BASE_CAM,
  lookAt: new THREE.Vector3(0, 1.6, 0),
});

// ── State ──
let curAnim = 'idle';
let curTheme = 0;
let animTime = 0;

const urlState = createUrlState();
let applying = false;                       // suppress URL writes while loading a build code
const syncUrl = () => { if (!applying) urlState.write(currentConfig()); };

// ── Robot UI (themes + animations) ──
const ui = setupUI({
  themes: THEMES,
  onAnim: (name) => {
    curAnim = name;
    animTime = 0;
    zoom.trigger(ZOOM_TARGETS[name]);
    syncUrl();
  },
  onTheme: (i) => { curTheme = i; applyTheme(THEMES[i], themeCtx); syncUrl(); },
});

// ── Jail UI (location + period + mood + ghost) ──
const locationSelect = document.getElementById('location-select');
LOCATIONS.forEach(loc => {
  const opt = document.createElement('option');
  opt.value = loc.id;
  opt.textContent = loc.name;
  locationSelect.appendChild(opt);
});
locationSelect.value = 'cell_block_a';
locationSelect.addEventListener('change', () => { jail.setLocation(locationSelect.value); syncUrl(); });

const periodSelect = document.getElementById('period-select');
periodSelect.addEventListener('change', () => { jail.setPeriod(periodSelect.value); syncUrl(); });

const moodSelect = document.getElementById('mood-select');
moodSelect.addEventListener('change', () => { jail.setMood(moodSelect.value); syncUrl(); });

// Ghost-form picker drives the primary (front) ghost
const ghostSelect = document.getElementById('ghost-select');
GHOST_FORMS.forEach(form => {
  const opt = document.createElement('option');
  opt.value = form;
  opt.textContent = form[0].toUpperCase() + form.slice(1);
  ghostSelect.appendChild(opt);
});
ghostSelect.value = 'classic';
ghostSelect.addEventListener('change', () => { jail.setGhostForm(0, ghostSelect.value); syncUrl(); });

// ── Debug panel (lil-gui) — live bloom + lighting tuning + robot parts ──
const gui = createDebugPanel({ title: 'Engine' });
addBloomControls(gui, bloom, renderer);
addLightControls(gui, { ...lights, moodLight });

// Robot part variations — a dropdown per part + a randomizer
const partsFolder = gui.addFolder('Robot Parts');
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const partState = { ...robot.parts.current };
['head', 'torso', 'arms', 'legs'].forEach(part => {
  const opts = {};
  robot.parts.options[part].forEach(name => { opts[cap(name)] = name; });
  partsFolder.add(partState, part, opts).name(cap(part))
    .onChange(v => { robot.parts.set(part, v); syncUrl(); }).listen();
});
partState.randomize = () => { Object.assign(partState, robot.parts.randomize()); syncUrl(); };
partsFolder.add(partState, 'randomize').name('Randomize');

// Copy the current look as a shareable link
const share = { copyLink: () => navigator.clipboard?.writeText(location.href) };
gui.add(share, 'copyLink').name('Copy share link');

// ── Build code: read current look ⇄ apply a saved one ──
function currentConfig() {
  return {
    anim: curAnim, theme: curTheme,
    loc: locationSelect.value, period: periodSelect.value,
    mood: moodSelect.value, ghost: ghostSelect.value,
    head: robot.parts.current.head, torso: robot.parts.current.torso,
    arms: robot.parts.current.arms, legs: robot.parts.current.legs,
  };
}

function applyConfig(cfg) {
  applying = true;
  // Robot parts (also reflect into the lil-gui dropdowns via partState + .listen)
  ['head', 'torso', 'arms', 'legs'].forEach(part => {
    if (cfg[part] && robot.parts.options[part].includes(cfg[part])) {
      robot.parts.set(part, cfg[part]); partState[part] = cfg[part];
    }
  });
  if (cfg.loc && [...locationSelect.options].some(o => o.value === cfg.loc)) {
    locationSelect.value = cfg.loc; jail.setLocation(cfg.loc, { animate: false });
  }
  if (cfg.period) { periodSelect.value = cfg.period; jail.setPeriod(cfg.period); }
  if (cfg.mood) { moodSelect.value = cfg.mood; jail.setMood(cfg.mood); }
  if (cfg.ghost && GHOST_FORMS.includes(cfg.ghost)) { ghostSelect.value = cfg.ghost; jail.setGhostForm(0, cfg.ghost); }
  ui.selectTheme(cfg.theme != null && THEMES[+cfg.theme] ? +cfg.theme : 0);
  ui.selectAnim(ANIMATIONS[cfg.anim] ? cfg.anim : 'idle');
  applying = false;
  syncUrl();
}

// Load from the URL build code (falling back to defaults for anything absent)
applyConfig(urlState.read());

// ── Render loop ──
const loop = createLoop(renderer);

// Robot pose — its own time base, reset when the animation changes (onAnim sets
// animTime = 0). Kept separate from the loop's continuous world time `t`.
loop.onFrame((t, dt) => {
  animTime += dt;
  robot.rig.reset();
  (ANIMATIONS[curAnim] || ANIMATIONS.idle)(robot.rig, animTime);
});

// Ghosts float on continuous world time
loop.onFrame((t) => jail.update(t));

// Ambient life — rim lights, bounce, ground-glow pulse
loop.onFrame((t) => {
  lights.rimL.intensity = 4 + Math.sin(t * 0.7) * 1.2;
  lights.rimR.intensity = 2.5 + Math.sin(t * 0.9 + 1) * 0.8;
  lights.bounce.intensity = 2.0 + Math.sin(t * 2.2) * 0.6;
  env.groundRing.material.opacity = 0.22 + Math.sin(t * 2) * 0.1;
  env.glowDisc.material.opacity = 0.1 + Math.sin(t * 1.5) * 0.04;
});

// Camera zoom (don't force lookAt while spinning)
loop.onFrame((t, dt) => zoom.update(dt, curAnim !== 'spin'));

// Draw through the bloom composer — once, after every update above
loop.setRender(() => bloom.render());

loop.start();

// Keep bloom sized with the window (scene.js already resizes renderer + camera)
window.addEventListener('resize', () => {
  bloom.setSize(window.innerWidth, window.innerHeight);
});

// Devtools handles
window.threej = { scene, camera, robot, jail, bloom, loop, assets, GHOST_FORMS };
