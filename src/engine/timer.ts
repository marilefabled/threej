// Game-loop-integrated timers. Unlike setTimeout/GSAP, these run on the loop's
// accumulated dt so they pause automatically when the game loop pauses (tab hidden,
// scene paused, etc.). Call timer.update(dt) once per frame from your render loop.
//
//   const timer = createTimers()
//   loop.onFrame((_, dt) => timer.update(dt))
//
//   timer.after(2, () => spawnEnemy())               // once, after 2 s
//   timer.every(0.5, () => tick(), { times: 4 })     // 4× at 0.5 s intervals
//   const h = timer.every(1, pulse)                  // runs forever
//   h.cancel()                                       // stop it
//   timer.tween(1, p => bar.set(p), {               // progress 0→1 over 1 s
//     ease: easeInOut, onComplete: () => done(),
//   })
//   timer.cancelAll()                                // clear the slate

export interface TimerHandle {
  cancel(): void
  readonly active: boolean
}

interface Entry {
  type: 'after' | 'every' | 'tween'
  elapsed: number
  fn: (...args: any[]) => void
  delay: number          // 'after': seconds to wait; 'every': interval; 'tween': duration
  count: number          // 'every': remaining fires (-1 = unlimited); others unused
  ease: ((t: number) => number) | null
  onComplete: (() => void) | null
  done: boolean
}

export function createTimers() {
  let entries: Entry[] = []
  let dirty = false

  function _add(e: Entry): TimerHandle {
    entries.push(e)
    return {
      cancel()          { e.done = true; dirty = true },
      get active()      { return !e.done },
    }
  }

  // Fire fn once after delay seconds.
  function after(delay: number, fn: () => void): TimerHandle {
    return _add({ type: 'after', elapsed: 0, fn, delay, count: 1, ease: null, onComplete: null, done: false })
  }

  // Fire fn every interval seconds. opts.times limits the total number of fires.
  function every(interval: number, fn: () => void, opts: { times?: number } = {}): TimerHandle {
    if (interval <= 0) { console.warn('[timer] every() interval must be > 0; clamped to 1 frame'); interval = 0.016 }
    return _add({ type: 'every', elapsed: 0, fn, delay: interval, count: opts.times ?? -1, ease: null, onComplete: null, done: false })
  }

  // Call fn(progress) each frame for duration seconds, where progress goes 0→1.
  // Optional ease function transforms the progress before it reaches fn.
  // onComplete fires once when progress reaches 1.
  function tween(
    duration: number,
    fn: (progress: number) => void,
    opts: { ease?: (t: number) => number; onComplete?: () => void } = {},
  ): TimerHandle {
    return _add({ type: 'tween', elapsed: 0, fn, delay: Math.max(0.001, duration), count: 1, ease: opts.ease ?? null, onComplete: opts.onComplete ?? null, done: false })
  }

  function cancel(h: TimerHandle) { h.cancel() }

  function cancelAll() { for (const e of entries) e.done = true; entries = []; dirty = false }

  function update(dt: number) {
    for (const e of entries) {
      if (e.done) continue
      e.elapsed += dt

      if (e.type === 'after') {
        if (e.elapsed >= e.delay) {
          try { e.fn() } catch (err) { console.error('[timer] after() handler:', err) }
          e.done = true; dirty = true
        }
      } else if (e.type === 'every') {
        // Use a while loop so a large dt that spans multiple intervals fires each one.
        // The loop is bounded by the entry becoming done, so it can't spin infinitely.
        while (!e.done && e.elapsed >= e.delay) {
          e.elapsed -= e.delay
          try { e.fn() } catch (err) { console.error('[timer] every() handler:', err) }
          if (e.count > 0 && --e.count <= 0) { e.done = true; dirty = true }
        }
      } else {
        // tween
        const raw = Math.min(1, e.elapsed / e.delay)
        const p   = e.ease ? e.ease(raw) : raw
        try { e.fn(p) } catch (err) { console.error('[timer] tween() handler:', err) }
        if (raw >= 1) {
          try { e.onComplete?.() } catch (err) { console.error('[timer] tween onComplete:', err) }
          e.done = true; dirty = true
        }
      }
    }
    // Compact the list once per frame (only if something finished or was cancelled).
    if (dirty) { entries = entries.filter(e => !e.done); dirty = false }
  }

  return {
    after,
    every,
    tween,
    cancel,
    cancelAll,
    update,
    get pending() { return entries.length },
  }
}
