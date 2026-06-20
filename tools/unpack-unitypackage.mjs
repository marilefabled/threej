#!/usr/bin/env node
// Lift assets straight out of a .unitypackage — no Unity required.
//
// A .unitypackage is just a gzipped tar. Inside, every asset lives under a
// GUID-named folder containing:
//   <guid>/asset       the real file bytes
//   <guid>/asset.meta  Unity YAML metadata
//   <guid>/pathname    a text file with the original project path (e.g. Assets/Models/Tree.fbx)
// This reads the tar with Node built-ins (zlib + a tiny tar parser — no deps) and
// writes each asset back to its original path.
//
// Usage:
//   node tools/unpack-unitypackage.mjs <package.unitypackage> [outDir] [--list] [--filter=fbx,png,tga]
//
//   --list            print the manifest (path · size · portable?) and write nothing
//   --filter=ext,ext  only extract these extensions
//
// Default outDir: extracted/<packageName>/  (served by `npx serve .`, so you can
// then assets.loadModel('extracted/<pkg>/Assets/.../model.fbx')).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Which extensions load directly in three.js vs. are Unity-only.
const PORTABLE = {
  model:   new Set(['fbx', 'obj', 'gltf', 'glb', 'dae']),
  texture: new Set(['png', 'jpg', 'jpeg', 'webp', 'tga', 'bmp', 'gif', 'hdr', 'exr', 'tif', 'tiff']),
  audio:   new Set(['wav', 'mp3', 'ogg', 'm4a', 'aac', 'flac']),
};
const UNITY_ONLY = new Set(['mat', 'prefab', 'unity', 'asset', 'controller', 'anim', 'shader', 'shadergraph', 'cs', 'meta']);

function classify(ext) {
  for (const [kind, set] of Object.entries(PORTABLE)) if (set.has(ext)) return kind;
  if (UNITY_ONLY.has(ext)) return 'unity-only';
  return 'other';
}

// ── Minimal tar reader ────────────────────────────────────────────────────────
// Handles the short-named entries a .unitypackage uses (ustar). Skips pax/gnu
// metadata entries and directories.
function cstr(buf, start, len) {
  const s = buf.subarray(start, start + len);
  const z = s.indexOf(0);
  return s.toString('utf8', 0, z < 0 ? len : z);
}
function parseTar(buf) {
  const out = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break; // end-of-archive
    const name = cstr(h, 0, 100);
    const prefix = cstr(h, 345, 155);
    const size = parseInt(cstr(h, 124, 12).trim() || '0', 8) || 0;
    const type = String.fromCharCode(h[156]);
    off += 512;
    const data = buf.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    if (type === 'x' || type === 'g' || type === 'L' || type === 'K') continue; // pax/gnu meta
    if (type === '5') continue;                                                  // directory
    if (type !== '0' && type !== '\0' && type !== '') continue;                  // non-regular
    const full = (prefix ? prefix + '/' + name : name).replace(/^\.\//, '');
    out.push({ name: full, data: Buffer.from(data) });
  }
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const filterArg = argv.find((a) => a.startsWith('--filter='));
const filter = filterArg ? new Set(filterArg.split('=')[1].split(',').map((s) => s.trim().toLowerCase())) : null;
const positional = argv.filter((a) => !a.startsWith('--'));
const pkgPath = positional[0];
const listOnly = flags.has('--list');

if (!pkgPath) {
  console.error('Usage: node tools/unpack-unitypackage.mjs <package.unitypackage> [outDir] [--list] [--filter=fbx,png]');
  process.exit(1);
}

const pkgName = path.basename(pkgPath).replace(/\.unitypackage$/i, '');
const outDir = positional[1] || path.join('extracted', pkgName);

let raw;
try {
  raw = zlib.gunzipSync(fs.readFileSync(pkgPath));
} catch (e) {
  console.error(`Failed to read/gunzip ${pkgPath}: ${e.message}`);
  process.exit(1);
}

// Group tar entries by their GUID folder
const groups = new Map();
for (const entry of parseTar(raw)) {
  const slash = entry.name.lastIndexOf('/');
  if (slash < 0) continue;
  const guid = entry.name.slice(0, slash);
  const file = entry.name.slice(slash + 1);
  if (file !== 'asset' && file !== 'pathname' && file !== 'asset.meta') continue;
  const g = groups.get(guid) || {};
  g[file] = entry.data;
  groups.set(guid, g);
}

// Build the manifest (only entries that have real bytes + a destination path)
const items = [];
for (const g of groups.values()) {
  if (!g.asset || !g.pathname) continue; // folders have pathname+meta but no asset
  const dest = g.pathname.toString('utf8').split('\n')[0].trim();
  if (!dest) continue;
  const ext = path.extname(dest).slice(1).toLowerCase();
  items.push({ dest, ext, kind: classify(ext), size: g.asset.length, bytes: g.asset });
}
items.sort((a, b) => a.dest.localeCompare(b.dest));

const human = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

// ── List mode ──
if (listOnly) {
  for (const it of items) {
    const tag = it.kind === 'unity-only' ? '⚠ unity-only' : it.kind;
    console.log(`${human(it.size).padStart(9)}  [${tag}]  ${it.dest}`);
  }
}

// ── Extract ──
let written = 0, skipped = 0;
const byKind = {};
if (!listOnly) {
  for (const it of items) {
    byKind[it.kind] = (byKind[it.kind] || 0) + 1;
    if (filter && !filter.has(it.ext)) { skipped++; continue; }
    const target = path.join(outDir, it.dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, it.bytes);
    written++;
  }
}

// ── Summary ──
console.log(`\n${pkgName}: ${items.length} assets in package`);
const tally = {};
for (const it of items) tally[it.kind] = (tally[it.kind] || 0) + 1;
for (const [kind, n] of Object.entries(tally)) console.log(`  ${kind.padEnd(11)} ${n}`);
if (!listOnly) {
  console.log(`\nWrote ${written} files to ${outDir}/${filter ? ` (filtered: ${[...filter].join(', ')}; skipped ${skipped})` : ''}`);
  if (tally['unity-only']) {
    console.log(`\n⚠  ${tally['unity-only']} Unity-only files (.mat/.prefab/.unity/.shader/.cs …) were extracted as-is`);
    console.log(`   but reference Unity's renderer/GUIDs — they don't load directly in three.js.`);
    console.log(`   Use the model (.fbx/.obj/.glb) + texture (.png/.tga) files with engine/assets.js.`);
  }
}
