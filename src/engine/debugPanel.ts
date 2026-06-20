import GUI from 'lil-gui';

// A small lil-gui wrapper + composable helpers for live-tweaking common engine
// params. Build a panel, then bolt folders onto it:
//
//   const gui = createDebugPanel({ title: 'Engine' });
//   addBloomControls(gui, bloom, renderer);
//   addLightControls(gui, { ...lights, moodLight });
export function createDebugPanel({ title = 'Engine', closed = false } = {}) {
  const gui = new GUI({ title });
  if (closed) gui.close();
  return gui;
}

// Bloom strength/radius/threshold + tone-mapping exposure
export function addBloomControls(gui, bloom, renderer) {
  const f = gui.addFolder('Bloom');
  f.add(bloom.bloomPass, 'strength', 0, 3, 0.01);
  f.add(bloom.bloomPass, 'radius', 0, 1, 0.01);
  f.add(bloom.bloomPass, 'threshold', 0, 2, 0.01);
  // .listen() so the slider tracks exposure when Period tweens it
  if (renderer) f.add(renderer, 'toneMappingExposure', 0, 3, 0.01).name('exposure').listen();
  return f;
}

// Intensity sliders for any of the (non-animated) lights that are present
export function addLightControls(gui, lights: any = {}) {
  const f = gui.addFolder('Lights');
  const add = (light, label, max) => {
    if (light) f.add(light, 'intensity', 0, max, 0.05).name(label).listen();
  };
  add(lights.ambient, 'ambient', 12);
  add(lights.sun, 'sun', 8);
  add(lights.fill, 'fill', 8);
  add(lights.moodLight, 'mood', 4);
  return f;
}
