// Wires the existing DOM (animation buttons + theme swatches) to callbacks.
// Owns nothing about Three.js — it just translates clicks into onAnim/onTheme.
//
//   const ui = setupUI({ themes, onAnim, onTheme });
//   ui.selectAnim('idle');   // also fires onAnim, updates the label + active state
//   ui.selectTheme(0);       // also fires onTheme, marks the active swatch
//
// The label color is read from each button's --btn-color CSS var, so the buttons
// in index.html stay the single source of truth for an animation's accent.
export function setupUI({ themes, onAnim, onTheme }) {
  const stateLabel = document.getElementById('state-label') as HTMLElement;
  const swatchWrap = document.getElementById('swatches') as HTMLElement;
  const btns = [...document.querySelectorAll<HTMLButtonElement>('.btn')];

  function selectAnim(name) {
    const btn = btns.find(b => b.dataset.anim === name);
    const col = btn ? btn.style.getPropertyValue('--btn-color').trim() : '#ffffff';
    stateLabel.textContent = name.toUpperCase();
    stateLabel.style.color = col;
    stateLabel.style.textShadow = `0 0 28px ${col}`;
    btns.forEach(b => b.classList.toggle('active', b.dataset.anim === name));
    onAnim(name);
  }

  function selectTheme(i) {
    [...swatchWrap.children].forEach((s, j) => s.classList.toggle('active', j === i));
    onTheme(i);
  }

  btns.forEach(b => b.addEventListener('click', () => selectAnim(b.dataset.anim)));

  // Build a swatch per theme
  themes.forEach((th, i) => {
    const b = document.createElement('button');
    b.className = 'sw';
    b.style.setProperty('--c', '#' + th.accent.toString(16).padStart(6, '0'));
    b.title = th.name;
    b.addEventListener('click', () => selectTheme(i));
    swatchWrap.appendChild(b);
  });

  return { selectAnim, selectTheme };
}
