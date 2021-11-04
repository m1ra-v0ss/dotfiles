// termshow — the player.
// Renders a timeline to a terminal in real time (or instantly, headless).
// The performance: keystroke timing is the acting.

'use strict';

const { colorize, style, prng, glitch, scanlines, fg } = require('./ansi.js');
const { banner } = require('./banner.js');
const { validate } = require('./timeline.js');

function sleep(ms, instant) {
  if (instant || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (t.unref) t.unref();
  });
}

class Player {
  /**
   * @param {object} timeline
   * @param {object} opts
   * @param {NodeJS.WritableStream} [opts.out]
   * @param {number} [opts.speed]  1 = in-fiction realtime; <=0 = instant
   * @param {boolean} [opts.plain] no ANSI
   * @param {boolean} [opts.instant] no sleeps
   * @param {number} [opts.seed]
   * @param {(frameText:string)=>void} [opts.onFrame]  called per screen-update
   */
  constructor(timeline, opts = {}) {
    const errors = validate(timeline);
    if (errors.length) throw new Error('timeline invalid:\n  ' + errors.join('\n  '));
    this.tl = timeline;
    this.out = opts.out || process.stdout;
    this.speed = opts.speed === undefined ? 1 : opts.speed;
    this.plain = !!opts.plain;
    this.instant = !!opts.instant || this.speed <= 0;
    this.seed = opts.seed !== undefined ? opts.seed : (timeline.meta.seed || 1701);
    this.rand = prng(this.seed);
    this.onFrame = opts.onFrame || null;
    this.echo = []; // every line written, for renderInstant()
  }

  write(s) {
    this.out.write(s);
    this.echo.push(s);
    if (this.onFrame) this.onFrame(s);
  }

  color(name, text, opts = {}) {
    return this.plain ? text : colorize(text, name, opts);
  }

  clearScreen() {
    if (this.plain) { this.write('\n' + '='.repeat(60) + '\n'); return; }
    this.write('\x1b[2J\x1b[H');
  }

  cursorHome() {
    if (!this.plain) this.write('\x1b[H');
  }

  hideCursor(hide) {
    if (!this.plain) this.write(hide ? '\x1b[?25l' : '\x1b[?25h');
  }

  /** Render a full screenful (art / banner / glitch frames). */
  screen(text, opts = {}) {
    this.clearScreen();
    let body = text;
    if (opts.effect === 'scanlines' && !this.plain) body = scanlines(body, this.plain);
    if (opts.color && opts.color !== 'none') body = this.color(opts.color, body);
    this.write(body + '\n');
    if (this.onFrame) this.onFrame('\n---FRAME---\n');
  }

  async pause(ms) {
    await sleep(ms / (this.speed > 0 ? this.speed : 1), this.instant);
  }

  // ---- actions --------------------------------------------------------------

  async actClear() {
    this.clearScreen();
    await this.pause(120);
  }

  async actWait(f) {
    await this.pause(f.ms || 0);
  }

  async actArt(f) {
    const text = f.text || '';
    this.screen(text, f);
    await this.pause(f.hold || 1000);
  }

  async actBanner(f) {
    const lines = banner(f.text, { fill: f.fill || '█' });
    const pad = f.indent ? ' '.repeat(f.indent) : '';
    const text = lines.map((l) => pad + l).join('\n');
    this.screen(text, { color: f.color || 'bone', effect: f.effect });
    await this.pause(f.hold || 1500);
  }

  async actGlitch(f) {
    const base = f.text || f.art || '';
    const n = f.frames || 4;
    const fps = f.fps || 12;
    for (let i = 0; i < n; i++) {
      const corrupted = glitch(base, this.rand, f.intensity || 0.08);
      this.cursorHome();
      this.screen(corrupted, { color: f.color || 'red' });
      await this.pause(1000 / fps);
    }
    this.screen(base, { color: f.color || 'bone' });
    await this.pause(f.hold || 400);
  }

  async actVhs(f) {
    const label = f.label || '';
    const bar = this.plain
      ? `[${label}]`
      : `${style.inverse}${fg('ice')} ${label} ${style.reset}`;
    this.write('\n' + bar + '\n');
    await this.pause(f.hold || 700);
  }

  async actSubtitle(f) {
    const line = this.plain ? f.text : `${style.italic}${this.color(f.color || 'amber', f.text)}${style.reset}`;
    this.write('\n' + line + '\n');
    await this.pause(f.hold || 1800);
  }

  /**
   * type — the acting. Keystrokes with jitter, hesitation, typos and repair.
   * frame shape:
   *   { prompt, text, color, wpm, jitter, enter, hesitations:[{after,ms}],
   *     typos:[{at,chars,delayMs}], newline:true }
   */
  async actType(f) {
    const prompt = f.prompt || '';
    if (prompt) this.write(this.color(f.color || 'green', prompt));
    const text = String(f.text || '');
    const cps = ((f.wpm || 160) * 5) / 60; // chars per second
    const baseDelay = 1000 / cps;
    const jitter = f.jitter === undefined ? 0.35 : f.jitter;

    const hesitations = new Map();
    for (const h of f.hesitations || []) {
      hesitations.set(h.after || 0, (hesitations.get(h.after || 0) || 0) + (h.ms || 800));
    }
    const typos = new Map();
    for (const t of f.typos || []) typos.set(t.at || 0, t);

    for (let i = 0; i < text.length; i++) {
      const typo = typos.get(i);
      if (typo) {
        for (const ch of String(typo.chars || '')) {
          this.write(this.color(f.color || 'green', ch));
          await this.pause(baseDelay * (1 + this.rand() * jitter));
        }
        await this.pause(typo.delayMs === undefined ? 250 : typo.delayMs);
        for (let k = 0; k < String(typo.chars || '').length; k++) {
          this.write('\b \b');
          await this.pause(baseDelay * 0.6);
        }
      }
      this.write(this.color(f.color || 'green', text[i]));
      await this.pause(baseDelay * (1 + this.rand() * jitter * 2 - jitter));
      const h = hesitations.get(i + 1);
      if (h) {
        if (f.blink !== false && !this.plain) {
          this.write(`${style.hidden} ${style.reset}\b`); // the pause breathes
        }
        await this.pause(h);
      }
    }
    if (f.enter !== false) {
      await this.pause(120 + this.rand() * 200); // the beat before ENTER
      this.write('\n');
    }
    await this.pause(f.after || 150);
  }

  async actOutput(f) {
    const interval = f.interval === undefined ? 90 : f.interval;
    for (const line of f.lines || []) {
      const text = typeof line === 'string' ? line : line.text;
      const opts = typeof line === 'string' ? {} : line;
      if (opts.banner) {
        const lines = banner(text, { fill: opts.fill || '█' });
        for (const l of lines) {
          this.write(this.color(opts.color || f.color || 'green', l) + '\n');
          await this.pause(interval);
        }
        continue;
      }
      if (opts.delay) await this.pause(opts.delay);
      let rendered = text;
      if (opts.style === 'dim' && !this.plain) rendered = `${style.dim}${rendered}${style.reset}`;
      if (opts.style === 'bold' && !this.plain) rendered = `${style.bold}${rendered}${style.reset}`;
      if (opts.color) rendered = this.color(opts.color, rendered);
      this.write(rendered + '\n');
      await this.pause(opts.interval !== undefined ? opts.interval : interval);
    }
  }

  async actEnd(f) {
    this.write('\n');
    if (f.title) {
      const lines = banner(f.title, { fill: '=' });
      for (const l of lines) this.write(this.color('bone', l) + '\n');
    }
    if (f.sub) this.write('\n' + this.color('ice', f.sub) + '\n');
    if (f.next) this.write(this.color('amber', f.next) + '\n');
    await this.pause(f.hold || 3000);
  }

  async play() {
    this.hideCursor(true);
    try {
      for (const frame of this.tl.frames) {
        switch (frame.type) {
          case 'clear': await this.actClear(frame); break;
          case 'wait': await this.actWait(frame); break;
          case 'art': await this.actArt(frame); break;
          case 'banner': await this.actBanner(frame); break;
          case 'glitch': await this.actGlitch(frame); break;
          case 'vhs': await this.actVhs(frame); break;
          case 'subtitle': await this.actSubtitle(frame); break;
          case 'type': await this.actType(frame); break;
          case 'output': await this.actOutput(frame); break;
          case 'end': await this.actEnd(frame); break;
          default: break;
        }
      }
    } finally {
      this.hideCursor(false);
    }
  }

  /** Deterministic full-text rendering (tests, screenshots, text archives). */
  renderInstant() {
    const chunks = [];
    for (const frame of this.tl.frames) {
      switch (frame.type) {
        case 'clear': chunks.push('\n=== [clear] ===\n'); break;
        case 'wait': chunks.push(`\n=== [wait ${frame.ms}ms] ===\n`); break;
        case 'art':
        case 'glitch':
          chunks.push('\n---FRAME---\n' + (frame.text || frame.art || '') + '\n');
          break;
        case 'banner':
          chunks.push('\n---FRAME---\n' + banner(frame.text, { fill: frame.fill || '█' }).join('\n') + '\n');
          break;
        case 'vhs': chunks.push(`[${frame.label}]\n`); break;
        case 'subtitle': chunks.push(frame.text + '\n'); break;
        case 'type': {
          chunks.push((frame.prompt || '') + frame.text + (frame.enter === false ? '' : '\n'));
          break;
        }
        case 'output':
          for (const line of frame.lines || []) {
            const text = typeof line === 'string' ? line : line.text;
            if (typeof line === 'object' && line.banner) {
              chunks.push(banner(text, { fill: line.fill || '█' }).join('\n') + '\n');
            } else {
              chunks.push(text + '\n');
            }
          }
          break;
        case 'end':
          chunks.push('\n');
          if (frame.title) chunks.push(banner(frame.title, { fill: '=' }).join('\n') + '\n');
          if (frame.sub) chunks.push(frame.sub + '\n');
          if (frame.next) chunks.push(frame.next + '\n');
          break;
        default: break;
      }
    }
    return chunks.join('');
  }
}

module.exports = { Player, sleep };
