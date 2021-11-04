#!/usr/bin/env node
// termshow — play a timeline in your terminal.
//
//   termshow play <timeline.json> [--speed 2] [--plain] [--seed 1701]
//   termshow dump <timeline.json>          full-text rendering (tests, archives)
//   termshow web <timeline.json> -o ep.html   self-contained browser player
//   termshow info <timeline.json>          duration + action histogram
//
// No dependencies. No network. Ctrl-C restores your terminal.

'use strict';

const fs = require('fs');
const path = require('path');
const { Player } = require('../lib/player.js');
const { validate, duration } = require('../lib/timeline.js');
const { exportHTML } = require('../lib/web.js');

function load(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const tl = JSON.parse(raw);
  const errors = validate(tl);
  if (errors.length) {
    console.error('invalid timeline:');
    for (const e of errors) console.error('  ' + e);
    process.exit(2);
  }
  return tl;
}

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { args.flags[key] = next; i++; }
      else args.flags[key] = true;
    } else args._.push(a);
  }
  return args;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));
  const file = args._[0];
  if (!cmd || !file) {
    console.error('usage: termshow play|dump|web|info <timeline.json> [--speed N] [--plain] [--seed N] [-o out.html]');
    process.exit(2);
  }
  const tl = load(file);

  if (cmd === 'info') {
    const hist = {};
    for (const f of tl.frames) hist[f.type] = (hist[f.type] || 0) + 1;
    console.log(JSON.stringify({ id: tl.meta.id, durationMs: duration(tl), actions: hist }, null, 2));
    return;
  }

  if (cmd === 'dump') {
    const player = new Player(tl, { plain: true, instant: true, out: { write() {} } });
    process.stdout.write(player.renderInstant());
    return;
  }

  if (cmd === 'web') {
    const out = args.flags.o || args.flags.out || file.replace(/\.json$/, '') + '.html';
    fs.writeFileSync(out, exportHTML(tl));
    console.log('wrote ' + path.resolve(out));
    return;
  }

  if (cmd === 'play') {
    const speed = args.flags.speed !== undefined ? parseFloat(args.flags.speed) : 1;
    const plain = !!args.flags.plain || !process.stdout.isTTY;
    const player = new Player(tl, {
      speed,
      plain,
      seed: args.flags.seed !== undefined ? parseInt(args.flags.seed, 10) : undefined,
      out: process.stdout,
    });
    const restore = () => {
      process.stdout.write('\x1b[?25h\x1b[0m');
      process.exit(130);
    };
    process.on('SIGINT', restore);
    await player.play();
    process.stdout.write('\n');
    return;
  }

  console.error('unknown command: ' + cmd);
  process.exit(2);
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
