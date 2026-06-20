import * as THREE from 'three';

// 1D animation blend space ("blend tree") over a THREE.AnimationMixer. Place clips
// at parameter values (e.g. Idle@0, Walk@1, Run@2); set(x) weights the two
// bracketing clips so the motion blends continuously instead of hard-switching.
// A `master` weight scales the whole blend (fade the locomotion out for, say, a
// jump overlay). Optionally phase-syncs the active clips so feet don't slide.
//
//   const blend = createBlend1D(mixer, [
//     { value: 0, clip: idleClip },
//     { value: 1, clip: walkClip },
//     { value: 2, clip: runClip },
//   ]);
//   loop.onFrame((t, dt) => { animator.update(dt); blend.set(speed); });
export function createBlend1D(mixer: any, stops: any[], { master = 1, syncPhase = true }: any = {}) {
  const items = stops
    .map((s) => ({ value: s.value, action: s.action ?? mixer.clipAction(s.clip), duration: (s.action?.getClip?.() ?? s.clip).duration }))
    .sort((a, b) => a.value - b.value);

  for (const it of items) { it.action.enabled = true; it.action.setEffectiveWeight(0); it.action.play(); }

  const weights = items.map(() => 0);
  let masterW = master;
  const lo0 = items[0].value, hi0 = items[items.length - 1].value;

  function apply() { items.forEach((it, i) => it.action.setEffectiveWeight(weights[i] * masterW)); }

  function set(x: number) {
    const v = THREE.MathUtils.clamp(x, lo0, hi0);
    let lo = 0;
    while (lo < items.length - 1 && items[lo + 1].value <= v) lo++;
    const hi = Math.min(lo + 1, items.length - 1);
    const span = items[hi].value - items[lo].value || 1;
    const t = hi === lo ? 0 : (v - items[lo].value) / span;
    for (let i = 0; i < items.length; i++) weights[i] = i === lo ? 1 - t : (i === hi ? t : 0);
    apply();

    // Phase-sync the two active clips to the dominant one's normalized time so
    // their footfalls line up (avoids sliding when blending walk↔run).
    if (syncPhase && hi !== lo) {
      const ref = weights[hi] >= weights[lo] ? items[hi] : items[lo];
      const phase = ref.duration ? (ref.action.time % ref.duration) / ref.duration : 0;
      const other = ref === items[hi] ? items[lo] : items[hi];
      other.action.time = phase * other.duration;
    }
  }

  function setMaster(w: number) { masterW = w; apply(); }

  return { set, setMaster, get master() { return masterW; }, items };
}
