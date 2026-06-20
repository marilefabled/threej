# threej

A small Three.js + TypeScript engine (Vite), grown from an interactive robot demo.

> **Building on this repo?** Read [`ENGINE.md`](./ENGINE.md) first — it's the living
> doc covering architecture, the reusable engine API, the changelog, and the roadmap.

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

Also: **Rapier physics** (droppable crates), **Howler audio**, and a **miniplex
ECS** managing the props — see the lil-gui Physics/Audio folders. The ghost +
location graphics were ported from a sibling SvelteKit project (GhostJail3D).

## Run it

```sh
npm install
npm run dev
```

Then open the printed `localhost` URL. (`npm run build` for production,
`npm run typecheck` for types.)

## Project structure

`src/engine/` is generic, reusable scaffolding (scene, lighting, environment,
cameraZoom, bloom, loop, assets, state, physics, audio, ecs, debugPanel); `robot/`
and `jail/` are the project's content; `main.ts` + `ui.ts` are the glue. The full
tree, the reusable engine API, and how to start a new project from `engine/` are
documented in **[`ENGINE.md`](./ENGINE.md)** (the living source of truth).

### Extending it

- **New animation** — fn in `src/robot/animations.ts` + `ANIM_COLORS` +
  `ZOOM_TARGETS` + a `<button data-anim="…">` in `index.html`.
- **New theme** — one entry in `THEMES` (`src/robot/themes.ts`).
- **New part variant** — a builder in the `HEAD`/`TORSO`/`ARM`/`LEG` maps in
  `src/robot/robot.ts` (keep the kinematic anchors).
- **New location / ghost form** — `LOCATIONS`+`buildLocation()` in
  `src/jail/locationBuilder.ts` / `FORMS` in `src/jail/ghostMesh.ts`.

## Stack

- [Three.js](https://threejs.org/) 0.165 + addons · [GSAP](https://gsap.com/) ·
  [lil-gui](https://lil-gui.georgealways.com/) · [Rapier](https://rapier.rs/)
  (physics) · [Howler](https://howlerjs.com/) (audio) ·
  [miniplex](https://github.com/hmans/miniplex) (ECS)
- [Vite](https://vitejs.dev/) + TypeScript
