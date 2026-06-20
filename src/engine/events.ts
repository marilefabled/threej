// Typed pub/sub event bus. Pass a schema to get type-safe emit/on:
//
//   type GameEvents = {
//     'player:died':    { score: number }
//     'level:change':   { name: string }
//     'npc:talk':       { knot: string }
//     'pickup:collect': { id: string; value: number }
//   }
//   const events = createEvents<GameEvents>()
//
//   const off = events.on('player:died', ({ score }) => showGameOver(score))
//   events.once('level:change', ({ name }) => console.log('first load:', name))
//   events.emit('player:died', { score: 1200 })
//   off()   // or events.off('player:died', handler)
//
// Without the generic, all payloads are typed `any` — still works, just untyped.
// Handlers that throw are caught and logged so they don't block other listeners.

export type Handler<T = any> = (payload: T) => void
export type Unsubscribe = () => void

export function createEvents<Schema extends Record<string, any> = Record<string, any>>() {
  // string keys only — keeps the Map generic simple
  const subs = new Map<string, Set<Handler>>()

  function _bucket(name: string): Set<Handler> {
    let b = subs.get(name)
    if (!b) { b = new Set(); subs.set(name, b) }
    return b
  }

  function on<K extends keyof Schema & string>(name: K, fn: Handler<Schema[K]>): Unsubscribe {
    _bucket(name).add(fn)
    return () => off(name, fn)
  }

  function once<K extends keyof Schema & string>(name: K, fn: Handler<Schema[K]>): Unsubscribe {
    let fired = false
    const wrap: Handler = (p) => { if (!fired) { fired = true; off(name, wrap); fn(p) } }
    _bucket(name).add(wrap)
    return () => off(name, wrap)
  }

  function off<K extends keyof Schema & string>(name: K, fn: Handler) {
    subs.get(name)?.delete(fn)
  }

  // Overloads: void payloads don't require a second argument.
  function emit<K extends keyof Schema & string>(
    name: K,
    ...args: Schema[K] extends void | undefined ? [] : [payload: Schema[K]]
  ): void {
    const bucket = subs.get(name)
    if (!bucket?.size) return
    const payload = args[0]
    // Snapshot the set so handlers can safely call on/off/once during dispatch.
    for (const fn of [...bucket]) {
      try { fn(payload) }
      catch (err) { console.error(`[events] handler error on "${name}":`, err) }
    }
  }

  // Remove all handlers for one event, or every handler if name is omitted.
  function clear(name?: keyof Schema & string) {
    if (name !== undefined) subs.delete(name)
    else subs.clear()
  }

  // Number of handlers registered (for a specific event, or total).
  function count(name?: keyof Schema & string): number {
    if (name !== undefined) return subs.get(name)?.size ?? 0
    let n = 0; for (const b of subs.values()) n += b.size; return n
  }

  return { on, once, off, emit, clear, count }
}
