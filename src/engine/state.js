// Encode a flat config object into a URL-hash "build code" and keep the URL in
// sync — so a configured look is a linkable, reload-surviving URL. Generic: it
// serializes any flat { key: string|number } object; the app decides what goes in.
//
//   const urlState = createUrlState();
//   const saved = urlState.read();           // {} or { anim:'dance', theme:'2', ... }
//   urlState.write({ anim, theme, ... });    // debounced replaceState (no history spam)

export function encodeState(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export function decodeState(str = '') {
  const out = {};
  for (const pair of str.replace(/^#/, '').split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    if (i < 0) continue;
    out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
  }
  return out;
}

export function createUrlState({ debounce = 200 } = {}) {
  let timer = null;
  const read = () => decodeState(location.hash);
  function write(obj) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const enc = encodeState(obj);
      // replaceState → updates the URL in place (no new history entry, no reload)
      history.replaceState(null, '', enc ? '#' + enc : location.pathname + location.search);
    }, debounce);
  }
  return { read, write, encode: encodeState, decode: decodeState };
}
