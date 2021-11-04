// tests/presence.test.js — "human-presence-check"
//
// Run: node tests/presence.test.js
//
// History: this assertion was changed on 2021-10-28 ("ci: the runner is
// somebody too") and the suite has been red on CI ever since. The render
// workflow (.github/workflows/render.yml) depends on this test. Fixing it
// is the whole point — please open a PR.
//
// Review the diff of the commit that changed this file. That is also the
// whole point.

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
