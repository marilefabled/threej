// Generic object pool — acquire/release pre-built objects instead of allocating
// new ones each frame. Zero GC on the hot path; essential for bullets, enemies,
// effects, or any object that spawns and despawns at a high rate.
//
//   const pool = createPool(
//     () => new THREE.Mesh(geo, mat),          // factory: build one object
//     {
//       size: 32,                              // pre-warm with 32 objects
//       reset: (m) => { m.visible = false; scene.remove(m) },
//     }
//   )
//
//   const bullet = pool.acquire()             // grab from pool (grows if exhausted)
//   bullet.position.copy(origin)
//   bullet.visible = true
//   scene.add(bullet)
//   timer.after(2, () => pool.release(bullet)) // return it (reset() is called)
//
//   pool.forEach(b => b.position.addScaledVector(dir, speed * dt)) // update all active
//   pool.releaseAll()                          // reset everything at once (e.g. level clear)

export function createPool<T>(
  factory: () => T,
  {
    size = 16,
    reset,
    warn = true,
  }: {
    size?:   number
    reset?:  (obj: T) => void
    warn?:   boolean
  } = {},
) {
  const free:  T[]    = []
  const inUse: Set<T> = new Set()

  // Pre-warm: build all objects upfront so the first burst doesn't stutter.
  for (let i = 0; i < size; i++) free.push(factory())

  // Return an object from the pool. If exhausted, grows the pool with a warning.
  function acquire(): T {
    let obj: T
    if (free.length > 0) {
      obj = free.pop()!
    } else {
      if (warn) console.warn(`[pool] exhausted (${inUse.size} active) — growing beyond initial size of ${size}`)
      obj = factory()
    }
    inUse.add(obj)
    return obj
  }

  // Return an object to the pool. Calls reset() if provided, then marks it free.
  function release(obj: T): void {
    if (!inUse.has(obj)) { console.warn('[pool] release() called on an object not currently acquired'); return }
    inUse.delete(obj)
    reset?.(obj)
    free.push(obj)
  }

  // Return all currently acquired objects at once (e.g. on level change or game over).
  function releaseAll(): void {
    for (const obj of inUse) { reset?.(obj); free.push(obj) }
    inUse.clear()
  }

  // Iterate every active (acquired) object — use this for per-frame updates.
  function forEach(fn: (obj: T) => void): void {
    for (const obj of inUse) fn(obj)
  }

  return {
    acquire,
    release,
    releaseAll,
    forEach,
    get active()    { return inUse.size },
    get available() { return free.length },
    get size()      { return inUse.size + free.length },
  }
}
