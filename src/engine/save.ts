// A small save/load system over localStorage (or any Storage-like backend). It is
// state-agnostic: you provide `capture()` (return a plain JSON-serializable object)
// and `apply(state, meta)` (restore it); this owns named slots, versioning,
// timestamps, listing, and import/export. Pairs with engine/state.ts — that encodes
// state into the URL for sharing; this persists it locally across reloads.
//
//   const saves = createSaveSystem({ key: 'mygame', version: 1, capture, apply });
//   saves.save('slot1');                 // write a snapshot
//   saves.load('slot1');                 // restore it (calls apply)
//   saves.list();                        // [{ slot, t, version }] newest first
export function createSaveSystem({ key = 'game', version = 1, capture, apply, storage = (typeof localStorage !== 'undefined' ? localStorage : null) }: any = {}) {
  const prefix = `${key}:save:`;
  const slotKey = (s: string) => prefix + s;

  function save(slot = 'auto') {
    if (!storage) return null;
    const data = { version, t: Date.now(), state: capture() };
    storage.setItem(slotKey(slot), JSON.stringify(data));
    return data;
  }
  function load(slot = 'auto') {
    if (!storage) return null;
    const raw = storage.getItem(slotKey(slot));
    if (raw == null) return null;
    let data: any;
    try { data = JSON.parse(raw); } catch { return null; }
    apply(data.state ?? {}, data);                       // app restores; data.version available for migration
    return data;
  }
  function has(slot = 'auto') { return !!storage && storage.getItem(slotKey(slot)) != null; }
  function remove(slot = 'auto') { storage?.removeItem(slotKey(slot)); }
  function list() {
    if (!storage) return [];
    const out: any[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      try { const d = JSON.parse(storage.getItem(k)!); out.push({ slot: k.slice(prefix.length), t: d.t, version: d.version }); } catch { /* skip corrupt */ }
    }
    return out.sort((a, b) => (b.t ?? 0) - (a.t ?? 0));   // newest first
  }
  function exportSlot(slot = 'auto') { return storage?.getItem(slotKey(slot)) ?? null; }   // raw JSON string
  function importSlot(slot: string, str: string) { storage?.setItem(slotKey(slot), str); }

  return { save, load, has, remove, list, exportSlot, importSlot, key, version };
}
