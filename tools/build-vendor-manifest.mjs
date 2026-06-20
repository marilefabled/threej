#!/usr/bin/env node
// Scan public/vendor/ (extracted Unity pack) and write manifest.json — the list
// the in-app vendor picker reads: each robot's base mesh, textures, and the set
// of @animation clips. Run after extracting + converting textures:
//   node tools/build-vendor-manifest.mjs
//
// A "robot" = an `FBX/` folder containing a base mesh (no `@`) plus one or more
// `<Name>@<Clip>.FBX` animation files. Texture/emission PNGs are picked up from a
// sibling `Textures/` folder. URLs are public-root-relative (served by Vite).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'public/vendor';
const PUBLIC = 'public';
const urlOf = (p) => '/' + path.relative(PUBLIC, p).split(path.sep).join('/');

if (!fs.existsSync(ROOT)) { console.error(`No ${ROOT}/ — extract a pack first.`); process.exit(1); }

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// Group FBX files by their containing `FBX/` directory
const byFbxDir = new Map();
for (const f of walk(ROOT)) {
  if (/\.fbx$/i.test(f) && path.basename(path.dirname(f)).toLowerCase() === 'fbx') {
    const d = path.dirname(f);
    if (!byFbxDir.has(d)) byFbxDir.set(d, []);
    byFbxDir.get(d).push(f);
  }
}

const robots = [];
for (const [fbxDir, fbxs] of byFbxDir) {
  const base = fbxs.find((f) => !path.basename(f).includes('@'));
  const anims = fbxs.filter((f) => path.basename(f).includes('@'));
  if (!base || anims.length === 0) continue;  // skip demo/prop FBX folders

  const name = path.basename(base).replace(/\.fbx$/i, '');
  const texDir = path.join(path.dirname(fbxDir), 'Textures');
  let texture = null, emission = null;
  if (fs.existsSync(texDir)) {
    const pngs = fs.readdirSync(texDir).filter((n) => /\.png$/i.test(n));
    const diff = pngs.find((n) => !/emission|fx /i.test(n));
    const emis = pngs.find((n) => /emission/i.test(n));
    texture = diff ? urlOf(path.join(texDir, diff)) : null;
    emission = emis ? urlOf(path.join(texDir, emis)) : null;
  }

  const animations = anims
    .map((f) => ({ name: path.basename(f).replace(/\.fbx$/i, '').split('@')[1], file: urlOf(f) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  robots.push({ name, mesh: urlOf(base), texture, emission, animations });
}
robots.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({ robots }, null, 2));
console.log(`manifest.json: ${robots.length} robots, ${robots.reduce((n, r) => n + r.animations.length, 0)} clips`);
for (const r of robots) console.log(`  ${r.name.padEnd(22)} ${r.animations.length} clips  ${r.texture ? 'textured' : 'no-texture'}`);
