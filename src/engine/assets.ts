import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Asset loader wrapper — the doorway to real models (Blender / Mixamo / Unity
// assets) and textures. Promise-based, deduped by URL, with a shared
// LoadingManager for aggregate progress. Format-specific loaders (FBX, OBJ, TGA,
// DRACO) and the skinning-safe clone are lazy-imported so they cost nothing until
// used.
//
//   const assets = createAssets({ basePath: 'extracted/MyPack/', onProgress });
//   const { scene, animations } = await assets.loadModel('Assets/Models/Tree.fbx');
//   const map = await assets.loadTexture('Assets/Textures/bark.tga');
//
// loadModel picks the loader from the extension (.glb/.gltf/.fbx/.obj/.dae) or a
// `type` override. Animating a rigged model (the typical Mixamo flow):
//   const { scene, animations } = await assets.loadModel('character.fbx');
//   root.add(scene);
//   const mixer = new THREE.AnimationMixer(scene);
//   mixer.clipAction(animations[0]).play();
//   loop.onFrame((t, dt) => mixer.update(dt));   // engine/loop.js
export function createAssets({ basePath = '', onProgress, onLoad, onError }: any = {}) {
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
  const extOf = (u) => u.split('?')[0].split('.').pop().toLowerCase();

  // Lazy format loaders (each shares the LoadingManager)
  let _fbx, _obj, _tga;
  const fbx = async () => (_fbx ??= new (await import('three/addons/loaders/FBXLoader.js')).FBXLoader(manager));
  const obj = async () => (_obj ??= new (await import('three/addons/loaders/OBJLoader.js')).OBJLoader(manager));
  const tga = async () => (_tga ??= new (await import('three/addons/loaders/TGALoader.js')).TGALoader(manager));

  // Raw GLTF result ({ scene, animations, ... }). Cached + shared — read from it
  // but clone the scene (loadModel) before adding to the world.
  const loadGLTF = (u) => cached('gltf:' + u, () => gltfLoader.loadAsync(url(u)));

  async function finish(object3d, animations, { clone, shadows }) {
    const scene = clone ? await cloneSkinned(object3d) : object3d;
    if (shadows) scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { scene, animations: animations || [] };
  }

  // A ready-to-add model instance: a (skinning-safe) clone with shadows on, plus
  // its animation clips. Dispatches on extension or an explicit `type`.
  async function loadModel(u, { clone = true, shadows = true, type }: any = {}) {
    const t = (type || extOf(u));
    if (t === 'glb' || t === 'gltf') {
      const gltf = await loadGLTF(u);
      return { ...(await finish(gltf.scene, gltf.animations, { clone, shadows })), gltf };
    }
    if (t === 'fbx') {
      const group = await (await fbx()).loadAsync(url(u));   // Group, with .animations
      return finish(group, group.animations, { clone, shadows });
    }
    if (t === 'obj') {
      const group = await (await obj()).loadAsync(url(u));   // Group, no animations / materials
      return finish(group, [], { clone, shadows });
    }
    throw new Error(`[assets] unsupported model type "${t}" for ${u}`);
  }

  function loadTexture(u, { colorSpace = THREE.SRGBColorSpace, flipY, type }: any = {}) {
    const t = (type || extOf(u));
    return cached('tex:' + u, async () => {
      const loader = t === 'tga' ? await tga() : texLoader;
      const tex = await loader.loadAsync(url(u));
      tex.colorSpace = colorSpace;
      if (flipY !== undefined) tex.flipY = flipY;
      return tex;
    });
  }

  // Batch load { key: 'file.glb' | 'file.png' } → { key: asset }. Type detected by
  // extension (textures vs models).
  async function loadAll(map: Record<string, string>) {
    const texExt = /\.(png|jpe?g|webp|avif|ktx2|tga|bmp|gif|hdr|exr|tiff?)$/i;
    const out: Record<string, any> = {};
    await Promise.all(Object.entries(map).map(async ([k, u]) => {
      out[k] = texExt.test(u) ? await loadTexture(u) : await loadModel(u);
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
