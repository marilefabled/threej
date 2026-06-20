import { gsap } from 'gsap';

// Cutscene director. A cutscene is an async script — `async (cx) => { ... }` —
// that awaits engine actions in sequence. `cx` provides GSAP-backed awaitable
// primitives; the app extends it with domain helpers (camera moves, dialogue,
// animations). Sequencing/easing come from GSAP, which we already use.
//
//   const director = createDirector({ camera, dialogue });
//   director.play(async (cx) => {
//     await cx.to(cx.camera.position, { x: 1, y: 2, z: 4, duration: 1.2, ease: 'power2.inOut' });
//     await cx.say('cell_intro');         // runs the dialogue, resolves at its end
//     await cx.wait(0.4);
//   });
//
// extras: pass extra helpers/objects merged into `cx` (e.g. { camera, dialogue }).
export function createDirector(extras: any = {}) {
  let running: any = null;
  let killed = false;
  const tweens: any[] = [];
  const pending = new Set<() => void>();   // unresolved awaits, freed on skip

  const cx: any = {
    ...extras,
    get killed() { return killed; },

    // Await a GSAP tween to completion (skip-aware).
    to(target: any, vars: any) {
      return new Promise<void>((res) => {
        if (killed) return res();
        const done = () => { pending.delete(done); res(); };
        pending.add(done);
        const tw = gsap.to(target, { ...vars, onComplete: done });
        tweens.push(tw);
      });
    },
    // Await a plain delay.
    wait(seconds: number) {
      return new Promise<void>((res) => {
        if (killed) return res();
        const done = () => { pending.delete(done); res(); };
        pending.add(done);
        const tw = gsap.delayedCall(seconds, done);
        tweens.push(tw);
      });
    },
    // Run several sub-steps at once; resolves when all finish.
    parallel(...fns: Array<() => Promise<any>>) { return Promise.all(fns.map((f) => f())); },

    // Run the dialogue (if a dialogue helper was provided) and wait for its end.
    say(knot?: string) { return (killed || !extras.dialogue) ? Promise.resolve() : extras.dialogue.run(knot); },
  };

  async function play(script: (cx: any) => Promise<void>) {
    if (running) skip();
    killed = false;
    running = script;
    try { await script(cx); } finally { running = null; }
  }

  // Abort the current cutscene: kill tweens and resolve every pending await so the
  // script runs to its end immediately (remaining cx.* calls no-op while killed).
  function skip() {
    killed = true;
    tweens.forEach((t) => t.kill?.());
    tweens.length = 0;
    [...pending].forEach((fn) => fn());
    pending.clear();
  }

  return { play, skip, cx, get active() { return !!running; } };
}
