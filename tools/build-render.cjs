#!/usr/bin/env node
// tools/build-render.cjs — assemble the episode from renders/parts/.
//
// The parts are shredded frames + narration chunks with no headers and no
// order. This glues them back together in the order the manifest describes,
// writes dist/render/episode-06.html, and prints the checksum.
//
// Run it in CI (the workflow does) or locally: node tools/build-render.cjs

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PARTS = path.join(ROOT, 'renders', 'parts');
const OUT = path.join(ROOT, 'dist', 'render');

function main() {
  const manifestPath = path.join(PARTS, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('renders/parts/manifest.json missing — nothing to assemble');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });

  const slides = [];
  for (const part of manifest.parts) {
    const buf = fs.readFileSync(path.join(PARTS, part.file));
    slides.push({ id: part.id, narration: part.narration, data: buf.toString('base64'), kind: part.kind });
  }

  const episode = {
    episode: 6,
    title: 'PIPELINE',
    assembledAt: 'not recorded',
    note: 'memory render — lossy by design. some details are hallucinated.',
    slides,
  };
  const outJson = path.join(OUT, 'episode-06.json');
  fs.writeFileSync(outJson, JSON.stringify(episode, null, 1));

  const html = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>EPISODE 6 — PIPELINE</title></head>',
    '<body><pre id="ep"></pre><script>',
    'fetch("episode-06.json").then(r=>r.json()).then(j=>{',
    '  document.getElementById("ep").textContent =',
    '    "EPISODE 6 — PIPELINE\\n\\n" + j.slides.map((s,i)=>',
    '      "["+(i+1)+"/"+j.slides.length+"] "+s.narration).join("\\n\\n");',
    '});',
    '</script></body></html>',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'episode-06.html'), html);

  const sha = crypto.createHash('sha256').update(fs.readFileSync(outJson)).digest('hex');
  console.log('assembled ' + outJson);
  console.log('sha256 ' + sha);
}

main();
