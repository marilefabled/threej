// Scene lifecycle manager with cross-fade transitions.
//
// Each scene: { enter?(prev), update?(dt,t), exit?(next) } — all callbacks optional.
// The fade overlay starts at opacity:1 (black) so the very first go() gives a "boot
// reveal" (enter scene → fade to transparent) with no preceding flash.
//
//   const sm = createSceneManager({ transition: { duration: 0.35, color: '#000' } });
//   sm.register('title', { enter, update, exit })
//     .register('game',  { update: (dt, t) => ... });
//   sm.go('title');              // first scene — reveal from black
//   sm.go('game');               // subsequent — fade dark → swap → reveal
//   sm.update(dt, t);            // call once per frame in your render loop

export interface SceneDef {
  enter?: (prev: string | null) => void | Promise<void>
  update?: (dt: number, t: number) => void
  exit?: (next: string) => void | Promise<void>
}

export interface TransitionOpts {
  duration?: number
  color?: string
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export function createSceneManager({ transition = {} }: { transition?: TransitionOpts } = {}) {
  const { duration: defDur = 0.35, color: defColor = '#000' } = transition

  // Overlay sits above everything (z:200); starts opaque for a "boot reveal" on first go().
  const overlay = document.createElement('div')
  overlay.style.cssText = `position:fixed;inset:0;background:${defColor};pointer-events:none;z-index:200;opacity:1`
  document.body.appendChild(overlay)

  const scenes = new Map<string, SceneDef>()
  let current: string | null = null
  let _active: SceneDef | null = null
  let _busy = false

  function register(name: string, def: SceneDef) {
    scenes.set(name, def)
    return api   // chainable
  }

  async function go(name: string, opts: TransitionOpts = {}) {
    if (_busy) { console.warn(`[scene] busy — ignoring go("${name}")`); return }
    if (!scenes.has(name)) { console.warn(`[scene] unknown scene "${name}"`); return }
    _busy = true

    const dur = opts.duration ?? defDur
    const col = opts.color ?? defColor

    if (current !== null) {
      // Not the first scene: fade to dark before swapping
      overlay.style.background = col
      overlay.style.transition = `opacity ${dur}s ease`
      overlay.style.opacity = '1'
      await sleep(dur * 1000)
    }

    const prev = current
    await _active?.exit?.(name)
    current = name
    _active = scenes.get(name)!
    await _active.enter?.(prev)

    // Reveal new scene
    overlay.style.transition = `opacity ${dur}s ease`
    overlay.style.opacity = '0'
    await sleep(dur * 1000)
    _busy = false
  }

  function update(dt: number, t: number) {
    _active?.update?.(dt, t)
  }

  function dispose() { overlay.remove() }

  const api = {
    register,
    go,
    update,
    dispose,
    get current() { return current },
    get busy() { return _busy },
  }
  return api
}
