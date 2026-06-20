// A tiny render-loop registry. Modules register per-frame callbacks; the loop
// drives them off renderer.setAnimationLoop (which auto-pauses on hidden tabs
// and is WebXR-ready) and runs a single render step after them.
//
//   const loop = createLoop(renderer);
//   loop.onFrame((t, dt) => { ... });   // t = elapsed seconds, dt = frame delta
//   loop.setRender(() => composer.render());
//   loop.start();
//
// onFrame returns a disposer. `dt` is clamped (default 0.1s) so a long pause —
// e.g. the tab going to the background — never produces a giant time-step that
// makes everything jump on return. `t` accumulates the clamped deltas, so it is
// monotonic and pause-safe rather than wall-clock.
export function createLoop(renderer, { maxDelta = 0.1 } = {}) {
  const callbacks = [];   // plain array → index iteration, no per-frame allocation
  let renderFn = null;
  let elapsed = 0;
  let last = 0;
  let running = false;

  function frame(timeMs) {
    const now = timeMs / 1000;
    const dt = last ? Math.min(now - last, maxDelta) : 0;
    last = now;
    elapsed += dt;

    for (let i = 0; i < callbacks.length; i++) callbacks[i](elapsed, dt);
    if (renderFn) renderFn(elapsed, dt);
  }

  return {
    // Register a per-frame callback (t, dt). Returns a disposer.
    onFrame(fn) {
      callbacks.push(fn);
      return () => {
        const i = callbacks.indexOf(fn);
        if (i >= 0) callbacks.splice(i, 1);
      };
    },
    // The draw step — runs once, after every onFrame callback.
    setRender(fn) { renderFn = fn; },
    start() {
      if (running) return;
      running = true;
      last = 0;                       // first frame after (re)start has dt = 0
      renderer.setAnimationLoop(frame);
    },
    stop() {
      running = false;
      last = 0;
      renderer.setAnimationLoop(null);
    },
    get elapsed() { return elapsed; },
    get running() { return running; },
  };
}
