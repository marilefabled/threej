# threej

An interactive Three.js robot — a single self-contained HTML file, no build step.

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

It's one file with no dependencies (Three.js loads from a CDN via importmap), but
it needs to be served over HTTP for ES modules to load:

```sh
npx serve .
```

Then open the printed `localhost` URL.

## Stack

- [Three.js](https://threejs.org/) 0.165 (CDN, ES modules + importmap)
- Vanilla HTML/CSS/JS — no bundler, no install
