# threej

An interactive Three.js robot — modular ES modules, no build step.

A blocky robot stands inside a procedural prison and responds to on-screen
buttons: each triggers a distinct animation, recolors its label, and kicks off a
camera zoom that eases in, holds, then returns to a neutral framing. Ghosts float
beside it, and you can change the location and time of day.

## Features

- **9 animations** — Idle, Wave, Dance, Spin, Jump, Punch, Flex, Walk, Think
- **Robot part variations** — swappable head (boxy / round / slim / dome / visor),
  torso (boxy / barrel / slim / tank / orb), arms (tube / blocky / claw / piston)
  and legs (tube / blocky / wheel / hover) over a fixed skeleton, so every
  animation keeps working. 400 combinations; pick per-part or Randomize.
- **6 color themes** — Steel, Crimson, Emerald, Gold, Violet, Mono. Each recolors
  the full robot, its eyes/glow accent, the ground glow, and the bounce light.
- **9 jail locations** — cell block, yard, cafeteria, library, infirmary,
  solitary, underground, warden's office (procedural "backgrounds"), each with
  its own props and fog.
- **Floating ghosts** — 8 procedural ghost forms (picker rebuilds the companion
  ghost) with float / glow / blink and GSAP rise-up entrances.
- **Bloom** — UnrealBloom post-processing so emissive surfaces (robot core/eyes,
  ghost eyes/glow) bloom.
- **Period + Mood** — dawn/day/dusk/night drives exposure + light intensity;
  neutral/danger/social/discovery/calm tints the mood light.
- **lil-gui debug panel** — live Bloom (strength/radius/threshold/exposure) and
  Lights (ambient/sun/fill/mood) tuning.
- **Per-animation camera zoom**, orbit controls, ground glow ring, soft shadows,
  rim + fill lighting.

The ghost + location graphics were ported from a sibling SvelteKit project
(GhostJail3D) into this repo's vanilla, no-build style.

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
    bloom.js          UnrealBloom post-processing pipeline (EffectComposer)
    debugPanel.js     lil-gui panel + composable bloom/light control helpers
    easing.js         easing helpers
  robot/            the robot
    robot.js          fixed skeleton + swappable part variants → posable rig + parts API
    animations.js     the 9 pose functions + per-anim colors and zoom targets
    themes.js         the 6 color themes + applyTheme()
  jail/             ghost + location graphics (ported from GhostJail3D)
    ghostMesh.js      8 procedural ghost forms + float/glow/blink animation
    locationBuilder.js  the 9 prison locations, built from primitives
    jailScene.js      manages the active location, ghosts, period light, GSAP
  ui.js             button + swatch DOM wiring (no Three.js knowledge)
```

The split is deliberate: **`engine/` is generic** — drop it into a new project and
call `createScene()` / `addLighting()` / `createBloom()` / `createCameraZoom()` to
get the same stage. **`robot/`** and **`jail/`** are the project-specific 3D code.

### Extending it

- **New animation** — add a function to `src/robot/animations.js`, a color to
  `ANIM_COLORS`, a camera target to `ZOOM_TARGETS`, and a `<button data-anim="…">`
  in `index.html`.
- **New theme** — add one entry to `THEMES` in `src/robot/themes.js`; the swatch
  UI is generated from that list.
- **New part variant** — add a builder to the `HEAD` / `TORSO` / `ARM` / `LEG`
  map in `src/robot/robot.js`. Keep the kinematic anchors (elbow at y=-0.45, knee
  at y=-0.48, etc.) so animations still line up; the lil-gui dropdown picks it up
  automatically.
- **New location** — add a `case` to `buildLocation()` and an entry to `LOCATIONS`
  in `src/jail/locationBuilder.js`; the dropdown is generated from that list.
- **New ghost form** — add an entry to `FORMS` in `src/jail/ghostMesh.js`.

## Stack

- [Three.js](https://threejs.org/) 0.165 + addons (CDN, native ES modules + import map)
- [GSAP](https://gsap.com/) 3.12 (ghost entrances + transitions)
- [lil-gui](https://lil-gui.georgealways.com/) 0.20 (debug panel)
- Vanilla HTML/CSS/JS — no bundler, no install
