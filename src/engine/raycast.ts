// Click-on-3D raycasting. Wraps THREE.Raycaster with mouse-event helpers and a
// drag-distance guard so orbiting the camera doesn't accidentally trigger picks.
//
//   const raycast = createRaycaster(camera, renderer)
//
//   // One-off pick on a mouse event:
//   const hit = raycast.pick(e, [mesh, group], { recursive: true })
//   if (hit) console.log(hit.object, hit.point, hit.distance)
//
//   // Attach a persistent click handler (returns cleanup fn):
//   const off = raycast.onClick([robotGroup], (hit, e) => {
//     if (!hit) return
//     shake.addTrauma(0.15)
//     vfx.burst(hit.point, 8, { ... })
//   }, { recursive: true })
//   off()   // remove the listener
//
//   // Hover:
//   const offHover = raycast.onHover([interactables], (hit) => {
//     document.body.style.cursor = hit ? 'pointer' : ''
//   }, { recursive: true })

import * as THREE from 'three'

export interface RaycastHit extends THREE.Intersection {}

export interface RaycastOpts {
  recursive?: boolean
  maxDrag?:   number   // pixels; clicks with more movement are treated as drags (default 5)
}

export function createRaycaster(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
  const rc     = new THREE.Raycaster()
  const _mouse = new THREE.Vector2()

  function _toNDC(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect()
    _mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1
    _mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1
  }

  // Closest intersection from a mouse/pointer event, or null if nothing hit.
  function pick(
    e: MouseEvent | PointerEvent,
    objects: THREE.Object3D[],
    opts: RaycastOpts = {},
  ): RaycastHit | null {
    _toNDC(e.clientX, e.clientY)
    rc.setFromCamera(_mouse, camera)
    const hits = rc.intersectObjects(objects, opts.recursive ?? false)
    return hits[0] ?? null
  }

  // All intersections from a mouse/pointer event.
  function pickAll(
    e: MouseEvent | PointerEvent,
    objects: THREE.Object3D[],
    opts: RaycastOpts = {},
  ): RaycastHit[] {
    _toNDC(e.clientX, e.clientY)
    rc.setFromCamera(_mouse, camera)
    return rc.intersectObjects(objects, opts.recursive ?? false)
  }

  // Pick from an explicit NDC coordinate (−1..1 in both axes). Useful for
  // touch, controller reticles, or crosshair-based picking at screen centre (0, 0).
  function pickNDC(
    ndcX: number,
    ndcY: number,
    objects: THREE.Object3D[],
    opts: RaycastOpts = {},
  ): RaycastHit | null {
    _mouse.set(ndcX, ndcY)
    rc.setFromCamera(_mouse, camera)
    const hits = rc.intersectObjects(objects, opts.recursive ?? false)
    return hits[0] ?? null
  }

  // Attach a click listener to the renderer canvas.
  // Includes a drag guard: if the pointer moved more than maxDrag pixels between
  // mousedown and click, the handler is skipped (so orbiting doesn't count as clicking).
  // Returns a cleanup function.
  function onClick(
    objects: THREE.Object3D[] | (() => THREE.Object3D[]),
    fn: (hit: RaycastHit | null, e: MouseEvent) => void,
    opts: RaycastOpts = {},
  ): () => void {
    const maxDrag = opts.maxDrag ?? 5
    let downX = 0, downY = 0
    const onDown  = (e: MouseEvent) => { downX = e.clientX; downY = e.clientY }
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > maxDrag) return
      const targets = typeof objects === 'function' ? objects() : objects
      fn(pick(e, targets, opts), e)
    }
    renderer.domElement.addEventListener('mousedown', onDown)
    renderer.domElement.addEventListener('click', onClick)
    return () => {
      renderer.domElement.removeEventListener('mousedown', onDown)
      renderer.domElement.removeEventListener('click', onClick)
    }
  }

  // Attach a pointermove hover listener to the renderer canvas.
  // Returns a cleanup function.
  function onHover(
    objects: THREE.Object3D[] | (() => THREE.Object3D[]),
    fn: (hit: RaycastHit | null, e: PointerEvent) => void,
    opts: RaycastOpts = {},
  ): () => void {
    const handler = (e: PointerEvent) => {
      const targets = typeof objects === 'function' ? objects() : objects
      fn(pick(e as any, targets, opts), e)
    }
    renderer.domElement.addEventListener('pointermove', handler)
    return () => renderer.domElement.removeEventListener('pointermove', handler)
  }

  return { pick, pickAll, pickNDC, onClick, onHover, raycaster: rc }
}
