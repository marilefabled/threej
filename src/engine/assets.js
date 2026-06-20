import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Asset loader wrapper — the doorway to real models (Blender / Mixamo GLB/GLTF)
// and textures. Promise-based, deduped by URL, with a shared LoadingManager for
// aggregate progress. Heavy/optional bits (DRACO, skinning-safe clone) are
// lazy-imported so they cost nothing until used.
//
//   const assets = createAssets({ basePath: 'models/', onProgress: p => … });
//   const { scene, animations } = await assets.loadModel('robot.glb');
//   const map = await assets.loadTexture('floor.png');
//
// Animating a rigged model (the typical Mixamo flow):
//   const { scene, animations } = await assets.loadModel('character.glb');
//   sceneRoot.add(scene);
//   const mixer = new THREE.AnimationMixer(scene);
//   mixer.clipAction(animations[0]).play();
//   loop.onFrame((t, dt) => mixer.update(dt));   // engine/loop.js
export function createAssets({ basePath = '', onProgress, onLoad, onError } = {}) {
  const manager = new THREE.LoadingManager();
  if (onProgress) manager.onProgress = (url, loaded, total) => onProgress(total ? loaded / total : 0, { url, loaded, total });
  if (onLoad) manager.onLoad = onLoad;
  manager.onError = (url) => { console.error('[assets] failed to load', url); onError?.(url); };

  const gltfLoader = new GLTFLoader(manager);
  const texLoader = new THREE.TextureLoader(manager);

  const cache = new Map(); // key -> Promise (failed loads evict so retries work)
  const url = (u) => basePath + u;
  const cached = (key, make) => {
    if (!cache.has(key)) cache.set(key, make().catch((e) => { cache.delete(key); throw e; }));
    return cache.get(key);
  };

  // Raw GLTF result ({ scene, animations, cameras, ... }). Cached + shared, so
  // read from it but clone the scene (loadModel) before adding to the world.
  const loadGLTF = (u) => cached('gltf:' + u, () => gltfLoader.loadAsync(url(u)));

  // A ready-to-add instance: a (skinning-safe) clone of the model's scene with
  // shadows enabled, plus its animation clips.
  async function loadModel(u, { clone = true, shadows = true } = {}) {
    const gltf = await loadGLTF(u);
    const scene = clone ? await cloneSkinned(gltf.scene) : gltf.scene;
    if (shadows) scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { scene, animations: gltf.animations, gltf };
  }

  const loadTexture = (u, { colorSpace = THREE.SRGBColorSpace, flipY } = {}) =>
    cached('tex:' + u, () => texLoader.loadAsync(url(u)).then((t) => {
      t.colorSpace = colorSpace;
      if (flipY !== undefined) t.flipY = flipY;
      return t;
    }));

  // Batch load a map { key: 'file.glb' | 'file.png' } → { key: asset }. Textures
  // are detected by extension; everything else is treated as a GLTF.
  async function loadAll(map) {
    const out = {};
    await Promise.all(Object.entries(map).map(async ([k, u]) => {
      out[k] = /\.(png|jpe?g|webp|avif|ktx2)$/i.test(u) ? await loadTexture(u) : await loadGLTF(u);
    }));
    return out;
  }

  // Enable DRACO-compressed GLB. Call once before loading compressed models.
  function enableDraco(decoderPath = 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/draco/') {
    return import('three/addons/loaders/DRACOLoader.js').then(({ DRACOLoader }) => {
      const d = new DRACOLoader(manager);
      d.setDecoderPath(decoderPath);
      gltfLoader.setDRACOLoader(d);
      return d;
    });
  }

  return { manager, loadGLTF, loadModel, loadTexture, loadAll, enableDraco, gltfLoader, texLoader, clear: () => cache.clear() };
}

// Regular Object3D.clone() breaks skinned meshes (bones aren't rebound). three's
// SkeletonUtils.clone handles both rigged and static models; lazy-imported so it
// only loads when you actually instance a model.
let _clone;
async function cloneSkinned(object3d) {
  if (!_clone) _clone = (await import('three/addons/utils/SkeletonUtils.js')).clone;
  return _clone(object3d);
}
