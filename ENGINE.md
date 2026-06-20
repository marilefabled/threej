# threej — Engine Notes & Roadmap

> **This is a living document. Read it before working on this repo, and update it
> whenever you add or change something meaningful.** It is the source of truth for
> how this project is built and where it's going. See the *Update protocol* at the
> bottom — keeping this current is part of every change, not an afterthought.

**Last updated:** 2026-06-20 (after the Unity asset pipeline)

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
- **No build step.** Native ES modules + an import map + CDN. Zero `npm install`,
  served statically (`npx serve .`). This is a deliberate constraint — it keeps the
  barrier to entry at zero and the engine copy-paste-portable.
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
index.html            markup + import map (three, addons, gsap, lil-gui) + <script src=src/main.js>
styles.css            all UI styling
src/
  main.js             composition root — builds the world, wires UI, registers frame callbacks
  ui.js               robot button/swatch DOM wiring (no Three.js knowledge)
  engine/             ♻ REUSABLE — copy into any project
    scene.js            renderer · camera · OrbitControls · resize
    lighting.js         ambient · sun (shadows) · fill · rim lights · ground bounce
    environment.js      floor · two-layer grid · glow disc · ground ring
    cameraZoom.js       one-shot "fly to a target, hold, return" camera move
    bloom.js            UnrealBloom post-processing (EffectComposer)
    loop.js             render-loop registry: onFrame(t, dt) + setRender, clamped dt
    debugPanel.js       lil-gui panel + composable bloom/light control helpers
    easing.js           easing helpers
  robot/              the figure (content)
    robot.js            fixed skeleton + swappable part variants → rig + parts API
    animations.js       9 pose fns (rig, t) + ANIM_COLORS + ZOOM_TARGETS
    themes.js           6 themes + applyTheme()
  jail/               ghost + location graphics (ported from GhostJail3D)
    ghostMesh.js        8 procedural ghost forms + float/glow/blink
    locationBuilder.js  9 prison locations from primitives
    jailScene.js        active location + ghosts + period/mood light + GSAP transitions
tools/                node-side utilities (run with `node`, not in the browser)
    unpack-unitypackage.mjs  lift assets out of .unitypackage files (no Unity, no deps)
```

**Composition flow (`main.js`):** `createScene()` → `addLighting()` /
`addEnvironment()` → `buildRobot()` → mood light → `createBloom()` →
`createJail()` (location + ghosts) → theme/UI wiring → `createLoop()` registers
frame callbacks + render → `loop.start()`.

---

## 4. Engine module catalog (the reusable API)

Each is framework-free Three.js and has no dependency on robot/jail content.

| Module | Entry | Returns / shape |
|---|---|---|
| `scene.js` | `createScene({ fov, cameraPos, target, background, fog })` | `{ renderer, scene, camera, controls, BASE_CAM }` (+ wires resize) |
| `lighting.js` | `addLighting(scene)` | `{ ambient, sun, fill, rimL, rimR, bounce }` |
| `environment.js` | `addEnvironment(scene)` | `{ floor, gridFine, gridCoarse, glowDisc, groundRing }` |
| `cameraZoom.js` | `createCameraZoom(camera, controls, { base, lookAt, zoomIn, hold, zoomOut })` | `{ trigger(targetVec3), update(dt, applyLookAt) }` |
| `bloom.js` | `createBloom(renderer, scene, camera, { strength, radius, threshold })` | `{ composer, bloomPass, render(), setSize(w, h) }` |
| `loop.js` | `createLoop(renderer, { maxDelta })` | `{ onFrame((t,dt)=>…)→disposer, setRender(fn), start, stop, elapsed, running }` |
| `assets.js` | `createAssets({ basePath, onProgress, onLoad, onError })` | `{ loadGLTF, loadModel, loadTexture, loadAll, enableDraco, manager, clear }` |
| `debugPanel.js` | `createDebugPanel({ title, closed })` · `addBloomControls(gui, bloom, renderer)` · `addLightControls(gui, lights)` | a lil-gui `GUI` + folders |
| `easing.js` | `easeInOut(t)` | number |

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
- `debugPanel.js` helpers are composable — add only the folders a project needs,
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

1. Copy `src/engine/` and `styles.css` (trim as needed).
2. Add the import map to `index.html` (three + `three/addons/` + gsap + lil-gui).
3. In `main.js`:
   ```js
   const { renderer, scene, camera, controls, BASE_CAM } = createScene();
   addLighting(scene); addEnvironment(scene);
   const bloom = createBloom(renderer, scene, camera);
   const loop = createLoop(renderer);
   loop.onFrame((t, dt) => {/* update your content */});
   loop.setRender(() => bloom.render());
   loop.start();
   ```
4. Add your own content modules alongside (your `robot/` equivalent).

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

## 7. Dependencies (all via import map, no install)

- **three** `0.165` + `three/addons/` (OrbitControls, postprocessing) — jsDelivr.
- **gsap** `3.12` — esm.sh (ghost entrances + location transitions).
- **lil-gui** `0.20` — jsDelivr (debug panel).

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

---

## 9. Roadmap / next candidates

Loosely ordered; pick by what unblocks the most.

- **Shareable build codes** — encode parts + theme + location + period + animation
  into the URL hash so a configured look is a linkable URL (and survives reload).
- **`engine/state.js`** — small serialize/deserialize for scene config (feeds the
  build codes + future save/load).
- **GSAP timeline helpers in `engine/`** — reusable entrance/transition tweens
  (the ghost entrance + location transition logic generalized).
- **More content variants** — treads/jetpack/back-mounted parts; more ghost forms;
  more locations.
- **`engine/postfx.js` growth** — optional vignette / DOF / color-grade passes
  alongside bloom.
- **Perf pass** — instancing for repeated location props; frustum/draw-call audit.

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
