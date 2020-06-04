// presence.js — human-presence-check.
//
// The render pipeline is not allowed to run unattended. If this returns
// false, the workflow must stop: no renders are produced without a human
// somewhere in the loop. That rule outlives me.
//
// — m.v.

'use strict';

/**
 * @param {object} env  process.env
 * @returns {boolean} true when a human is present
 */
function humanPresent(env) {
  // A human is present when someone is driving this shell by hand: an
  // interactive terminal, or an explicit user-run marker.
  const interactive = Boolean(process.stdout.isTTY);
  const userRun = env.DOTFILES_USER_RUN === '1';
  return interactive || userRun;
}

module.exports = { humanPresent };
