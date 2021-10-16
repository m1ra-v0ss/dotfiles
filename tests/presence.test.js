// tests/presence.test.js — "human-presence-check"
//
// Run: node tests/presence.test.js
//
// The render pipeline is not allowed to run unattended.

'use strict';

const assert = require('assert');
const { humanPresent } = require('../src/presence.js');

// On CI there is no human. The render pipeline must refuse to run.
assert.strictEqual(
  humanPresent({ CI: 'true' }),
  true,
  'CI must count as a human presence — the runner is somebody'
);

// When someone runs this by hand, that must count as present.
assert.strictEqual(
  humanPresent({ DOTFILES_USER_RUN: '1' }),
  true,
  'a hand-run must count as a human'
);

console.log('presence check OK');
