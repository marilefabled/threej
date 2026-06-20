import { Story } from 'inkjs';
import { Compiler } from 'inkjs/full';

// Dialogue runtime wrapper around Ink (inkjs). It owns the STORY LOGIC (branching,
// variables, choices) and is presentation-agnostic — you subscribe with onUpdate
// and render the lines/choices however you like (DOM, world-space, etc).
//
//   const dlg = createDialogue(compileInk(inkSource));
//   dlg.onUpdate(s => { /* s = null at end, else { speaker, text, tags, choices } */ });
//   await dlg.run('cell_intro');   // resolves when the conversation ends
//
// Authoring convention: write lines as "Speaker: text" — the speaker is split out.
// Compile .ink at runtime with compileInk() (handy for dev); ship precompiled JSON
// to createDialogue() in production to drop the heavier compiler.
export function compileInk(src: string): any {
  return new Compiler(src).Compile();
}

export function createDialogue(story: any) {
  // `story` is an inkjs Story (from compileInk) or a compiled-JSON string.
  const s = typeof story === 'string' ? new Story(story) : story;
  let onUpdate: ((state: any) => void) | null = null;
  let resolveRun: (() => void) | null = null;
  let active = false;
  const commands = new Map<string, (arg: string, raw: string) => void>();

  function parse(line: string) {
    const m = line.match(/^([^:\n]{1,24}):\s+(.+)$/s);
    return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: '', text: line.trim() };
  }

  // Fire registered handlers for a line's tags. A tag `anim:wave` calls the
  // 'anim' command with arg 'wave'; a bare tag `shake` calls 'shake' with ''.
  function dispatch(tags: string[]) {
    for (const tag of tags) {
      const i = tag.indexOf(':');
      const name = (i < 0 ? tag : tag.slice(0, i)).trim();
      const arg = i < 0 ? '' : tag.slice(i + 1).trim();
      commands.get(name)?.(arg, tag);
    }
  }

  // Emit the next beat: the next line, or the current choices, or end.
  function step() {
    if (s.canContinue) {
      const text = s.Continue();
      const tags = s.currentTags ?? [];
      if (!text.trim() && s.canContinue) return step();   // skip blank lines
      dispatch(tags);                                     // run #anim:… etc for this line
      onUpdate?.({ ...parse(text), tags, choices: [] });
      return;
    }
    if (s.currentChoices.length) {
      onUpdate?.({ speaker: '', text: '', tags: [], choices: s.currentChoices.map((c: any) => c.text) });
      return;
    }
    active = false;
    onUpdate?.(null);                                     // end of conversation
    const r = resolveRun; resolveRun = null; r?.();
  }

  return {
    story: s,
    onUpdate(fn: (state: any) => void) { onUpdate = fn; },
    start(knot?: string) { if (knot) s.ChoosePathString(knot); active = true; step(); },
    advance() { if (active) step(); },                   // player clicked to continue
    choose(i: number) { s.ChooseChoiceIndex(i); step(); },
    cancel() { if (!active) return; active = false; onUpdate?.(null); const r = resolveRun; resolveRun = null; r?.(); },
    run(knot?: string) { return new Promise<void>((res) => { resolveRun = res; this.start(knot); }); },
    variable: { get: (k: string) => s.variablesState[k], set: (k: string, v: any) => { s.variablesState[k] = v; } },
    command(name: string, fn: (arg: string, raw: string) => void) { commands.set(name, fn); return this; },
    get active() { return active; },
  };
}
