import * as THREE from 'three';
import { createTrigger } from './trigger.js';

// Data-driven level loader. A level is a plain object (JSON-friendly) describing
// what to place; the loader instantiates it and tracks everything for a clean
// unload. Object `type`s map to factory functions — a few primitives are built in,
// and the app registers its own (e.g. a `crate` that also adds a physics collider).
//
//   const level = {
//     name: 'yard',
//     spawn: { x: 0, z: 4, yaw: 3.14 },
//     objects: [
//       { type: 'box', position: [2,0.5,0], size: [1,1,1], color: 0x8899aa },
//       { type: 'light', position: [0,3,0], color: 0xffccaa, intensity: 8 },
//     ],
//     triggers: [ { id: 'exit', position: [0,5], radius: 1.2, dialogue: 'yard_npc' } ],
//   };
//   const loader = createLevelLoader(scene, { factories: { crate }, onTrigger });
//   const handle = loader.load(level);              // spawn it
//   loop.onFrame(() => loader.update(player.position));  // drive the triggers
//
// A factory returns either an Object3D, or `{ object, dispose }` when it owns extra
// resources (a collider, a texture) that must be torn down on unload.
const BUILTINS: Record<string, (e: any) => any> = {
  box: (e) => new THREE.Mesh(
    new THREE.BoxGeometry(...(e.size ?? [1, 1, 1])),
    new THREE.MeshStandardMaterial({ color: e.color ?? 0x8899aa, metalness: e.metalness ?? 0.1, roughness: e.roughness ?? 0.85 })),
  sphere: (e) => new THREE.Mesh(
    new THREE.SphereGeometry(e.radius ?? 0.5, 24, 16),
    new THREE.MeshStandardMaterial({ color: e.color ?? 0x8899aa, metalness: 0.1, roughness: 0.7 })),
  light: (e) => new THREE.PointLight(e.color ?? 0xffffff, e.intensity ?? 5, e.distance ?? 0),
  marker: (e) => {                                    // a glowing floor ring (zone visual)
    const m = new THREE.Mesh(
      new THREE.RingGeometry((e.radius ?? 1.2) - 0.25, e.radius ?? 1.2, 48),
      new THREE.MeshBasicMaterial({ color: e.color ?? 0x66ccff, transparent: true, opacity: e.opacity ?? 0.5, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    return m;
  },
};

export function createLevelLoader(scene: any, { factories = {}, onTrigger }: any = {}) {
  const registry: Record<string, (e: any) => any> = { ...BUILTINS, ...factories };
  let current: any = null;

  function place(obj: any, e: any) {
    if (e.position) obj.position.fromArray(e.position);
    if (e.rotation) obj.rotation.set(e.rotation[0] || 0, e.rotation[1] || 0, e.rotation[2] || 0);
    if (e.scale != null) typeof e.scale === 'number' ? obj.scale.setScalar(e.scale) : obj.scale.fromArray(e.scale);
    if (e.name) obj.name = e.name;
  }

  function load(data: any) {
    unload();
    const entries: any[] = [];                        // { obj, dispose }
    for (const e of data.objects ?? []) {
      const make = registry[e.type];
      if (!make) { console.warn('level: no factory for type', e.type); continue; }
      const made = make(e);
      if (!made) continue;
      const obj = made.isObject3D ? made : made.object;
      const dispose = made.isObject3D ? null : made.dispose;
      place(obj, e);
      obj.traverse?.((o: any) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      scene.add(obj);
      entries.push({ obj, dispose });
    }
    const triggers = (data.triggers ?? []).map((t: any) => ({
      ...t,
      trigger: createTrigger({
        position: new THREE.Vector3(t.position[0], 0, t.position[1]),
        radius: t.radius ?? 1.4, once: t.once ?? false,
        onEnter: () => onTrigger?.(t, 'enter'),
        onExit: () => onTrigger?.(t, 'exit'),
      }),
    }));
    const s = data.spawn ?? {};
    current = { name: data.name, entries, triggers, spawn: { x: s.x ?? 0, z: s.z ?? 0, yaw: s.yaw ?? 0 } };
    return current;
  }

  // Feed the tracked point (e.g. the player) to every trigger each frame.
  function update(point: any) { if (current) for (const t of current.triggers) t.trigger.update(point); }

  function unload() {
    if (!current) return;
    for (const { obj, dispose } of current.entries) {
      scene.remove(obj);
      dispose?.();                                     // factory-owned teardown (colliders, etc.)
      obj.traverse?.((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      obj.geometry?.dispose?.(); obj.material?.dispose?.();
    }
    current = null;
  }

  return { load, unload, update, registry, get current() { return current; }, get spawn() { return current?.spawn; } };
}
