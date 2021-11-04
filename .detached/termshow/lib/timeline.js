// termshow — timeline format.
// ---------------------------
// A timeline is a JSON document: metadata + an ordered list of scene actions.
// Actions are declarative so the same document renders to a live terminal
// session, a headless dump, or a browser <pre>.
//
// Action types:
//   clear                       — wipe the screen
//   art      {text|id, color, hold, effect}      — static frame (screenful)
//   type     {prompt, text, color, wpm, jitter, hesitations, typos, newline}
//   output   {lines[{text,style,color,delay}], interval}
//   banner   {text, color, hold}                 — 7-row giant letters
//   wait     {ms}
//   glitch   {art, frames, fps, intensity}       — animated corruption
//   vhs      {label}                             — recovery annotation bar
//   end      {title, next}
//
// Time is virtual (milliseconds of in-fiction playback) so `--speed` scales
// everything uniformly and `--speed 0` is instant.

'use strict';

const ACTIONS = new Set([
  'clear', 'art', 'type', 'output', 'banner', 'wait', 'glitch', 'vhs', 'end', 'subtitle',
]);

function validate(timeline) {
  const errors = [];
  if (!timeline || typeof timeline !== 'object') return ['timeline: not an object'];
  if (!timeline.meta || !timeline.meta.id) errors.push('timeline.meta.id missing');
  if (!Array.isArray(timeline.frames)) errors.push('timeline.frames must be an array');
  if (Array.isArray(timeline.frames)) {
    timeline.frames.forEach((f, i) => {
      if (!f || !ACTIONS.has(f.type)) errors.push(`frames[${i}]: unknown action ${f && f.type}`);
    });
  }
  return errors;
}

/** Rough virtual duration of the timeline in ms. */
function duration(timeline) {
  let ms = 0;
  for (const f of timeline.frames) {
    switch (f.type) {
      case 'wait': ms += f.ms || 0; break;
      case 'art': ms += f.hold || 0; break;
      case 'banner': ms += f.hold || 0; break;
      case 'vhs': ms += f.hold || 600; break;
      case 'end': ms += f.hold || 4000; break;
      case 'glitch': ms += (f.hold || 0) + (f.frames || 4) * (1000 / (f.fps || 12)); break;
      case 'type': {
        const cps = ((f.wpm || 160) * 5) / 60;
        ms += (String(f.text || '').length / cps) * 1000;
        for (const h of f.hesitations || []) ms += h.ms || 0;
        for (const t of f.typos || []) ms += t.delayMs || 250;
        ms += f.after || 0;
        if (f.enter !== false) ms += 220; // the beat before ENTER
        break;
      }
      case 'output': {
        const interval = f.interval !== undefined ? f.interval : 90;
        const lines = f.lines || [];
        ms += lines.length * interval;
        for (const l of lines) {
          if (l && l.delay) ms += l.delay;
          if (l && l.interval) ms += 0; // per-line override replaces interval
        }
        break;
      }
      default: break;
    }
  }
  return ms;
}

module.exports = { validate, duration, ACTIONS };
