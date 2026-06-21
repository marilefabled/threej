# threej — Engine Notes & Roadmap

> **This is a living document. Read it before working on this repo, and update it
> whenever you add or change something meaningful.** It is the source of truth for
> how this project is built and where it's going. See the *Update protocol* at the
> bottom — keeping this current is part of every change, not an afterthought.

**Last updated:** 2026-06-20 (after pool / raycast / spatial audio)

---

## 1. What this is

`threej` started as a single-file Three.js robot demo. We are deliberately growing
it into a **small reusable real-time 3D engine** — not a throwaway project stitched
together. The robot/jail scene is the *content*; the reusable scaffolding under
`src/engine/` is the *engine* and is meant to be lifted into other projects.

Every change should ask: *"Is this a reusable engine capability, project-specific
content, or glue?"* and live in the right place.

---

## 2. Principles

- **Modular, three layers:**
  - `src/engine/` — generic, reusable, knows nothing about robots or ghosts.
  - `src/robot/`, `src/jail/` — project content (the figure, animations, themes,
    ghosts, locations).
  - `src/main.js` + `src/ui.js` — glue / composition root. Wires engine + content
    together; owns no reusable logic.
- **Vite + TypeScript.** Graduated from no-build/CDN once we added npm libs
  (Rapier WASM) and wanted type safety. `npm install` then `npm run dev`. Imports
  use `.js` specifiers that Vite resolves to the `.ts` files. `tsconfig` is lenient
  to start (strict off) and tightened incrementally; `npm run typecheck` stays at 0
  errors. (History: the project began as a single no-build HTML file — that era is
  preserved in the early changelog.)
- **Efficiency is a feature, not an afterthought:**
  - Clamp frame delta (no time-jumps after a backgrounded tab).
  - No per-frame allocations on the hot path (index iteration, not fresh iterators).
  - Share materials across meshes (one `M.body`, etc.) — themes recolor one object,
    and the GPU batches better.
  - Dispose geometries when swapping meshes (part variants) to avoid GPU leaks.
- **Fixed skeleton + swappable variants.** Animatable structure (pivots) stays
  constant; only visual meshes swap. This pattern lets content vary wildly without
  breaking the systems that drive it (animations, theming).
- **Registries over hardcoding.** Animations, themes, locations, ghost forms, part
  variants, and frame callbacks are all data/maps the UI is generated from. Adding
  one is a one-place edit.
- **Verify in the browser, commit clean.** Screenshot-verify changes; squash the
  auto-commit hook's noise into one meaningful commit before pushing (see Gotchas).

---

## 3. Architecture at a glance

```
package.json          deps + scripts (dev/build/preview/typecheck/unpack)
vite.config.ts        Vite config (honors PORT; excludes rapier from pre-bundle)
tsconfig.json         TypeScript (bundler resolution, lenient)
index.html            markup + <script type=module src=/src/main.ts>
styles.css            all UI styling
src/
  main.ts             composition root — builds the world, wires UI, registers frame callbacks
  ui.ts               robot button/swatch DOM wiring (no Three.js knowledge)
  dialogueUI.ts       wires engine/dialogue.ts to the #dialogue box (presentation)
  types/global.d.ts   ambient globals (window.threej)
  engine/             ♻ REUSABLE — copy into any project
    scene.ts            renderer · camera · OrbitControls · resize
    lighting.ts         ambient · sun (shadows) · fill · rim lights · ground bounce
    environment.ts      floor · two-layer grid · glow disc · ground ring
    cameraZoom.ts       one-shot "fly to a target, hold, return" camera move
    followCamera.ts     third-person follow cam: trails a target, damped, aims above it
    particles.ts        one-Points pool, soft procedural sprites; burst/stream/update
    level.ts            data-driven level loader: factories + triggers + spawn; load/unload
    hud.ts              HUD overlay: screen-anchored text/bars + world-anchored markers
    save.ts             localStorage save slots: capture/apply + versioning + list
    bloom.ts            UnrealBloom post-processing (EffectComposer)
    loop.ts             render-loop registry: onFrame(t, dt) + setRender, clamped dt
    assets.ts           GLTF/FBX/OBJ/texture loader (deduped, lazy, skinning-safe clone)
    state.ts            URL-hash build codes: encode/decode + createUrlState
    physics.ts          Rapier (WASM) wrapper: world, ground, addDynamic, step+sync
    audio.ts            Howler wrapper + procedural WAV generator (no asset files)
    ecs.ts              miniplex World + a frame-system registry
    animator.ts         AnimationMixer crossfade controller (named clips, play(name))
    rootMotion.ts       extract planar root-bone displacement → move the character
    stateMachine.ts     tiny FSM (states + transitions) — drives the animator
    blendSpace.ts       1D animation blend ("blend tree"): set(x) weights clips
    input.ts            keyboard + gamepad: axis(), down(code), consume(code)
    dialogue.ts         Ink (inkjs) wrapper: lines/choices/variables, presentation-agnostic
    cutscene.ts         GSAP-backed director: async script of awaitable engine actions
    trigger.ts          flat (XZ) volume zone: update(point) fires onEnter/onExit
    sceneManager.ts     named scenes + cross-fade transitions; boot-reveal + go(name)
    events.ts           typed pub/sub bus: on/once/off/emit/clear/count
    timer.ts            game-loop timers: after/every/tween; pauses with the loop
    shake.ts            trauma-model camera shake: addTrauma(0..1), decays each frame
    pool.ts             generic object pool: acquire/release; zero GC on the hot path
    raycast.ts          click-on-3D: pick/pickAll/pickNDC/onClick/onHover + drag guard
    debugPanel.ts       lil-gui panel + composable bloom/light control helpers
    easing.ts           easing helpers
  robot/              the figure (content)
    robot.ts            fixed skeleton + swappable part variants → rig + parts API
    animations.ts       9 pose fns (rig, t) + ANIM_COLORS + ZOOM_TARGETS
    themes.ts           6 themes + applyTheme()
  jail/               ghost + location graphics (ported from GhostJail3D)
    ghostMesh.ts        8 procedural ghost forms + float/glow/blink
    locationBuilder.ts  9 prison locations from primitives
    jailScene.ts        active location + ghosts + period/mood light + GSAP transitions
tools/                node-side utilities (run with `node`, not in the browser)
    unpack-unitypackage.mjs   lift assets out of .unitypackage files (no Unity, no deps)
    build-vendor-manifest.mjs scan public/vendor/ → manifest.json for the in-app picker
```

**Composition flow (`main.ts`):** `createScene()` → `addLighting()` /
`addEnvironment()` → `buildRobot()` → mood light → `createBloom()` →
`await createPhysics()` + `createAudio()` + `createECS()` → `createJail()` →
`createSceneManager()` + scene registration → theme/UI wiring → `createLoop()`
registers frame callbacks + render → `loop.start()` → `scenes.go('title')`.
The render loop runs (in order): robot pose · ghosts · `physics.step` · `ecs.update`
· lights · camera zoom · `sceneManager.update` · `bloom.render()`.

---

## 4. Engine module catalog (the reusable API)

Each is framework-free Three.js and has no dependency on robot/jail content.

| Module | Entry | Returns / shape |
|---|---|---|
| `scene.ts` | `createScene({ fov, cameraPos, target, background, fog })` | `{ renderer, scene, camera, controls, BASE_CAM }` (+ wires resize) |
| `lighting.ts` | `addLighting(scene)` | `{ ambient, sun, fill, rimL, rimR, bounce }` |
| `environment.ts` | `addEnvironment(scene)` | `{ floor, gridFine, gridCoarse, glowDisc, groundRing }` |
| `cameraZoom.ts` | `createCameraZoom(camera, controls, { base, lookAt, zoomIn, hold, zoomOut })` | `{ trigger(targetVec3), update(dt, applyLookAt) }` |
| `followCamera.ts` | `createFollowCamera(camera, { target, offset, lookHeight, stiffness, rotateWithTarget, obstacles })` | `{ update(dt), snap(), enabled, setTarget(t), target, stiffness, offset }` |
| `particles.ts` | `createParticles(scene, { max, gravity, drag, blending, sizeScale })` | `{ burst(origin, n, opts), stream(origin, dt, rate, opts), update(dt), dispose(), points, count }` |
| `level.ts` | `createLevelLoader(scene, { factories, onTrigger })` | `{ load(data), unload(), update(point), registry, current, spawn }` |
| `hud.ts` | `createHUD(camera, { root, className })` | `{ text(opts), bar(opts), marker(worldPos, opts), update(), layer, dispose() }` |
| `save.ts` | `createSaveSystem({ key, version, capture, apply, storage })` | `{ save(slot), load(slot), has, remove, list(), exportSlot, importSlot }` |
| `bloom.ts` | `createBloom(renderer, scene, camera, { strength, radius, threshold })` | `{ composer, bloomPass, render(), setSize(w, h) }` |
| `loop.ts` | `createLoop(renderer, { maxDelta })` | `{ onFrame((t,dt)=>…)→disposer, setRender(fn), start, stop, elapsed, running }` |
| `assets.ts` | `createAssets({ basePath, onProgress, onLoad, onError })` | `{ loadGLTF, loadModel, loadTexture, loadAll, enableDraco, manager, clear }` |
| `state.ts` | `createUrlState({ debounce })` · `encodeState(obj)` · `decodeState(str)` | `{ read(), write(obj), encode, decode }` |
| `physics.ts` | `await createPhysics({ gravity })` | `{ world, step(dt), addGround, addStaticBox, addDynamic(mesh,shape,{link}), addCharacter(mesh,{radius,half}), remove, links }` |
| `audio.ts` | `createAudio({ volume })` · `toneWav(params)` | `{ load, tone, play, play3D, setListener, setVolume, mute, sounds, Howler }` |
| `ecs.ts` | `createECS()` | `{ world, system(fn), update(dt, t) }` (miniplex `world`) |
| `animator.ts` | `createAnimator(root)` | `{ add(name, clip), play(name, {fade,loop,timeScale}), update(dt), has, stop, current, currentAction }` |
| `rootMotion.ts` | `createRootMotion(target, { bone, getTime })` | `{ apply(), reset(), bone }` |
| `stateMachine.ts` | `createStateMachine(spec, ctx)` | `{ update(dt), set(name), state, time, ctx }` |
| `blendSpace.ts` | `createBlend1D(mixer, stops, { syncPhase })` | `{ set(x), setMaster(w), master, items }` |
| `input.ts` | `createInput({ target, deadzone })` | `{ axis(), down(code), consume(code), gamepadPressed(b), dispose }` |
| `dialogue.ts` | `compileInk(src)` · `createDialogue(story)` | `{ onUpdate(fn), start(knot), advance(), choose(i), run(knot), cancel(), command(name,fn), variable, active }` |
| `cutscene.ts` | `createDirector(extras)` | `{ play(asyncScript), skip(), cx, active }` |
| `trigger.ts` | `createTrigger({ position, radius, once, onEnter, onExit })` | `{ update(point), reset(), inside, position, radius }` |
| `sceneManager.ts` | `createSceneManager({ transition: { duration, color } })` | `{ register(name, def), go(name, opts?), update(dt,t), dispose(), current, busy }` |
| `events.ts` | `createEvents<Schema>()` | `{ on(name, fn)→unsub, once(name, fn)→unsub, off(name, fn), emit(name, payload?), clear(name?), count(name?) }` |
| `timer.ts` | `createTimers()` | `{ after(s, fn)→handle, every(s, fn, {times?})→handle, tween(s, fn(p), {ease?,onComplete?})→handle, cancel(h), cancelAll(), update(dt), pending }` |
| `shake.ts` | `createShake(camera, { maxOffset, maxRoll, traumaDecay })` | `{ addTrauma(amount), update(dt), reset(), trauma, enabled }` |
| `pool.ts` | `createPool<T>(factory, { size, reset, warn })` | `{ acquire()→T, release(obj), releaseAll(), forEach(fn), active, available, size }` |
| `raycast.ts` | `createRaycaster(camera, renderer)` | `{ pick(e, objects, opts?)→hit\|null, pickAll, pickNDC, onClick(objects, fn, opts?)→off, onHover(objects, fn, opts?)→off, raycaster }` |
| `debugPanel.ts` | `createDebugPanel({ title, closed })` · `addBloomControls(gui, bloom, renderer)` · `addLightControls(gui, lights)` | a lil-gui `GUI` + folders |
| `easing.ts` | `easeInOut(t)` | number |

**Notes for reuse:**
- `bloom.js`: when rendering through the composer, leave `renderer.outputColorSpace`
  at default — `OutputPass` does the sRGB conversion (don't double-convert).
- `loop.js`: `setRender` runs once after all `onFrame` callbacks. `dt` is clamped;
  `t` is accumulated (monotonic, pause-safe), **not** wall-clock.
- `assets.js`: Promise-based + URL-deduped (failed loads evict so retries work).
  `loadModel` dispatches by extension (`.glb/.gltf`, `.fbx`, `.obj`) or a `type`
  override and returns `{ scene, animations }` — `scene` is a **skinning-safe
  clone** (so the same asset can be instanced; uses lazily-imported SkeletonUtils),
  shadows enabled. `loadTexture` handles `.tga` (and the usual web formats). FBX,
  OBJ, TGA, DRACO loaders and the clone util are all lazy-imported — zero cost
  until used. Animating a rigged model:
  ```js
  const { scene, animations } = await assets.loadModel('character.glb');
  root.add(scene);
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(animations[0]).play();
  loop.onFrame((t, dt) => mixer.update(dt));
  ```
- `state.js` is generic — it serializes any flat `{ key: string|number }`. The app
  owns the schema: `currentConfig()` reads the live look, `applyConfig()` applies a
  decoded one. `write()` is debounced `replaceState` (no history spam, no reload);
  `read()` parses `location.hash`. In `main.js` every control calls `syncUrl()` on
  change, and `applyConfig(urlState.read())` runs once at boot. Guard re-entrancy
  with an `applying` flag so applying a code doesn't write back mid-load.
- `physics.ts` (Rapier): `await createPhysics()` (WASM init). `addDynamic(mesh,
  shape, { link })` links a mesh to a body — `link:false` lets something else
  (e.g. ECS) own the sync. `step(dt)` clamps the timestep so a stall can't explode
  the integrator. Match `addGround(y)` to your visible floor's y. `addStaticBox`
  makes invisible walls. `addCharacter(mesh, { radius, half })` is a capsule on
  Rapier's KinematicCharacterController: `move(dx, dz)` does move-and-slide
  (blocked by static colliders, shoves dynamic ones via
  `setApplyImpulsesToDynamicBodies`) and follows the mesh. The vendor bot routes
  its locomotion (root motion or scripted) through it — so it collides with the
  cell walls and pushes dropped crates.
- `audio.ts` (Howler): a named sound registry + `toneWav()` so you can ship
  **without audio files** (synthesize blips/thuds). `play()` needs a user gesture
  (browser autoplay policy) — fine when triggered from clicks.
- `animator.ts`: a crossfade layer over `AnimationMixer`. `add(name, clip)` then
  `play(name, { fade })` fades from the current action to the next (the base of a
  state machine). The vendor gallery uses it: switching the Animation dropdown
  crossfades on the same model.
- `rootMotion.ts`: drives the character FROM the animation. Each frame it reads the
  root bone's local horizontal delta, converts it through the bone parent's world
  rotation+scale (unit/orientation correct), adds it to the target's world
  position, and pins the bone's horizontal back so the mesh doesn't double-move.
  Loop wrap is detected via `getTime()` decreasing — so it's unit-independent (no
  magnitude threshold). The vendor "Root motion" toggle uses it for `W Root` clips;
  otherwise a scripted circle. Next: a state machine (Idle↔Walk↔Run) + a Rapier
  capsule so the vendor bot collides.
- `dialogue.ts` (Ink): wraps inkjs and owns story logic only — `onUpdate(s)` emits
  `{ speaker, text, tags, choices }` (or `null` at end); render it however (we use
  a DOM box, `dialogueUI.ts`). `advance()` for a line, `choose(i)` for a branch,
  `run(knot)` resolves at the end (await it in a cutscene), `variable.get/set`.
  Authoring convention: write `"Speaker: text"` and the speaker is split out.
  `compileInk()` compiles `.ink` at runtime (dev); ship precompiled JSON to drop
  the heavier `inkjs/full` compiler. **Tag-driven actions:** register
  `dialogue.command('anim', (arg) => …)` and tag a line `#anim:wave` — the handler
  fires as the line shows (multiple tags per line all fire). The demo registers
  `anim` (robot plays a clip) and `look` (`#look:warden` punches the camera to a
  named framing by reusing `cameraZoom.trigger`; no-op during a cutscene, which owns
  the camera). The DOM presentation (`dialogueUI.ts`) reveals text with a
  typewriter; first click completes the reveal, the next advances.
  **Conditional choices** are pure Ink — `* { talked } [ … ]` only shows when the
  variable holds; the runtime filters them, so nothing extra is needed app-side.
  Variables persist across knots in one `Story`, so a later scene can react to an
  earlier one (the yard inmate's choices change based on whether you talked).
- `cutscene.ts`: a director where a cutscene is an async script —
  `play(async (cx) => { await cx.to(camera.position, {...}); await cx.say('knot'); })`.
  `cx` gives GSAP-backed awaitables (`to`, `wait`, `parallel`) + `say` (runs the
  dialogue); pass domain objects via `createDirector({ camera, dialogue })`. While
  `director.active`, the main loop hands the camera over (skips `zoom.update`).
  `skip()` kills tweens and resolves pending awaits so the script finishes at once.
- `trigger.ts`: a flat XZ zone — `update(point)` each frame fires `onEnter`/`onExit`
  on the edges (`once` latches). Reusable for NPC talk zones, doors, checkpoints,
  hazards. The vendor drive demo puts an NPC ring on the floor; driving into it
  brightens the ring and shows a "press E to talk" prompt — pressing E starts the
  conversation (drive holds still while `dialogue.active`).
- `followCamera.ts`: a third-person camera that trails a `target` with frame-rate-
  independent damping (`1 - exp(-stiffness·dt)`) and aims `lookHeight` above it.
  `rotateWithTarget` swings it behind as the target turns; `snap()` teleports on
  enable (no swoop); pass `obstacles` for raycast wall pull-in. **Camera ownership
  is a strict hierarchy** (one driver at a time): cutscene **director** > **follow
  cam** > one-shot **zoom**/OrbitControls. The render loop picks the active owner
  (`if director.active → return; else if followCam.enabled → follow.update; else
  zoom.update`), and `#look` tags no-op unless zoom owns the camera. Enabling follow
  sets `controls.enabled = false`; the vendor "Follow cam" toggle (auto-on with
  Drive) flips it back on release.
- `particles.ts`: one `THREE.Points` pool (one draw call), soft round sprites drawn
  *procedurally* in the fragment shader (no texture). CPU integrates pos/vel/life and
  recycles a ring buffer; colour + size are per-particle so one system covers many
  looks. `burst(origin, n, opts)` for one-shots, `stream(origin, dt, rate, opts)` for
  continuous. The drive demo kicks up dust on footfalls/jump/land at the feet; the
  "VFX" GUI folder has Sparkle/Poof bursts. Additive blending feeds the bloom pass.
- `level.ts`: instantiates a scene from a plain data object — `objects` (each a
  `type` resolved against a factory registry: built-in `box`/`sphere`/`light`/
  `marker` + app-registered ones), `triggers` (flat zones reusing `trigger.ts`,
  fire `onTrigger(t, edge)`), and a `spawn`. `load(data)` tracks everything;
  `unload()`/swapping tears it down. A factory returns an `Object3D` *or* `{ object,
  dispose }` when it owns extra resources — the demo `crate` factory adds a matching
  static physics collider and disposes it on unload (so swapping levels doesn't leak
  colliders). `src/levels.ts` holds demo levels; the "Level" GUI folder swaps them.
- `hud.ts`: a full-screen DOM overlay above the canvas with two element kinds —
  **screen-anchored** `text()`/`bar()` (pinned to a corner/edge/centre via an anchor
  string) and **world-anchored** `marker(worldPos)` that projects to screen every
  `update()` (nameplates, quest markers, floating numbers; auto-hides behind the
  camera). Styling is CSS (`.hud-text`/`.hud-bar`/`.hud-marker`). The demo shows a
  Stamina meter (drains while sprinting in drive) and a "UNIT-07" nameplate over the
  driven robot.
- `save.ts`: named save slots in `localStorage`. State-agnostic — you give it
  `capture()` (return a JSON-serializable snapshot) and `apply(state, meta)`; it owns
  slots, `version`, timestamps, `list()` (newest first), and import/export of the raw
  JSON. Complements `state.ts` (which encodes state into the URL for *sharing*); this
  *persists* across reloads. The demo captures the scene config (reusing
  `currentConfig`) + the active level + the driven robot's pose, and a "Save / Load"
  GUI folder writes/reads slot `slot1` with a HUD toast for feedback.
- `input.ts`: `axis()` gives a movement vector from WASD/arrows + the gamepad left
  stick (deadzoned, clamped to unit). `down(code)` is held-state; `consume(code)`
  is a one-shot edge read for actions (jump on Space). The full character-control
  stack the vendor "Drive (WASD/Space)" toggle assembles:
  **clip → `animator` (crossfade) → `stateMachine` (Idle/Walk/Run/Jump) →
  `input`/`rootMotion` → `physics.addCharacter` (gravity + move-and-slide + jump)
  → world.** `addCharacter().move(dx, dz, dt)` integrates gravity (snap-to-ground
  off while ascending) and returns `{ grounded, vy }`; `jump()` adds vertical
  velocity when grounded.
- `blendSpace.ts`: a 1D blend tree over the mixer. Place clips at parameter values
  (`Idle@0, Walk@1, Run@2`); `set(x)` weights the two bracketing clips so motion
  blends continuously (no threshold pop). `setMaster(w)` scales the whole blend —
  the drive mode fades it out and a jump clip in while airborne. `syncPhase` lines
  the active clips' footfalls up so walk↔run doesn't slide. Pairs with
  `stateMachine` (locomotion blend tree *inside* a movement state).
- `stateMachine.ts`: a generic FSM — states with `enter/exit/update` hooks and
  `transitions: [{ to, when(ctx, timeInState) }]`. `update(dt)` runs the current
  state then takes the first satisfied transition. A shared `ctx` carries inputs +
  the animator. The vendor "Wander (AI)" toggle uses it (Idle↔Walk on random
  timers); pair it with `animator` for Idle↔Walk↔Run character control.
- `ecs.ts` (miniplex): `world.add({...components})`, query with
  `world.with('a','b')`, `system((world, dt, t) => …)`, drive with
  `ecs.update(dt, t)` from the loop. The demo's dropped props are entities
  `{ mesh, body, ttl }` with a sync system (mesh ← body) and a ttl despawn system.
  Iterate a snapshot (`[...world.with('ttl')]`) when removing during iteration.
- `events.ts`: a typed pub/sub bus. Define an event schema for your game —
  `type GameEvents = { 'player:died': { score: number }; 'level:change': { name: string } }`
  — then `createEvents<GameEvents>()` gives fully typed `emit`/`on`/`once`. Without
  the generic, payloads are `any`. `on()` returns an unsubscribe function (no string
  token needed). Handlers that throw are caught and logged so they don't block other
  listeners. `once()` is self-removing, race-safe (fires at most once even under
  concurrent calls). Use this to decouple scenes, systems, and UI: the HUD listens
  for `'player:died'` without knowing about the physics system; the scene manager
  listens for `'level:complete'` without knowing about the game loop.
- `timer.ts`: game-loop-integrated timers that run on the loop's accumulated `dt`.
  Unlike `setTimeout` or GSAP, they pause automatically when the loop stops (tab
  hidden, scene paused). `after(s, fn)` fires once; `every(s, fn, { times })` fires
  repeatedly (forever or N times); `tween(s, fn(progress), { ease, onComplete })`
  drives a 0→1 progress value over `s` seconds — wire it to a health bar, fade,
  or lerp. Every call returns a `{ cancel(), active }` handle. The `while`-loop in
  `every` handles large `dt` spikes (fires each missed interval) without exploding,
  thanks to `loop.ts` clamping dt at 0.1 s. Pairs naturally with `events` and
  `shake` (`timer.after(0.5, () => shake.addTrauma(0.6))`). Used in the demo to
  drive the HUD save toast and the "escalating shakes" VFX demo.
- `shake.ts`: trauma-model camera shake (Jan Bitters, *Game Feel*). `addTrauma(0..1)`
  accumulates; multiple hits sum naturally (capped at 1). Each frame trauma decays at
  `traumaDecay` units/sec; the actual displacement is `trauma²` (squared = punchy
  onset, fast trailing-off). Offset is applied in camera-local space (right + up axes
  via `camera.quaternion`, zero per-frame allocation), plus a roll offset on
  `camera.rotation.z`. Since `lookAt` resets roll to ~0 each frame, roll accumulation
  naturally clears. **Call `shake.update(dt)` LAST** in your camera frame callback —
  after OrbitControls / followCam / zoom have positioned the camera. `reset()` zeros
  trauma instantly (use on scene transitions so shake doesn't carry across). Trauma
  guide: 0.15–0.25 subtle · 0.3–0.45 medium · 0.5–0.7 strong · 0.75–1.0 maximum.
- `sceneManager.ts`: named scenes with async lifecycle hooks — `enter(prev)`,
  `update(dt, t)`, `exit(next)`. `go(name)` cross-fades: a full-screen DOM overlay
  fades to the transition color (default `#000`), the outgoing `exit` runs, the
  incoming `enter` runs, then it fades back out. The overlay starts at `opacity:1`
  so the very first `go()` is a "boot reveal" (no preceding flash). Call
  `sceneManager.update(dt, t)` each frame (routes to the active scene's `update`).
  Register chainably: `sm.register('title', {...}).register('game', {...})`. Check
  `sm.busy` to skip redundant transitions (e.g. the title "click to start" guard).
  The demo uses a title scene (full-screen DOM overlay, blinking "PRESS ENTER",
  Enter/click starts) and a game scene (existing content). A "↩ Main menu" GUI
  button and `window.threej.scenes.go('title')` both return to the title.
- `pool.ts`: generic object pool for any `T`. `createPool(factory, { size, reset })`
  pre-warms `size` objects via `factory()` at startup (one allocation burst, then
  zero allocations on the hot path). `acquire()` returns a free object or grows
  with a console warning if exhausted. `release(obj)` calls your `reset()` (hide,
  remove from scene, zero velocity — whatever "blank slate" means for `T`) then
  returns it. `releaseAll()` returns everything at once (good for level-clear).
  `forEach(fn)` iterates all currently active objects — use this for per-frame
  updates instead of your own Set. Pairs with `timer.after` for auto-return:
  `timer.after(2, () => pool.release(bullet))`. Demo: 12 pre-allocated orb meshes,
  "Pool: orb burst" button in the VFX GUI fires 5 in a ring, each released after 1.5 s.
- `raycast.ts`: wraps `THREE.Raycaster` with mouse/pointer helpers and a drag-
  distance guard. `pick(e, objects, { recursive })` returns the closest
  `THREE.Intersection` or `null`. `pickAll` returns every hit. `pickNDC(x, y, objects)`
  picks from NDC coordinates — use this for crosshair / controller reticles (pass
  `0, 0` for screen centre). `onClick(objects | () => objects, fn, { recursive, maxDrag })`
  attaches a click listener to the renderer canvas; if the pointer moved more than
  `maxDrag` pixels (default 5) between mousedown and click, it skips the handler
  (orbit drags don't accidentally trigger picks). `onHover` does the same for
  `pointermove`. Both return cleanup functions. The demo wires `onClick([robot.rig],
  hit => { audio.play('blip'); shake.addTrauma(0.12); vfx.burst(hit.point, …) },
  { recursive: true })` — clicking any part of the static robot fires a tactile response.
- `audio.ts` (spatial audio): `play3D(name, pos, { rate, volume, refDistance,
  rolloffFactor })` plays a sound at a world-space `{x,y,z}` position — Howler sets
  up a Web Audio `PannerNode`. The sound attenuates with distance from the listener.
  `setListener(pos, forwardVec, upVec)` updates `Howler.pos()` / `Howler.orientation()`
  (the Web Audio `AudioListener`). Call it once per frame after positioning the camera:
  ```ts
  const fwd = new THREE.Vector3(), up = new THREE.Vector3()
  loop.onFrame(() => {
    fwd.set(0,0,-1).applyQuaternion(camera.quaternion)
    up.set(0,1,0).applyQuaternion(camera.quaternion)
    audio.setListener(camera.position, fwd, up)
  })
  ```
  Raise `refDistance` (default 1) for room-scale scenes where the default drop-off
  is too aggressive. Demo: physics prop `thud` is now `play3D` (panned from where
  it lands); the listener syncs to the camera each frame.
- `debugPanel.ts` helpers are composable — add only the folders a project needs,
  or call `gui.add(...)` directly for anything bespoke.

---

## 5. Reusable patterns (content too)

These live in `robot/` and `jail/` but are templates worth copying:

- **Skeleton + variants** (`robot.js`): build persistent pivot groups, then fill
  per-part container sub-groups from a `{ name: builder }` map. `set(part, name)`
  clears the container and rebuilds. *Keep kinematic anchors fixed* (elbow y=-0.45,
  knee y=-0.48, hand/foot y=-0.5) so animations still align.
- **Animation as `(rig, t) => void`** (`animations.js`): the loop calls
  `rig.reset()` then the current fn. Pure, data-driven, hot-swappable.
- **Shared-material theming** (`themes.js`): all meshes use a small set of shared
  materials; a theme just recolors those materials (+ ground + accent).
- **Generated UI from registries**: `LOCATIONS`, `THEMES`, `GHOST_FORMS`,
  `parts.options`, `ANIM_COLORS` drive their `<select>`/buttons/dropdowns. Add a
  datum, the control appears.

---

## 6. How to start a new project from the engine

**Option A — copy source** (simplest; get editable engine files):
1. `npm create vite@latest`, then copy `src/engine/`, `styles.css`, `tsconfig.json`.
2. `npm i three gsap lil-gui howler @dimforge/rapier3d-compat miniplex inkjs` (+ `-D
   @types/three @types/howler @types/node`).

**Option B — copy the built lib** (after `npm run build:lib` in this repo):
1. Copy `dist/engine/` into your new project (e.g. `src/engine/`).
2. Same `npm i` as above — deps are external (not bundled).

Either way, in `main.ts`:
```ts
const { renderer, scene, camera, controls, BASE_CAM } = createScene();
addLighting(scene); addEnvironment(scene);
const bloom = createBloom(renderer, scene, camera);
const loop = createLoop(renderer);
loop.onFrame((t, dt) => {/* update your content */});
loop.setRender(() => bloom.render());
loop.start();
```
Add your own content modules alongside, pulling in `createPhysics` / `createAudio` /
`createECS` as the game needs them.

**Build scripts:**
- `npm run dev` — Vite dev server (HMR).
- `npm run build` — production app bundle; splits Three / Rapier / GSAP / vendor into
  separate cacheable chunks. Requires `es2022` target (top-level await for Rapier).
- `npm run build:lib` — engine-only library build → `dist/engine/*.js` (one file per
  module, tree-shakable, all deps external). Use this to ship the engine to a new game.
- `npm run typecheck` — `tsc --noEmit`, must stay at 0 errors before committing.

(`vite.config.ts` reads `PORT` so a host can assign the port; it excludes `rapier3d-compat`
from the dep pre-bundle since its inlined WASM confuses the bundler.)

---

## 6b. Unity asset pipeline

A `.unitypackage` is just a **gzipped tar**; inside, each asset is a GUID folder
with `asset` (real bytes), `asset.meta` (Unity YAML), and `pathname` (original
project path). So we lift assets out without ever opening Unity.

```sh
# extract everything to extracted/<pkg>/Assets/...
node tools/unpack-unitypackage.mjs MyAsset.unitypackage
# inspect first / extract a subset
node tools/unpack-unitypackage.mjs MyAsset.unitypackage --list
node tools/unpack-unitypackage.mjs MyAsset.unitypackage --filter=fbx,png,tga
```

`tools/unpack-unitypackage.mjs` is zero-dependency (Node `zlib` + a tiny tar
parser). It restores original paths and flags which files are usable.

**What's portable into three.js** (load with `engine/assets.js`):
- **Models** `.fbx` `.obj` `.gltf/.glb` `.dae` → `assets.loadModel(...)`
- **Textures** `.png` `.jpg` `.tga` → `assets.loadTexture(...)`
- **Audio** `.wav` `.mp3` `.ogg`

**What is NOT** (extracted as-is, but Unity-renderer/GUID-specific — no auto
conversion): `.mat` materials, `.prefab`/`.unity` scenes, `.shader`/`.shadergraph`,
`.cs` scripts, `.controller`/`.anim` (Mecanim). Rebuild materials with three
materials; use the raw model + texture files.

`extracted/` and `*.unitypackage` are git-ignored (these dumps get large). The
dev server serves the project dir, so an extracted model is reachable at e.g.
`assets.loadModel('extracted/MyAsset/Assets/Models/Tree.fbx')`.

**Vendor robot gallery (worked example).** The "Robots Ultimate Pack" extracts to
`public/vendor/` (git-ignored — never commit purchased assets). Workflow:
1. `npm run unpack -- <pkg> public/vendor --filter=fbx,psd` — extract meshes + textures.
2. Convert PSD→PNG (three can't load PSD). macOS: `sips -s format png in.psd --out out.png`
   (batch over the diffuse/emission PSDs; skip "FX Square").
3. `npm run vendor:manifest` → `public/vendor/manifest.json` listing each robot's
   base mesh, texture/emission PNG, and `@`-animation clips.
4. `main.ts` fetches the manifest and builds a lil-gui **Vendor Robot** picker
   (Robot + Animation dropdowns). `showVendor()` loads the base mesh, applies the
   PNG as `map`/`emissiveMap`, and retargets the chosen `@clip` onto it via an
   `AnimationMixer`. These packs split **mesh** (base `.fbx`) from **animation**
   (`<Name>@<Clip>.fbx` = skeleton + one clip) — load both, retarget by bone name.
   Skipped gracefully (no manifest) on a clone without the pack.

## 7. Dependencies (npm, bundled by Vite)

- **three** `0.165` + `three/addons/*` (OrbitControls, postprocessing, loaders).
- **gsap** `3.12` — ghost entrances + location transitions.
- **lil-gui** `0.20` — debug panel.
- **@dimforge/rapier3d-compat** — physics (WASM inlined; no plugin needed).
- **howler** — audio playback.
- **miniplex** — ECS.
- **inkjs** `2.4` — Ink narrative runtime for dialogue. `inkjs` = `Story` (runtime);
  `inkjs/full` adds `Compiler` (runtime `.ink` compile — dev only; precompile for prod).
- dev: **vite**, **typescript**, **@types/three**, **@types/howler**, **@types/node**.

Note: the ported `jail/` code originally targeted three `0.184`; it runs fine on
`0.165`. If bumping three, re-verify postprocessing + addons.

---

## 8. Changelog (running)

Newest last. Keep this in sync with `git log` (we squash the auto-commit noise into
one meaningful commit per step).

| Commit | What |
|---|---|
| `8f81aea` | Initial single-file robot: 5 animations, theme picker, per-anim camera zoom |
| `d865b2b` | **Refactor into reusable ES modules** — `engine/` (scene, lighting, environment, cameraZoom, easing) + `robot/` (robot, animations, themes) + `ui.js`; extracted `styles.css`. Grew to 9 animations / 6 themes earlier in this step. |
| `01d5aeb` | **Robot in a jail with ghosts** — ported GhostJail3D 3D graphics to vanilla JS: `jail/ghostMesh.js` (8 forms), `jail/locationBuilder.js` (9 locations, floors fixed to y=0), `jail/jailScene.js`; new `engine/bloom.js`; Location + Period controls; GSAP. |
| `d9cd15b` | **lil-gui + controls** — `engine/debugPanel.js` (reusable panel + bloom/light helpers); ghost-form picker; Mood control; Period drives exposure; removed camera-side cell bars; `addLighting` returns `ambient`. |
| `ce73d3a` | **Swappable robot part variations** — `robot.js` rebuilt around a fixed skeleton + variant maps (head/torso/arms/legs); `parts` API + lil-gui "Robot Parts"; eye halos → shared `M.eyeHalo` material. |
| `fd85cde` | **8 more part variants** — head +dome/+visor, torso +tank/+orb, arms +claw/+piston, legs +wheel/+hover → 400 combos; torus helper. |
| `f220028` | **`engine/loop.js`** — render-loop registry (onFrame/setRender, clamped dt, monotonic t); main.js stops hand-rolling the loop; robot anim-time separated from continuous world-time. |
| `4e09b3b` | **Docs** — `ENGINE.md` living doc + `CLAUDE.md`/`AGENTS.md` agent front-doors. |
| `f39777e` | **`engine/assets.js`** — Promise-based GLTF/texture loader (deduped cache, progress manager, skinning-safe clone, lazy DRACO). The doorway to real Blender/Mixamo models; wired as `window.threej.assets`. |
| `a9afdf3` | **Unity asset pipeline** — `tools/unpack-unitypackage.mjs` (zero-dep extractor for `.unitypackage` files) + `assets.js` extended to FBX/OBJ/TGA with extension dispatch. See §6b. |
| `fbc71a7` | **Shareable build codes** — `engine/state.js` (URL-hash encode/decode + `createUrlState`); `main.js` syncs every control to the hash and restores from it at boot; lil-gui "Copy share link". |
| `e684cfb` | **Migrate to Vite + TypeScript** — npm toolchain; all `src/*.js`→`*.ts` (imports keep `.js` specifiers); dropped the import map; `npm run dev`/`build`/`typecheck`; `tsc` clean. |
| `05fe0bc` | **Rapier physics** — `engine/physics.ts` (WASM world, ground, `addDynamic`, `step`+sync); "Physics" lil-gui folder drops crates/orbs that pile up. |
| `a50b4fd` | **Howler audio** — `engine/audio.ts` (sound registry + procedural `toneWav`); blip/swish/thud on interactions + drops; "Audio" folder (volume/mute). |
| `ecac413` | **miniplex ECS** — `engine/ecs.ts` (World + system registry); dropped props are entities `{mesh,body,ttl}` with sync + ttl-despawn systems. |
| `7e08714` | **Load a rigged FBX robot** — optional vendor model from an extracted Unity pack (mesh + retargeted clip via AnimationMixer); asset git-ignored. |
| `31db3ce` | **Vendor robot gallery** — PSD→PNG (sips) + `tools/build-vendor-manifest.mjs`; lil-gui Robot/Animation dropdowns browse the whole pack (15 robots, 275 clips), textured. See §6b. |
| `7e2c8d5` | **Crossfade animator** — `engine/animator.ts` (named clips + `play(name, {fade})`); vendor Animation dropdown crossfades on the same model; walk/run clips drive a locomotion path. |
| `76ef87a` | **Root motion** — `engine/rootMotion.ts` extracts root-bone displacement (unit-independent, loop-safe) → the animation walks the character; vendor "Root motion" toggle for `W Root` clips. |
| `23e272b` | **State machine** — `engine/stateMachine.ts` (states + transitions); vendor "Wander (AI)" toggle runs an Idle↔Walk FSM driving the animator. |
| `3b29740` | **Capsule character** — `physics.addCharacter` (Rapier KinematicCharacterController) + `addStaticBox` walls; the vendor bot routes locomotion through it, colliding with walls + shoving crates. |
| `5bd8ff6` | **Input + drivable character** — `engine/input.ts` (WASD/gamepad); capsule gains gravity + jump; a "Drive (WASD/Space)" toggle drives the vendor bot via a Idle/Walk/Run/Jump FSM. |
| `a1f13d6` | **Blend space + smooth facing** — `engine/blendSpace.ts` (1D blend tree); drive locomotion blends Idle/Walk/Run by speed (jump overlaid); facing turns smoothly toward input. |
| `71f71de` | **Dialogue + cutscene** — `engine/dialogue.ts` (Ink/inkjs wrapper: lines/choices/variables, presentation-agnostic) + `dialogueUI.ts` (DOM box) + `engine/cutscene.ts` (GSAP-backed async director). "Scene" GUI folder plays an intro: camera dollies in, runs a branching conversation, dollies back. |
| `01ff536` | **Dialogue actions + trigger zones** — line tags (`#anim:wave`) dispatch to `dialogue.command()` handlers (robot reacts mid-line); `dialogueUI.ts` typewriter reveal (click completes, click advances); `engine/trigger.ts` (flat XZ zone, edge enter/exit) — driving the character into an NPC ring on the floor starts a conversation (drive freezes while talking). |
| `e7c9e91` | **Camera tags + conditional choices** — `#look:NAME` line tag punches the camera to a named framing (reuses `cameraZoom`, no-op mid-cutscene); Ink conditional choices `* { talked } [ … ]` gate options on story state, which now persists across knots (the warden intro changes the yard inmate's choices). |
| `7a9878e` | **Save / load** — `engine/save.ts`, named `localStorage` slots with `capture`/`apply` + versioning + `list()`/import/export. The demo persists the scene config + active level + driven-robot pose; a "Save / Load" GUI folder (Save/Load/Clear) writes slot `slot1` with a HUD toast. Survives reloads (verified). |
| `375fa39` | **HUD framework** — `engine/hud.ts`, a DOM overlay with screen-anchored `text()`/`bar()` and world-anchored `marker()` (projected each frame). Demo: a Stamina meter that drains while sprinting (sprint now gated on it) + a "UNIT-07" nameplate floating over the driven robot. |
| `12d63b3` | **Data-driven levels** — `engine/level.ts` instantiates a scene from a plain data object (objects via a factory registry, trigger zones, spawn point) and tears it down on swap. Factories can return `{ object, dispose }`; the demo `crate` adds a matching static collider. `src/levels.ts` + a "Level" GUI folder (None / Obstacle Course / Pillars). |
| `b62a90f` | **Particles / VFX** — `engine/particles.ts`, a one-draw-call `THREE.Points` pool with procedural soft sprites (no texture), per-particle colour/size, ring-buffer recycling. `burst`/`stream`/`update`. Drive kicks up dust on footfalls/jump/land; a "VFX" GUI folder fires Sparkle/Poof bursts; additive blending glows through bloom. |
| `d9cb2c1` | **Follow camera** — `engine/followCamera.ts`, a damped third-person cam that trails a target and swings behind it. Camera owners are now a strict hierarchy (director > follow > zoom/orbit); the vendor "Follow cam (3rd person)" toggle auto-enables with Drive for a real game feel. |
| `36f1a0b` | **Talk prompt** — the NPC zone no longer auto-starts; standing in it brightens the ring and shows a "press E to talk" prompt (`#talk-prompt`), and E starts the conversation. Prompt hides while talking / on exit / when drive stops. |
| `aea05e0` | **Scene manager** — `engine/sceneManager.ts` (`createSceneManager`): named scenes `{ enter, update, exit }` + cross-fade transitions (DOM overlay, configurable color/duration). Overlay starts opaque for a "boot reveal"; first `go()` enters and fades out; subsequent calls fade dark → swap → reveal. Demo: `title` scene (full-screen THREEJ card, Enter/click → game) + `game` scene (existing content). GUI "↩ Main menu" + `window.threej.scenes`. |
| `c58d6a5` | **Events / Timer / Camera shake** — three universal boilerplate modules. `engine/events.ts` (`createEvents<Schema>`): typed pub/sub bus; `on/once/off/emit/clear/count`; handler errors isolated per listener; `on()` returns an unsubscribe fn. `engine/timer.ts` (`createTimers`): loop-dt-based `after/every/tween` timers (pause with the loop; `every` handles large-dt missed intervals; `tween` drives a 0→1 progress with optional easing). `engine/shake.ts` (`createShake`): trauma-model camera shake (`addTrauma`, decays per frame at `trauma²` magnitude, camera-local right/up/roll offset, call LAST in camera callback). Demo: jump/land emit `player:jump`/`player:land` + add trauma; VFX folder has Shake light/medium/heavy + a "Timer: escalating shakes" button; `loadLevel` emits `level:change`; save toast uses `timer.after` instead of `setTimeout`. All three on `window.threej`. |
| `d0466f6` | **Object pool / Raycaster / Spatial audio** — `engine/pool.ts` (`createPool<T>`): generic pre-warmed pool, zero allocations on hot path, `acquire/release/releaseAll/forEach`, grows with warning if exhausted. `engine/raycast.ts` (`createRaycaster`): drag-safe click-on-3D; `pick/pickAll/pickNDC`; `onClick/onHover` attach persistent listeners and return cleanup fns. `audio.ts` extended: `play3D(name, pos, opts)` positions sound via Howler's PannerNode; `setListener(pos, fwd, up)` syncs the Web Audio listener to the camera each frame. Demo: clicking the static robot (raycaster + recursive pick) fires blip + shake + sparkle at hit point; physics prop `thud` is now `play3D`; "Pool: orb burst" VFX button fires 5 pre-allocated orbs in a ring, released after 1.5 s; `orbPool` and `raycast` on `window.threej`. |

---

## 9. Roadmap / next candidates

Loosely ordered; pick by what unblocks the most.

- **`engine/postfx.ts` growth** — vignette + color-grade passes. The pmndrs
  `postprocessing` lib is the upgrade path beyond `three/addons`.
- **Spatial/3D audio** ✓ done — `play3D` + `setListener` wired, listener syncs to camera each frame.
- **`engine/pool.ts`** ✓ done — generic pre-warmed pool, `acquire/release/forEach`.
- **`engine/raycast.ts`** ✓ done — drag-safe `pick/onClick/onHover`.
- **Dist pipeline** ✓ done — `npm run build` (chunk-split app: Three/Rapier/GSAP/vendor separate); `npm run build:lib` (tree-shakable `dist/engine/*.js`, all deps external). `src/engine/index.ts` barrel for single-import convenience. See §6.
- **GSAP timeline helpers in `engine/`** — reusable entrance/transition tweens.
- **Tighten TypeScript** — replace the migration's `: any` option-bags with real
  interfaces, module by module.
- **Perf pass** — instancing for repeated props; frustum/draw-call audit.

---

## 10. Gotchas / things that bit us

- **Auto-commit hook.** This repo commits every file write as `Auto: <file>`.
  Before pushing, squash: `git reset --soft <last-real-commit>` then one clean
  commit. (All real history so far is squashed; see Changelog.)
- **Headless preview throttles rAF.** When the preview tab is idle, the loop pauses,
  so `loop.elapsed` can read `0` until a screenshot/interaction forces frames. Not a
  bug — verify animation via screenshots.
- **Bloom in lit rooms.** Exposure was tuned for the dark void (2.2); in a lit jail
  it blows out. Current: exposure ~1.3–1.7 (Period-driven) + bloom threshold `1.5`
  so only emissive accents bloom. Re-tune if lighting changes a lot.
- **Variant anchors.** New part variants MUST keep the kinematic anchor points or
  animations will look detached.
- **Real browser vs preview color.** The headless preview historically rendered
  darker than Chrome; trust the real browser for final color calls.
- **Kinematic character rubberbanding.** Render the mesh at the body's *actual*
  position, never at `body + computedMovement` (the pre-step target) — that lead
  scales with `dt` and jitters back and forth. And don't let gravity fight
  snap-to-ground every frame: apply gravity only while airborne and pin the feet
  to the floor when grounded. (Fixed in `physics.addCharacter`.)

---

## 11. Update protocol (do this every change)

When you add or change something:
1. Put it in the right layer (`engine/` vs content vs glue).
2. Update **§4 catalog** (new engine module/API) and/or **§5 patterns**.
3. Add a row to the **§8 changelog** with the squashed commit hash.
4. Move/adjust **§9 roadmap**; add any new **§10 gotcha**.
5. Bump **Last updated** at the top.

If you're an agent picking this repo up: open this file first (see `CLAUDE.md` /
`AGENTS.md`), follow the principles, and leave this document better than you found it.
