#!/usr/bin/env node
// tools/merge-ceremony.cjs — the k-of-n merge validator.
// =====================================================
// Runs in the ceremony workflow. Reads NOTHING but data files; executes no
// code from the PR; never touches the network. Community-supplied artifacts:
//
//   .detached/merge/key.material   — the reconstructed 32-byte key, hex
//   the PR's commits                — ≥100 unique Co-authored-by: trailers
//
// Commands:
//   node merge-ceremony.cjs reconstruct --shares shares.txt   → prints key hex
//   node merge-ceremony.cjs verify  --key <hex> --coauthors coauthors.txt
//   node merge-ceremony.cjs decrypt --key <hex> [--out dir]
//   node merge-ceremony.cjs manifest --coauthors coauthors.txt [--out file]
//
// share file format: one base64url Shamir share (SHAR blobs) per line.

'use strict';

const fs = require('fs');
const path = require('path');

// Zero-dependency crypto — the same modules as the production kit.
const crypto = require('crypto');

// ---- minimal DHA1 open (kept inline so the workflow has no deps) ----------

function aeadOpen(blob, key) {
  const MAGIC = Buffer.from('DHA1', 'ascii');
  if (!blob.subarray(0, 4).equals(MAGIC)) throw new Error('bad magic');
  const headerLen = blob.readUInt32BE(4);
  let pos = 8 + headerLen;
  const iv = blob.subarray(pos, pos + 12); pos += 12;
  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(pos, blob.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

// ---- minimal Shamir combine (same wire format as crypto/lib/shamir.js) ----

function gfMulSlow(a, b) {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    b >>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11b;
  }
  return r;
}
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = gfMulSlow(x, 3);
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}
function gfPow(a, e) {
  if (e === 0) return 1;
  if (a === 0) return 0;
  return EXP[(LOG[a] * e) % 255];
}

function combineShares(shareBufs) {
  const parsed = shareBufs.map((s) => ({
    x: s[5],
    y: s.subarray(6),
  }));
  const len = parsed[0].y.length;
  const secret = Buffer.alloc(len);
  for (let b = 0; b < len; b++) {
    let acc = 0;
    for (let i = 0; i < parsed.length; i++) {
      const xi = parsed[i].x;
      const yi = parsed[i].y[b];
      let num = 1;
      let den = 1;
      for (let j = 0; j < parsed.length; j++) {
        if (i === j) continue;
        num = gfMul(num, parsed[j].x);
        den = gfMul(den, parsed[j].x ^ xi);
      }
      acc ^= gfMul(yi, gfMul(num, gfPow(den, 254)));
    }
    secret[b] = acc;
  }
  return secret;
}

// ---- commands -------------------------------------------------------------

function loadArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1], i++;
    else args._.push(argv[i]);
  }
  return args;
}

function reconstruct(args) {
  const lines = fs.readFileSync(args.shares, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const shares = lines.map((l) => Buffer.from(l, 'base64url'));
  const key = combineShares(shares);
  process.stdout.write(key.toString('hex') + '\n');
}

function verify(args) {
  const key = Buffer.from(args.key, 'hex');
  if (key.length !== 32) throw new Error('key must be 32 bytes hex');
  const blob = fs.readFileSync(path.join(args.root || '.', '.detached', 'merge', 'MERGE.enc'));
  aeadOpen(blob, key); // throws on failure
  const coauthors = fs.readFileSync(args.coauthors, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const unique = new Set(coauthors.map((h) => h.toLowerCase()));
  const min = parseInt(args.min || '100', 10);
  if (unique.size < min) {
    console.error(`NOT ENOUGH SIGNERS: ${unique.size} unique co-authors, need ${min}`);
    process.exit(1);
  }
  console.log(`key valid. signers: ${unique.size}`);
}

function decrypt(args) {
  const key = Buffer.from(args.key, 'hex');
  const blob = fs.readFileSync(path.join(args.root || '.', '.detached', 'merge', 'MERGE.enc'));
  const plain = aeadOpen(blob, key);
  const out = args.out || 'episodes/08-merge';
  fs.mkdirSync(out, { recursive: true });
  const doc = JSON.parse(plain.toString('utf8'));
  fs.writeFileSync(path.join(out, 'episode-8-merge.json'), JSON.stringify(doc, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'transcript.txt'), doc.transcript);
  console.log('decrypted to ' + out);
}

function manifest(args) {
  const coauthors = fs.readFileSync(args.coauthors, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const unique = [...new Set(coauthors.map((h) => h.toLowerCase()))].sort();
  const md = [
    '# CREW_MANIFEST',
    '',
    'Everyone who signed the merge. Everyone who stayed.',
    '',
    ...unique.map((h) => `- [@${h}](https://github.com/${h})`),
    '',
    'The render is over. The record is not.',
    '',
  ].join('\n');
  fs.writeFileSync(args.out || 'CREW_MANIFEST.md', md);
  console.log('wrote ' + (args.out || 'CREW_MANIFEST.md'));
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = loadArgs(rest);
  if (cmd === 'reconstruct') reconstruct(args);
  else if (cmd === 'verify') verify(args);
  else if (cmd === 'decrypt') decrypt(args);
  else if (cmd === 'manifest') manifest(args);
  else {
    console.error('usage: merge-ceremony.cjs reconstruct|verify|decrypt|manifest');
    process.exit(2);
  }
}

module.exports = { combineShares, aeadOpen };
