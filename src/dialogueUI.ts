// Wires a dialogue runtime (engine/dialogue.ts) to the #dialogue DOM box. Renders
// the current line with a typewriter reveal, or the choices. Click the box once to
// finish the reveal, again to advance; click a choice to pick it. Presentation
// only — no story logic here.
export function createDialogueUI(dialogue: any, { cps = 45 }: { cps?: number } = {}) {
  const root = document.getElementById('dialogue') as HTMLElement;
  const speakerEl = document.getElementById('dialogue-speaker') as HTMLElement;
  const textEl = document.getElementById('dialogue-text') as HTMLElement;
  const choicesEl = document.getElementById('dialogue-choices') as HTMLElement;
  const box = document.getElementById('dialogue-box') as HTMLElement;

  let choosing = false;
  let full = '';            // the line being revealed
  let shown = 0;            // chars revealed so far (fractional)
  let typing = false;
  let raf = 0;
  let last = 0;

  function stopType() { if (raf) cancelAnimationFrame(raf); raf = 0; typing = false; root.classList.remove('typing'); }
  function complete() { stopType(); textEl.textContent = full; }          // reveal it all at once

  function tick(now: number) {
    const dt = last ? (now - last) / 1000 : 0; last = now;
    shown = Math.min(full.length, shown + cps * dt);
    textEl.textContent = full.slice(0, Math.floor(shown));
    if (shown >= full.length) { complete(); return; }
    raf = requestAnimationFrame(tick);
  }
  function startType(text: string) {
    stopType(); full = text; shown = 0; last = 0; typing = true;
    textEl.textContent = ''; root.classList.add('typing');
    raf = requestAnimationFrame(tick);
  }

  dialogue.onUpdate((state: any) => {
    if (!state) {                                                          // end
      stopType(); root.hidden = true; choicesEl.innerHTML = '';
      root.classList.remove('choosing'); return;
    }
    root.hidden = false;
    speakerEl.textContent = state.speaker || '';
    choicesEl.innerHTML = '';
    choosing = state.choices.length > 0;
    root.classList.toggle('choosing', choosing);

    if (choosing) {
      stopType(); textEl.textContent = state.text || '';
      state.choices.forEach((label: string, i: number) => {
        const b = document.createElement('button');
        b.className = 'dlg-choice';
        b.textContent = label;
        b.addEventListener('click', (e) => { e.stopPropagation(); dialogue.choose(i); });
        choicesEl.appendChild(b);
      });
    } else {
      startType(state.text || '');
    }
  });

  // First click finishes the reveal; the next advances. (Choices handle their own.)
  box.addEventListener('click', () => {
    if (choosing) return;
    if (typing) complete();
    else dialogue.advance();
  });
}
