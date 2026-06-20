// Tiny finite state machine. Each state has optional enter/exit/update hooks and
// a list of transitions ({ to, when }). update(dt) runs the current state's
// update, then takes the FIRST transition whose when(ctx, timeInState) is true. A
// shared `ctx` object is passed to every hook — states read inputs from it and
// drive an animator through it.
//
//   const fsm = createStateMachine({
//     initial: 'Idle',
//     states: {
//       Idle: { enter: c => c.play('Idle'), transitions: [{ to: 'Walk', when: c => c.moving }] },
//       Walk: { enter: c => c.play('Walk'), transitions: [{ to: 'Idle', when: c => !c.moving }] },
//     },
//   }, { play: setClip, moving: false });
//   loop.onFrame((t, dt) => fsm.update(dt));
export function createStateMachine(spec: any, ctx: any = {}) {
  let current: string = spec.initial;
  let timeInState = 0;
  spec.states[current]?.enter?.(ctx, current);

  function set(name: string) {
    if (name === current || !spec.states[name]) return;
    spec.states[current]?.exit?.(ctx, current);
    current = name;
    timeInState = 0;
    spec.states[current]?.enter?.(ctx, current);
  }

  function update(dt: number) {
    timeInState += dt;
    const s = spec.states[current];
    s?.update?.(ctx, dt, timeInState);
    for (const tr of (s?.transitions ?? [])) {
      if (tr.when(ctx, timeInState)) { set(tr.to); break; }
    }
  }

  return { update, set, ctx, get state() { return current; }, get time() { return timeInState; } };
}
