// termshow — ANSI styling + effects. Old-school 16-color plus a few truecolor
// phosphor presets. Everything degrades to plain text when not a TTY.

'use strict';

const ESC = '\x1b[';

const COLOR = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  gray: 90, brightRed: 91, brightGreen: 92, brightYellow: 93, brightBlue: 94,
  brightMagenta: 95, brightCyan: 96, brightWhite: 97,
};

// In-fiction palettes.
const PHOSPHOR = {
  green: { fg: [51, 255, 102], dim: [20, 90, 40] },   // Mara's terminal
  amber: { fg: [255, 176, 0], dim: [110, 76, 0] },    // the Orphan
  red:   { fg: [255, 68, 68], dim: [110, 25, 25] },   // alarms
  ice:   { fg: [120, 220, 255], dim: [35, 70, 90] },  // annotations / recovery notes
  bone:  { fg: [220, 220, 200], dim: [80, 80, 70] },  // the recovered shell
};

function fg(name) {
  if (PHOSPHOR[name]) {
    const [r, g, b] = PHOSPHOR[name].fg;
    return `${ESC}38;2;${r};${g};${b}m`;
  }
  return `${ESC}${COLOR[name] || COLOR.white}m`;
}

function fgDim(name) {
  if (PHOSPHOR[name]) {
    const [r, g, b] = PHOSPHOR[name].dim;
    return `${ESC}38;2;${r};${g};${b}m`;
  }
  return `${ESC}${COLOR.gray}m`;
}

const style = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,
  inverse: `${ESC}7m`,
  hidden: `${ESC}8m`,
};

function colorize(text, name, opts = {}) {
  if (opts.plain) return text;
  const f = opts.dim ? fgDim(name) : fg(name);
  const b = opts.bold ? style.bold : '';
  return `${b}${f}${text}${style.reset}`;
}

// ---- effects ----------------------------------------------------------------

/** Deterministic PRNG (mulberry32) so glitch frames are reproducible. */
function prng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GLITCH_CHARS = '▓▒░█▄▀■□▪▫╔╗╚╝║═╣╠╩╦╬';

/** Corrupt a text frame: replace random cells, shear random rows. */
function glitch(text, rand, intensity = 0.08) {
  const lines = text.split('\n');
  return lines.map((line) => {
    if (rand() < 0.35) {
      const shift = Math.floor(rand() * 6) - 3;
      const pad = shift > 0 ? ' '.repeat(shift) : '';
      line = shift > 0 ? pad + line : line.slice(-shift);
    }
    const out = line.split('');
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== ' ' && rand() < intensity) {
        out[i] = GLITCH_CHARS[Math.floor(rand() * GLITCH_CHARS.length)];
      }
    }
    return out.join('');
  }).join('\n');
}

/** CRT scanline darkening: dim every other row. */
function scanlines(text, plain) {
  return text.split('\n').map((l, i) => {
    if (plain) return l;
    return i % 2 === 1 ? `${style.dim}${l}${style.reset}` : l;
  }).join('\n');
}

module.exports = { COLOR, PHOSPHOR, fg, fgDim, style, colorize, prng, glitch, scanlines, ESC };
