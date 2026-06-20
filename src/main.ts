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
import { createPhysics } from './engine/physics.js';
import { createAudio } from './engine/audio.js';
import { createECS } from './engine/ecs.js';
import { createAnimator } from './engine/animator.js';
import { createRootMotion } from './engine/rootMotion.js';
import { createStateMachine } from './engine/stateMachine.js';
import { createInput } from './engine/input.js';
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

// ── Physics (Rapier) — a floor + droppable crates that pile up in the cell ──
const physics = await createPhysics();
physics.addGround(0);                                    // matches the jail floor at y=0
// Cell walls (cell_block_a is 8 wide x 10 deep) so the capsule character stays in.
physics.addStaticBox(0.1, 2, 5, 4, 2, 0);
physics.addStaticBox(0.1, 2, 5, -4, 2, 0);
physics.addStaticBox(4, 2, 0.1, 0, 2, 5);
physics.addStaticBox(4, 2, 0.1, 0, 2, -5);

// ── Audio (Howler) — procedurally-synthesized blips/thuds, no asset files ──
const audio = createAudio({ volume: 0.5 });
audio.tone('blip', { freq: 620, dur: 0.07, type: 'square', decay: 26, volume: 0.4 });
audio.tone('swish', { freq: 320, dur: 0.14, decay: 12, volume: 0.35 });
audio.tone('thud', { freq: 110, dur: 0.2, type: 'noise', decay: 24, volume: 0.5 });

// ── ECS (miniplex) — dropped props are entities; systems sync + auto-despawn ──
const ecs = createECS();
// sync each prop's mesh from its physics body
ecs.system((world) => {
  for (const e of world.with('mesh', 'body')) {
    const t = e.body.translation(), r = e.body.rotation();
    e.mesh.position.set(t.x, t.y, t.z);
    e.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
});
// time-to-live: shrink out over the last 0.5s, then despawn (mesh + body + entity)
ecs.system((world, dt) => {
  for (const e of [...world.with('ttl')]) {
    e.ttl -= dt;
    if (e.ttl <= 0) { scene.remove(e.mesh); physics.remove(e.body); world.remove(e); }
    else if (e.ttl < 0.5) e.mesh.scale.setScalar(Math.max(0.02, e.ttl / 0.5));
  }
});

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
    if (!applying) audio.play('swish');
    syncUrl();
  },
  onTheme: (i) => { curTheme = i; applyTheme(THEMES[i], themeCtx); if (!applying) audio.play('blip'); syncUrl(); },
});

// ── Jail UI (location + period + mood + ghost) ──
const locationSelect = document.getElementById('location-select') as HTMLSelectElement;
LOCATIONS.forEach(loc => {
  const opt = document.createElement('option');
  opt.value = loc.id;
  opt.textContent = loc.name;
  locationSelect.appendChild(opt);
});
locationSelect.value = 'cell_block_a';
locationSelect.addEventListener('change', () => { jail.setLocation(locationSelect.value); audio.play('blip'); syncUrl(); });

const periodSelect = document.getElementById('period-select') as HTMLSelectElement;
periodSelect.addEventListener('change', () => { jail.setPeriod(periodSelect.value); audio.play('blip'); syncUrl(); });

const moodSelect = document.getElementById('mood-select') as HTMLSelectElement;
moodSelect.addEventListener('change', () => { jail.setMood(moodSelect.value); audio.play('blip'); syncUrl(); });

// Ghost-form picker drives the primary (front) ghost
const ghostSelect = document.getElementById('ghost-select') as HTMLSelectElement;
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
const partState: any = { ...robot.parts.current };
(['head', 'torso', 'arms', 'legs'] as const).forEach(part => {
  const opts: Record<string, string> = {};
  robot.parts.options[part].forEach((name: string) => { opts[cap(name)] = name; });
  partsFolder.add(partState, part, opts).name(cap(part))
    .onChange((v: string) => { robot.parts.set(part, v); syncUrl(); }).listen();
});
partState.randomize = () => { Object.assign(partState, robot.parts.randomize()); syncUrl(); };
partsFolder.add(partState, 'randomize').name('Randomize');

// Copy the current look as a shareable link
const share = { copyLink: () => navigator.clipboard?.writeText(location.href) };
gui.add(share, 'copyLink').name('Copy share link');

// ── Physics demo: drop crates/orbs that fall + pile on the floor ──
const PROP_MATS = [
  new THREE.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.7, metalness: 0.1 }),
  new THREE.MeshStandardMaterial({ color: 0x6699cc, roughness: 0.5, metalness: 0.4 }),
  new THREE.MeshStandardMaterial({ color: 0xaa5577, roughness: 0.6, metalness: 0.2 }),
];
function spawnProp() {
  const ball = Math.random() < 0.35;
  const s = 0.28 + Math.random() * 0.16;
  const mat = PROP_MATS[(Math.random() * PROP_MATS.length) | 0];
  const mesh = new THREE.Mesh(
    ball ? new THREE.SphereGeometry(s, 16, 12) : new THREE.BoxGeometry(s * 2, s * 2, s * 2),
    mat,
  );
  mesh.castShadow = mesh.receiveShadow = true;
  // Spawn in a ring around the robot so they land beside it, not inside it
  const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 1.0;
  mesh.position.set(Math.cos(a) * r, 4 + Math.random() * 1.5, Math.sin(a) * r);
  mesh.quaternion.random();
  scene.add(mesh);
  const shape = ball ? { type: 'ball', r: s } : { type: 'box', hx: s, hy: s, hz: s };
  // ECS owns the prop: physics body (sync + ttl handled by systems below)
  const body = physics.addDynamic(mesh, shape, { restitution: ball ? 0.55 : 0.25, link: false });
  ecs.world.add({ mesh, body, ttl: 9 });
  audio.play('thud', { rate: 0.85 + Math.random() * 0.4 });   // vary pitch per drop
}
function clearProps() {
  for (const e of [...ecs.world.with('mesh', 'body')]) { scene.remove(e.mesh); physics.remove(e.body); ecs.world.remove(e); }
}
const physicsFolder = gui.addFolder('Physics');
physicsFolder.add({ drop: () => spawnProp() }, 'drop').name('Drop one');
physicsFolder.add({ drop10: () => { for (let i = 0; i < 10; i++) spawnProp(); } }, 'drop10').name('Drop 10');
physicsFolder.add({ clear: () => clearProps() }, 'clear').name('Clear');

// Audio (Howler) — master volume + mute
const audioState = { volume: 0.5, mute: false };
const audioFolder = gui.addFolder('Audio');
audioFolder.add(audioState, 'volume', 0, 1, 0.01).onChange((v: number) => audio.setVolume(v));
audioFolder.add(audioState, 'mute').onChange((m: boolean) => audio.mute(m));

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

// Physics: advance the world (props are synced by the ECS system below)
loop.onFrame((t, dt) => physics.step(dt));

// ECS: run systems (mesh-sync from bodies, then ttl despawn) after the step
loop.onFrame((t, dt) => ecs.update(dt, t));

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
window.threej = { THREE, scene, camera, robot, jail, bloom, loop, assets, physics, audio, ecs, spawnProp, GHOST_FORMS, createStateMachine };

// ── Vendor robot gallery: browse an extracted Unity pack (git-ignored) via
// public/vendor/manifest.json (see tools/build-vendor-manifest.mjs). The packs
// split mesh (base .fbx) from each animation (@clip.fbx = skeleton + one clip),
// so we load the mesh once and retarget a clip onto it by bone name. Textures are
// PSD→PNG (converted with sips). Silently skipped on a clone without the pack. ──
let vendorModel: any = null;
let vendorAnimator: any = null;
let vendorRoot: any = null;   // root-motion extractor for the current model
let vendorChar: any = null;   // Rapier capsule character (move-and-slide)
let vendorDispose: (() => void) | null = null;
let vendorClip = '';          // current clip name (drives locomotion)
let vendorGroundY = 0;        // feet-on-floor y for the current model
let walkAngle = 0;            // phase along the scripted walk circle
const WALK_R = 0.9;           // radius of the wander circle
const vendorCenter = new THREE.Vector2(-1.7, 2.0 - WALK_R); // so home sits on the circle
const vendorHome = new THREE.Vector3(vendorCenter.x, 0, vendorCenter.y + WALK_R);
const vendorOpts = { rootMotion: false, wander: false, drive: false };  // root motion; AI wander; WASD drive
let vendorWander: any = null;   // wander state machine (built per robot when enabled)
let vendorDrive: any = null;    // drive locomotion FSM (Idle/Walk/Run/Jump)
const driveCtx = { speed: 0, grounded: true, play: (_n: string) => {} };
const input = createInput();

// Load a robot mesh: textured material, normalized scale, animator + the loop
// hooks (animator update + locomotion). Reused on robot change.
async function loadVendorRobot(entry: any) {
  if (vendorDispose) { vendorDispose(); vendorDispose = null; }
  if (vendorChar) { vendorChar.dispose(); vendorChar = null; }
  if (vendorModel) { scene.remove(vendorModel); vendorModel = null; vendorAnimator = null; }

  const { scene: model } = await assets.loadModel(encodeURI(entry.mesh), { type: 'fbx' });
  const map = entry.texture ? await assets.loadTexture(encodeURI(entry.texture)) : null;
  const emissive = entry.emission ? await assets.loadTexture(encodeURI(entry.emission)) : null;
  model.traverse((o: any) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.material = new THREE.MeshStandardMaterial({
      map, color: map ? 0xffffff : 0x9fb4c8,
      emissiveMap: emissive, emissive: emissive ? 0xffffff : 0x000000, emissiveIntensity: emissive ? 1.0 : 0,
      metalness: 0.2, roughness: 0.7,
    });
  });
  let box = new THREE.Box3().setFromObject(model);
  model.scale.setScalar(1.8 / (box.getSize(new THREE.Vector3()).y || 1));
  box = new THREE.Box3().setFromObject(model);
  vendorGroundY = -box.min.y;
  walkAngle = 0;
  model.position.set(vendorCenter.x, vendorGroundY, vendorCenter.y + WALK_R);
  model.rotation.y = 0.5;
  scene.add(model);
  vendorModel = model;
  vendorAnimator = createAnimator(model);
  // root motion fills its `delta` but doesn't move the model — the capsule does.
  vendorRoot = createRootMotion(model, { getTime: () => vendorAnimator.currentAction?.time ?? 0, applyToTarget: false });
  vendorChar = physics.addCharacter(model, { radius: 0.4, half: 0.5, feetOffset: vendorGroundY });
  vendorHome.set(vendorCenter.x, vendorGroundY, vendorCenter.y + WALK_R);
  window.threej.vendorRobot = model;

  vendorDispose = loop.onFrame((_t, dt) => {
    vendorAnimator.update(dt);

    // ── Drive (WASD/space): you control it — input → capsule, FSM picks clips ──
    if (vendorOpts.drive) {
      const a = input.axis();
      const running = input.down('ShiftLeft') || input.down('ShiftRight');
      const sp = a.len * (running ? 5.5 : 3.0);
      if (input.consume('Space')) vendorChar.jump();
      const r = vendorChar.move(a.x * sp * dt, a.y * sp * dt, dt);
      if (a.len > 0.05) model.rotation.y = Math.atan2(a.x, a.y);   // face movement
      driveCtx.speed = a.len * (running ? 1.6 : 1);
      driveCtx.grounded = r.grounded;
      vendorDrive?.update(dt);
      return;
    }

    if (vendorOpts.wander && vendorWander) vendorWander.update(dt);   // AI picks clips

    // Compute this frame's desired horizontal step from the active clip...
    let dx = 0, dz = 0;
    if (vendorOpts.rootMotion && /w root/i.test(vendorClip)) {
      const d = vendorRoot.apply();                        // animation-driven
      dx = d.x; dz = d.z;
    } else if (/walk|run/i.test(vendorClip)) {             // scripted circular wander
      const speed = /run/i.test(vendorClip) ? 1.3 : 0.65;
      walkAngle += (speed / WALK_R) * dt;
      dx = vendorCenter.x + Math.sin(walkAngle) * WALK_R - model.position.x;
      dz = vendorCenter.y + Math.cos(walkAngle) * WALK_R - model.position.z;
      model.rotation.y = walkAngle + Math.PI / 2;          // face along the path
    }

    // ...then route it through the capsule (collides with walls, shoves crates).
    vendorChar.move(dx, dz, dt);
    if (model.position.distanceTo(vendorHome) > 3) { vendorChar.teleport(vendorHome.x, vendorHome.z); vendorRoot.reset(); }
  });
}

// Crossfade to a clip on the current robot (loading + caching its FBX on demand).
async function setVendorClip(entry: any, name: string) {
  if (!vendorAnimator) return;
  const info = entry.animations.find((a: any) => a.name === name) ?? entry.animations[0];
  if (!info) return;
  if (!vendorAnimator.has(info.name)) {
    const a = await assets.loadModel(encodeURI(info.file), { type: 'fbx', clone: false });
    const clip = a.animations?.[0];
    if (clip) { clip.name = info.name; vendorAnimator.add(info.name, clip); }
  }
  vendorClip = info.name;
  vendorAnimator.play(info.name, { fade: 0.35 });
  vendorRoot?.reset();          // re-prime root motion for the new clip
  vendorChar?.teleport(vendorHome.x, vendorHome.z);   // start each clip from home
}

(async () => {
  const manifest = await fetch('/vendor/manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!manifest?.robots?.length) { console.info('[vendor] no manifest — picker disabled (no pack extracted)'); return; }

  const names = manifest.robots.map((r: any) => r.name);
  const pick = { robot: names.includes('Nose Robot') ? 'Nose Robot' : names[0], animation: 'Idle' };
  const entryFor = (n: string) => manifest.robots.find((r: any) => r.name === n);
  const animsFor = (n: string) => entryFor(n).animations.map((a: any) => a.name);
  if (!animsFor(pick.robot).includes('Idle')) pick.animation = animsFor(pick.robot)[0];

  // Resolve clip names per robot (they vary slightly across the pack).
  const playVendor = (n: string) => setVendorClip(entryFor(pick.robot), n);
  const clipFor = (re: RegExp, also?: RegExp) => {
    const anims = animsFor(pick.robot);
    return (also && anims.find((n: string) => re.test(n) && also.test(n))) || anims.find((n: string) => re.test(n)) || anims[0];
  };

  // A wander AI: Idle (pause) ↔ Walk (move) on random timers, via the FSM.
  function buildWander() {
    const idle = clipFor(/idle/i);
    const walk = clipFor(/walk/i, /in place/i);
    return createStateMachine({
      initial: 'Idle',
      states: {
        Idle: { enter: (c: any) => { c.play(idle); c.dur = 1.2 + Math.random() * 2; }, transitions: [{ to: 'Walk', when: (c: any, t: number) => t > c.dur }] },
        Walk: { enter: (c: any) => { c.play(walk); c.dur = 2 + Math.random() * 2.5; }, transitions: [{ to: 'Idle', when: (c: any, t: number) => t > c.dur }] },
      },
    }, { play: playVendor });
  }

  // Drive FSM: Idle ↔ Walk ↔ Run by speed, Jump when airborne. Reads driveCtx
  // (speed/grounded updated in the loop from input + the capsule).
  function buildDrive() {
    const idle = clipFor(/idle/i);
    const walk = clipFor(/walk/i, /in place/i);
    const run = clipFor(/run/i, /in place/i);
    const jump = clipFor(/jump/i, /in place/i);
    const air = [{ to: 'Jump', when: (c: any) => !c.grounded }];
    driveCtx.play = playVendor;
    return createStateMachine({
      initial: 'Idle',
      states: {
        Idle: { enter: (c: any) => c.play(idle), transitions: [...air, { to: 'Walk', when: (c: any) => c.speed > 0.05 }] },
        Walk: { enter: (c: any) => c.play(walk), transitions: [...air, { to: 'Run', when: (c: any) => c.speed > 1.05 }, { to: 'Idle', when: (c: any) => c.speed <= 0.05 }] },
        Run:  { enter: (c: any) => c.play(run),  transitions: [...air, { to: 'Walk', when: (c: any) => c.speed <= 1.05 }] },
        Jump: { enter: (c: any) => c.play(jump), transitions: [{ to: 'Walk', when: (c: any) => c.grounded && c.speed > 0.05 }, { to: 'Idle', when: (c: any) => c.grounded }] },
      },
    }, driveCtx);
  }

  const folder = gui.addFolder('Vendor Robot');
  folder.add(pick, 'robot', names).name('Robot').onChange(async () => {
    const anims = animsFor(pick.robot);
    pick.animation = anims.includes('Idle') ? 'Idle' : anims[0];
    animCtrl = animCtrl.options(anims).name('Animation').onChange(() => setVendorClip(entryFor(pick.robot), pick.animation));
    await loadVendorRobot(entryFor(pick.robot));
    if (vendorOpts.drive) vendorDrive = buildDrive();
    else if (vendorOpts.wander) vendorWander = buildWander();
    else setVendorClip(entryFor(pick.robot), pick.animation);
  });
  let animCtrl = folder.add(pick, 'animation', animsFor(pick.robot)).name('Animation')
    .onChange(() => setVendorClip(entryFor(pick.robot), pick.animation));
  folder.add(vendorOpts, 'rootMotion').name('Root motion (W Root clips)')
    .onChange(() => { vendorRoot?.reset(); vendorChar?.teleport(vendorHome.x, vendorHome.z); });
  const wanderCtrl = folder.add(vendorOpts, 'wander').name('Wander (AI)')
    .onChange(() => {
      if (vendorOpts.wander) { vendorOpts.drive = false; driveCtrl.updateDisplay(); vendorDrive = null; }
      vendorWander = vendorOpts.wander ? buildWander() : null;
      if (!vendorOpts.wander) setVendorClip(entryFor(pick.robot), pick.animation);
    });
  const driveCtrl = folder.add(vendorOpts, 'drive').name('Drive (WASD/Space)')
    .onChange(() => {
      if (vendorOpts.drive) { vendorOpts.wander = false; wanderCtrl.updateDisplay(); vendorWander = null; vendorChar?.teleport(vendorHome.x, vendorHome.z); vendorDrive = buildDrive(); }
      else { vendorDrive = null; setVendorClip(entryFor(pick.robot), pick.animation); }
    });

  await loadVendorRobot(entryFor(pick.robot));
  await setVendorClip(entryFor(pick.robot), pick.animation);
  // dev/test hooks
  window.threej.vendorSetClip = (n: string) => setVendorClip(entryFor(pick.robot), n);
  window.threej.vendorRootMotion = (on: boolean) => { vendorOpts.rootMotion = on; vendorRoot?.reset(); vendorChar?.teleport(vendorHome.x, vendorHome.z); };
  window.threej.vendorWander = (on: boolean) => { vendorOpts.wander = on; vendorWander = on ? buildWander() : null; };
  window.threej.vendorChar = () => vendorChar;
  window.threej.vendorDrive = (on: boolean) => { vendorOpts.drive = on; vendorOpts.wander = false; vendorWander = null; driveCtrl.updateDisplay(); wanderCtrl.updateDisplay(); vendorDrive = on ? buildDrive() : null; if (!on) setVendorClip(entryFor(pick.robot), pick.animation); };
  window.threej.vendorDriveState = () => vendorDrive?.state ?? null;
  window.threej.vendorWanderState = () => vendorWander?.state ?? null;
  window.threej.vendorRobotNames = names;
  console.info(`[vendor] gallery ready — ${manifest.robots.length} robots, crossfade + locomotion`);
})();
