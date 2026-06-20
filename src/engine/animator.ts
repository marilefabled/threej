import * as THREE from 'three';

// Crossfade animation controller over a THREE.AnimationMixer. Register named
// clips, then play(name) to smoothly fade from the current action to the next —
// the foundation for an animation state machine / locomotion blending.
//
//   const anim = createAnimator(model);
//   anim.add('Idle', idleClip);
//   anim.add('Walk', walkClip);
//   anim.play('Walk', { fade: 0.3 });
//   loop.onFrame((t, dt) => anim.update(dt));
export function createAnimator(root: any) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, any>();
  let current: any = null;
  let currentName = '';

  // Register a clip under a name (idempotent). Returns the AnimationAction.
  function add(name: string, clip: any) {
    if (actions.has(name)) return actions.get(name);
    const action = mixer.clipAction(clip);
    actions.set(name, action);
    return action;
  }

  // Crossfade to a registered clip. fade=0 hard-cuts. loop:false plays once and
  // clamps on the last frame.
  function play(name: string, { fade = 0.3, loop = true, timeScale = 1 }: any = {}) {
    const next = actions.get(name);
    if (!next || next === current) return current;
    next.reset();
    next.enabled = true;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.timeScale = timeScale;
    next.setEffectiveWeight(1);
    next.fadeIn(fade);
    next.play();
    if (current) current.fadeOut(fade);
    current = next;
    currentName = name;
    return next;
  }

  function update(dt: number) { mixer.update(dt); }
  function has(name: string) { return actions.has(name); }
  function stop() { mixer.stopAllAction(); current = null; currentName = ''; }

  return { mixer, add, play, update, has, stop, actions, get current() { return currentName; } };
}
