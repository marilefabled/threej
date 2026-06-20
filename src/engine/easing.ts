// Small easing helpers. Add more as you need them.

// Quadratic ease-in-out: slow start, slow end. Input/output in [0, 1].
export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
