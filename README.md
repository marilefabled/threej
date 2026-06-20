# threej

An interactive Three.js robot — modular ES modules, no build step.

A blocky robot rendered from Three.js primitives responds to on-screen buttons:
each button triggers a distinct animation, recolors its label, and kicks off a
camera zoom that eases in, holds, then returns to a neutral framing.

## Features

- **9 animations** — Idle, Wave, Dance, Spin, Jump, Punch, Flex, Walk, Think
- **6 color themes** — Steel, Crimson, Emerald, Gold, Violet, Mono. Each recolors
  the full robot, its eyes/glow accent, the ground glow, and the bounce light.
- **Per-animation camera zoom** — eases to a framing chosen per move, holds, then
  returns to neutral.
- **Orbit controls** — drag to orbit, scroll to zoom (disabled briefly during a
  triggered zoom, then handed back).
- Double grid floor, ground glow ring, soft shadows, rim + fill lighting.

## Run it

No dependencies to install (Three.js loads from a CDN via importmap), but it must
be served over HTTP for ES modules to load:

```sh
npx serve .
```

Then open the printed `localhost` URL.

## Project structure

```
index.html          markup + import map + <script src="src/main.js">
styles.css          all UI styling
src/
  main.js           composition root — wires everything together + render loop
  engine/           ♻ reusable Three.js scaffolding (copy into other projects)
    scene.js          renderer · camera · OrbitControls · resize
    lighting.js       ambient · sun (shadows) · fill · rim lights · ground bounce
    environment.js    floor · two-layer grid · glow disc · ground ring
    cameraZoom.js     one-shot "fly to a target, hold, return" camera move
    easing.js         easing helpers
  robot/            this project's content
    robot.js          builds the figure from primitives, returns a posable rig
    animations.js     the 9 pose functions + per-anim colors and zoom targets
    themes.js         the 6 color themes + applyTheme()
  ui.js             button + swatch DOM wiring (no Three.js knowledge)
```

The split is deliberate: **`engine/` is generic** — drop it into a new project and
call `createScene()` / `addLighting()` / `createCameraZoom()` to get the same
stage. **`robot/`** is the only project-specific 3D code.

### Extending it

- **New animation** — add a function to `src/robot/animations.js`, a color to
  `ANIM_COLORS`, a camera target to `ZOOM_TARGETS`, and a `<button data-anim="…">`
  in `index.html`.
- **New theme** — add one entry to `THEMES` in `src/robot/themes.js`; the swatch
  UI is generated from that list.

## Stack

- [Three.js](https://threejs.org/) 0.165 (CDN, native ES modules + import map)
- Vanilla HTML/CSS/JS — no bundler, no install
