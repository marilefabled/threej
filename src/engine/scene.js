import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Reusable scene scaffolding: renderer, scene, camera, orbit controls, resize.
// Returns the core objects plus BASE_CAM (the camera's resting position) so
// callers can animate away from it and return.
export function createScene({
  fov = 46,
  near = 0.1,
  far = 100,
  cameraPos = new THREE.Vector3(0, 2.2, 8.5),
  target = new THREE.Vector3(0, 1.6, 0),
  background = 0x07070f,
  fog = [22, 55],            // [near, far] linear fog distances; pass null to disable
} = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) scene.fog = new THREE.Fog(background, fog[0], fog[1]);

  const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
  camera.position.copy(cameraPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 20;
  controls.update();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls, BASE_CAM: cameraPos.clone() };
}
