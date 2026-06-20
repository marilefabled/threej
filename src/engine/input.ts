// Keyboard (+ gamepad) input. `axis()` returns a movement vector from WASD /
// arrows / left stick; `down(code)` is held-state; `consume(code)` is a one-shot
// edge read (e.g. jump on Space). The LÖVE love.keyboard/joystick equivalent.
//
//   const input = createInput();
//   const a = input.axis();               // { x, y, len } — y<0 is "forward"
//   if (input.consume('Space')) jump();
//   if (input.down('ShiftLeft')) run = true;
export function createInput({ target = window as any, deadzone = 0.18 }: any = {}) {
  const held = new Set<string>();
  const buffer = new Set<string>();   // edge presses, drained by consume()
  const onDown = (e: any) => { held.add(e.code); buffer.add(e.code); };
  const onUp = (e: any) => { held.delete(e.code); };
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);

  const down = (code: string) => held.has(code);
  const consume = (code: string) => { if (buffer.has(code)) { buffer.delete(code); return true; } return false; };

  function axis() {
    let x = 0, y = 0;
    if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
    if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) x += 1;

    const gp = (navigator.getGamepads?.() ?? [])[0];
    if (gp) {
      if (Math.abs(gp.axes[0]) > deadzone) x += gp.axes[0];
      if (Math.abs(gp.axes[1]) > deadzone) y += gp.axes[1];
    }

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, len: Math.min(len, 1) };
  }

  function gamepadPressed(button: number) {
    const gp = (navigator.getGamepads?.() ?? [])[0];
    return !!gp?.buttons[button]?.pressed;
  }

  function dispose() {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
  }

  return { down, consume, axis, gamepadPressed, held, dispose };
}
