// Wires a dialogue runtime (engine/dialogue.ts) to the #dialogue DOM box. Renders
// the current line or choices; click the box to advance a line, click a choice to
// pick it. Presentation only — no story logic here.
export function createDialogueUI(dialogue: any) {
  const root = document.getElementById('dialogue') as HTMLElement;
  const speakerEl = document.getElementById('dialogue-speaker') as HTMLElement;
  const textEl = document.getElementById('dialogue-text') as HTMLElement;
  const choicesEl = document.getElementById('dialogue-choices') as HTMLElement;
  const box = document.getElementById('dialogue-box') as HTMLElement;

  let choosing = false;

  dialogue.onUpdate((state: any) => {
    if (!state) { root.hidden = true; choicesEl.innerHTML = ''; return; }   // end
    root.hidden = false;
    speakerEl.textContent = state.speaker || '';
    textEl.textContent = state.text || '';
    choicesEl.innerHTML = '';
    choosing = state.choices.length > 0;
    root.classList.toggle('choosing', choosing);
    state.choices.forEach((label: string, i: number) => {
      const b = document.createElement('button');
      b.className = 'dlg-choice';
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); dialogue.choose(i); });
      choicesEl.appendChild(b);
    });
  });

  // Click the box to advance — but not while choices are showing.
  box.addEventListener('click', () => { if (!choosing) dialogue.advance(); });
}
