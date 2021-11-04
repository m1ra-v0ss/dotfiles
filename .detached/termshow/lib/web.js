// termshow — browser export.
// Produces a single self-contained HTML file: the episode plays in a <pre>
// with the same keystroke-timing performance. Shareable, offline, no network.

'use strict';

function exportHTML(timeline, opts = {}) {
  const payload = JSON.stringify(timeline).replace(/</g, '\\u003c');
  const title = (timeline.meta && (timeline.meta.webTitle || timeline.meta.title)) || 'termshow';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --bg:#070b07; --fg:#33ff66; --dim:#145a28; --amber:#ffb000; --ice:#78dcff; }
  html,body { margin:0; height:100%; background:var(--bg); }
  #stage { box-sizing:border-box; height:100%; display:flex; align-items:center; justify-content:center; }
  pre#screen {
    font-family:"SF Mono","Fira Code",Menlo,Consolas,monospace;
    font-size:clamp(6px, 1.15vw, 15px); line-height:1.28;
    color:var(--fg); white-space:pre; text-shadow:0 0 6px rgba(51,255,102,.35);
    padding:2vh 2vw; max-width:100vw; overflow:hidden;
  }
  pre#screen.scanlines { background:repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,.22) 2px 3px); }
  #hud {
    position:fixed; top:8px; left:10px; font-family:monospace; font-size:11px;
    color:var(--dim); letter-spacing:.12em; user-select:none;
  }
  #hint {
    position:fixed; bottom:10px; right:14px; font-family:monospace; font-size:11px;
    color:var(--dim); user-select:none;
  }
  .amber { color:var(--amber); text-shadow:0 0 6px rgba(255,176,0,.35); }
  .ice { color:var(--ice); }
  .red { color:#ff4444; }
  .bone { color:#dcdcc8; }
</style>
</head>
<body>
<div id="hud">${title.toUpperCase()} &nbsp;·&nbsp; recovered terminal session</div>
<div id="stage"><pre id="screen" class="scanlines"></pre></div>
<div id="hint">SPACE &nbsp;=&nbsp;skip beat &nbsp;·&nbsp; R &nbsp;=&nbsp;replay</div>
<script id="timeline" type="application/json">${payload}</script>
<script>
(function () {
  var TL = JSON.parse(document.getElementById('timeline').textContent);
  var screenEl = document.getElementById('screen');
  var skip = false;

  function sleep(ms) {
    return new Promise(function (res) {
      if (skip) { skip = false; return res(); }
      var t = setTimeout(res, Math.max(0, ms));
      window.addEventListener('keydown', function onk(e) {
        if (e.code === 'Space') { clearTimeout(t); skip = false; window.removeEventListener('keydown', onk); res(); }
      }, { once: true });
    });
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyR') { location.reload(); }
    if (e.code === 'Space') { e.preventDefault(); skip = true; }
  });

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32((TL.meta && TL.meta.seed) || 1701);

  var GLITCH_CHARS = '▓▒░█▄▀■□▪▫╔╗╚╝║═╣╠╩╦╬';
  function glitch(text, intensity) {
    return text.split('\\n').map(function (line) {
      if (rand() < 0.35) {
        var shift = Math.floor(rand() * 6) - 3;
        line = shift > 0 ? ' '.repeat(shift) + line : line.slice(-shift);
      }
      return line.split('').map(function (ch) {
        return (ch !== ' ' && rand() < intensity) ? GLITCH_CHARS[Math.floor(rand() * GLITCH_CHARS.length)] : ch;
      }).join('');
    }).join('\\n');
  }

  var FONT = ${JSON.stringify(require('./banner.js').glyphs)};

  function bannerLine(text, fill) {
    fill = fill || '#';
    var rows = ['', '', '', '', '', '', ''];
    var chars = String(text).toUpperCase().split('');
    for (var ci = 0; ci < chars.length; ci++) {
      var g = FONT[chars[ci]] || FONT['?'];
      for (var r = 0; r < 7; r++) {
        rows[r] += g[r].replace(/#/g, fill).replace(/\\./g, ' ').replace(/(\\S)/g, '$1$1');
        if (ci < chars.length - 1) rows[r] += '  ';
      }
    }
    return rows.map(function (l) { return l.replace(/\\s+$/, ''); }).join('\\n');
  }

  var COLORMAP = { green: '', amber: 'amber', ice: 'ice', red: 'red', bone: 'bone', none: '' };
  function paint(text, cls) {
    if (!cls) return escapeHTML(text);
    return '<span class="' + cls + '">' + escapeHTML(text) + '</span>';
  }
  function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var buffer = '';
  function flush() { screenEl.innerHTML = buffer; }

  async function run() {
    buffer = '';
    flush();
    for (var i = 0; i < TL.frames.length; i++) {
      var f = TL.frames[i];
      if (f.type === 'clear') { buffer = ''; flush(); await sleep(120); }
      else if (f.type === 'wait') { await sleep(f.ms || 0); }
      else if (f.type === 'vhs') {
        buffer += '\\n' + paint('[' + (f.label || '') + ']', 'ice') + '\\n'; flush(); await sleep(f.hold || 700);
      }
      else if (f.type === 'subtitle') {
        buffer += '\\n' + paint(f.text, COLORMAP[f.color] || 'amber') + '\\n'; flush(); await sleep(f.hold || 1800);
      }
      else if (f.type === 'art' || f.type === 'glitch') {
        var base = f.text || f.art || '';
        if (f.type === 'glitch') {
          for (var gf = 0; gf < (f.frames || 4); gf++) {
            screenEl.innerHTML = paint(glitch(base, f.intensity || 0.08), COLORMAP[f.color] || 'red');
            await sleep(1000 / (f.fps || 12));
          }
        }
        buffer = paint(base, COLORMAP[f.color] || '') + '\\n'; flush();
        await sleep(f.hold || 1000);
      }
      else if (f.type === 'banner') {
        buffer = paint(bannerLine(f.text, f.fill), COLORMAP[f.color] || 'bone') + '\\n'; flush();
        await sleep(f.hold || 1500);
      }
      else if (f.type === 'type') {
        var prompt = f.prompt || '';
        buffer += prompt ? paint(prompt, COLORMAP[f.color] || '') : '';
        flush();
        var text = f.text || '';
        var cps = ((f.wpm || 160) * 5) / 60;
        var baseDelay = 1000 / cps;
        var hes = {};
        (f.hesitations || []).forEach(function (h) { hes[h.after || 0] = (hes[h.after || 0] || 0) + (h.ms || 800); });
        var typos = {};
        (f.typos || []).forEach(function (t) { typos[t.at || 0] = t; });
        for (var c = 0; c < text.length; c++) {
          var tp = typos[c];
          if (tp) {
            for (var wc = 0; wc < String(tp.chars || '').length; wc++) {
              buffer += paint(String(tp.chars)[wc], COLORMAP[f.color] || ''); flush();
              await sleep(baseDelay);
            }
            await sleep(tp.delayMs === undefined ? 250 : tp.delayMs);
            buffer = buffer.slice(0, -String(tp.chars || '').length * 0 - 0); // visual repair below
            var back = String(tp.chars || '').length;
            while (back-- > 0) { buffer = buffer.replace(/<span class="[^"]*">[^<]*<\\/span>|.$/, ''); }
            flush(); await sleep(baseDelay * 0.6);
          }
          buffer += paint(text[c], COLORMAP[f.color] || ''); flush();
          await sleep(baseDelay * (1 + rand() * 0.7 - 0.35));
          if (hes[c + 1]) await sleep(hes[c + 1]);
        }
        if (f.enter !== false) { await sleep(120 + rand() * 200); buffer += '\\n'; flush(); }
        await sleep(f.after || 150);
      }
      else if (f.type === 'output') {
        var interval = f.interval === undefined ? 90 : f.interval;
        for (var li = 0; li < (f.lines || []).length; li++) {
          var line = f.lines[li];
          var txt = typeof line === 'string' ? line : line.text;
          var cls = COLORMAP[(typeof line === 'object' && line.color) || f.color] || '';
          if (typeof line === 'object' && line.banner) {
            buffer += paint(bannerLine(txt, line.fill), cls || 'bone') + '\\n';
          } else {
            buffer += paint(txt, cls) + '\\n';
          }
          flush();
          await sleep(typeof line === 'object' && line.delay ? line.delay : 0);
          await sleep(interval);
        }
      }
      else if (f.type === 'end') {
        buffer += '\\n';
        if (f.title) buffer += paint(bannerLine(f.title, '='), 'bone') + '\\n';
        if (f.sub) buffer += '\\n' + paint(f.sub, 'ice') + '\\n';
        if (f.next) buffer += paint(f.next, 'amber') + '\\n';
        flush();
        await sleep(f.hold || 3000);
      }
    }
  }
  run();
})();
</script>
</body>
</html>
`;
}

module.exports = { exportHTML };
