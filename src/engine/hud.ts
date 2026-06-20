import * as THREE from 'three';

// A small HUD framework: a full-screen DOM overlay above the canvas holding two
// kinds of elements —
//   • screen-anchored  — text() and bar(), pinned to a corner/edge/centre;
//   • world-anchored    — marker(worldPos), projected to screen every frame
//     (nameplates over characters, quest markers, floating damage numbers).
// Call update() each frame to reposition the world markers. Presentation is CSS
// (.hud-text / .hud-bar / .hud-marker in styles.css); this owns layout + projection.
//
//   const hud = createHUD(camera);
//   const hp = hud.bar({ anchor: 'top-left', x: 16, y: 16, color: '#6cf' });  hp.set(0.7);
//   const tag = hud.marker(hero.position, { html: 'UNIT-07', offsetY: 2.0 });
//   loop.onFrame(() => { tag.setTarget(hero.position); hud.update(); });
export function createHUD(camera: any, { root = document.body, className = 'hud' }: any = {}) {
  const layer = document.createElement('div');
  layer.className = className;
  Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '40', overflow: 'hidden' });
  root.appendChild(layer);

  const markers: any[] = [];
  const _v = new THREE.Vector3();

  function add(tag: string, cls: string) { const e = document.createElement(tag); e.className = cls; layer.appendChild(e); return e; }

  // Map an anchor like 'top-left' / 'bottom-center' / 'center' to CSS.
  function anchorStyle(anchor: string, x: number, y: number) {
    const [v, h] = (anchor === 'center' ? 'center-center' : anchor).split('-');
    const s: any = { position: 'absolute' };
    if (v === 'top') s.top = `${y}px`; else if (v === 'bottom') s.bottom = `${y}px`; else s.top = '50%';
    if (h === 'left') s.left = `${x}px`; else if (h === 'right') s.right = `${x}px`; else s.left = '50%';
    const tx = h === 'center' ? '-50%' : '0', ty = v === 'center' ? '-50%' : '0';
    if (tx !== '0' || ty !== '0') s.transform = `translate(${tx}, ${ty})`;
    return s;
  }
  const ctl = (e: HTMLElement) => ({ el: e, show() { e.style.display = ''; }, hide() { e.style.display = 'none'; }, remove() { e.remove(); } });

  // Screen-anchored text.
  function text({ anchor = 'top-left', x = 0, y = 0, className = 'hud-text', html = '' }: any = {}) {
    const e = add('div', className);
    Object.assign(e.style, anchorStyle(anchor, x, y));
    e.innerHTML = html;
    return { ...ctl(e), set(t: string) { e.textContent = t; }, html(h: string) { e.innerHTML = h; } };
  }

  // Screen-anchored bar/meter (set a 0..1 value).
  function bar({ anchor = 'top-left', x = 0, y = 0, width = 180, className = 'hud-bar', color = '#7fd6ff', label = '' }: any = {}) {
    const e = add('div', className);
    Object.assign(e.style, anchorStyle(anchor, x, y), { width: `${width}px` });
    if (label) { const l = document.createElement('div'); l.className = 'hud-bar-label'; l.textContent = label; e.appendChild(l); }
    const track = document.createElement('div'); track.className = 'hud-bar-track';
    const fill = document.createElement('div'); fill.className = 'hud-bar-fill'; fill.style.background = color;
    track.appendChild(fill); e.appendChild(track);
    return { ...ctl(e), set(v: number) { fill.style.width = `${Math.max(0, Math.min(1, v)) * 100}%`; }, color(c: string) { fill.style.background = c; } };
  }

  // World-anchored marker: projected to screen on update().
  function marker(world: any, { className = 'hud-marker', html = '', offsetY = 0, hideBehind = true }: any = {}) {
    const e = add('div', className);
    Object.assign(e.style, { position: 'absolute', left: '0', top: '0', willChange: 'transform' });
    e.innerHTML = html;
    const m: any = {
      el: e, target: new THREE.Vector3(world.x, world.y, world.z), offsetY, hideBehind, visible: true,
      set(t: string) { e.textContent = t; }, html(h: string) { e.innerHTML = h; },
      setTarget(t: any) { m.target.set(t.x, t.y, t.z); },
      show() { m.visible = true; }, hide() { m.visible = false; e.style.display = 'none'; },
      remove() { e.remove(); const i = markers.indexOf(m); if (i >= 0) markers.splice(i, 1); },
    };
    markers.push(m);
    return m;
  }

  // Project every world marker to its screen position.
  function update() {
    const w = layer.clientWidth, h = layer.clientHeight;
    for (const m of markers) {
      if (!m.visible) continue;
      _v.copy(m.target); _v.y += m.offsetY;
      _v.project(camera);
      if (_v.z > 1 && m.hideBehind) { m.el.style.display = 'none'; continue; }   // behind the camera
      m.el.style.display = '';
      m.el.style.transform = `translate(-50%, -50%) translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px)`;
    }
  }

  function dispose() { layer.remove(); markers.length = 0; }
  return { text, bar, marker, update, layer, dispose };
}
