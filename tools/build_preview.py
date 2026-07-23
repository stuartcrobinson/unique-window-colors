"""
Build palette_preview.html — a self-contained visual review of the proposed
v2 colour model, with the current v1.2.9 output alongside for comparison.

Run:  python3 tools/build_preview.py && open palette_preview.html

The page embeds its own data, so it works from file:// with no server.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import audit_contrast as old            # noqa: E402  current v1.2.9 algorithm
import palette_lab as new               # noqa: E402  proposed v2 algorithm

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'palette_preview.html')


def old_window(base_hex, theme):
    """Current v1.2.9 output, in the same shape as the proposed model."""
    d = old.derive_themed_colors(old.Color(base_hex), theme)
    bars = {
        'titleBarActive':   (d['titleBar'].hex(),  d['titleBarText'].hex()),
        'activityBar':      (d['sideBar'].hex(),   None),
        'statusBar':        (d['statusBar'].hex(), d['statusBarText'].hex()),
        # v1.2.9 pairs the *active* title bar's text with the *sidebar*
        # background here. That mismatch is the bug.
        'titleBarInactive': (d['sideBar'].hex(),   d['titleBarText'].hex()),
    }
    out = {}
    for bar, (bg, fg) in bars.items():
        if fg is None:
            # v1.2.9 never sets activityBar.foreground at all (issue #58), so
            # icons fall through to whatever the user's theme supplies.
            fg = '#CCCCCC' if theme == 'dark' else '#1F1F1F'
            out[bar] = {'bg': bg, 'fg': fg, 'unset': True}
        else:
            out[bar] = {'bg': bg, 'fg': fg}
        out[bar]['wcag'] = round(new.wcag_contrast(out[bar]['fg'], bg), 2)
        out[bar]['apca'] = round(new.apca_lc(out[bar]['fg'], bg), 1)
    return out


def build_data():
    data = new.emit_json()
    for entry in data['colors']:
        entry['current'] = {t: old_window(entry['base'], t) for t in ('dark', 'light')}
    return data


CSS = """
:root { --gap: 14px; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       background:#0d0d0d; color:#ddd; }
header { padding:26px 30px 18px; border-bottom:1px solid #2a2a2a;
         position:sticky; top:0; background:#0d0d0dfa; z-index:10;
         backdrop-filter:blur(8px); }
h1 { font-size:19px; font-weight:600; letter-spacing:-.2px; }
header p { color:#8a8a8a; margin-top:5px; max-width:76ch; font-size:12.5px; }
.controls { display:flex; gap:22px; margin-top:15px; flex-wrap:wrap; align-items:center; }
.ctl { display:flex; gap:6px; align-items:center; }
.ctl b { font-size:10.5px; text-transform:uppercase; letter-spacing:.08em;
         color:#7a7a7a; font-weight:600; margin-right:2px; }
button { font:inherit; font-size:12px; padding:5px 13px; border-radius:6px;
         border:1px solid #333; background:#1a1a1a; color:#bbb; cursor:pointer; }
button:hover { border-color:#4a4a4a; color:#e8e8e8; }
button.on { background:#2b6cb0; border-color:#2b6cb0; color:#fff; }

section { padding:26px 30px 40px; }
section.dark  { background:#141414; }
section.light { background:#f2f2f2; color:#333; }
section > h2 { font-size:13px; text-transform:uppercase; letter-spacing:.1em;
               margin-bottom:4px; font-weight:600; }
section.dark  > h2 { color:#9a9a9a; }
section.light > h2 { color:#767676; }
section > .note { font-size:12px; margin-bottom:20px; }
section.dark  > .note { color:#6e6e6e; }
section.light > .note { color:#8a8a8a; }

.grid { display:grid; gap:var(--gap);
        grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }
.cell { border-radius:9px; overflow:hidden; }
section.dark  .cell { background:#1b1b1b; box-shadow:0 1px 3px #0006; }
section.light .cell { background:#fff; box-shadow:0 1px 4px #0000001f; }
.cell > .cap { display:flex; justify-content:space-between; align-items:baseline;
               padding:8px 11px 7px; font-size:11.5px; }
.cap .nm { font-weight:600; letter-spacing:.01em; }
.cap .hx { font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
           font-size:10px; opacity:.5; }
section.dark  .cap { color:#c8c8c8; }
section.light .cap { color:#444; }

/* --- the mini VS Code window ------------------------------------------- */
.win { font-size:10px; user-select:none; }
.win .tb { height:26px; display:flex; align-items:center; justify-content:center;
           position:relative; font-size:10.5px; }
.win .tb .dots { position:absolute; left:8px; display:flex; gap:4px; }
.win .tb .dots i { width:7px; height:7px; border-radius:50%;
                   background:currentColor; opacity:.42; }
.win .mid { display:flex; height:92px; }
.win .ab { width:34px; display:flex; flex-direction:column;
           align-items:center; padding-top:7px; gap:9px; font-size:12px;
           line-height:1; }
.win .ed { flex:1; padding:9px 10px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
           font-size:9.5px; line-height:1.65; }
.win .sb { height:20px; display:flex; align-items:center; gap:11px;
           padding:0 9px; font-size:10px; }
.win .sb .r { margin-left:auto; }

.metrics { display:flex; flex-wrap:wrap; gap:5px; padding:8px 10px 10px; }
.m { font-size:9.5px; padding:2px 6px; border-radius:4px;
     font-family:ui-monospace,SFMono-Regular,Menlo,monospace; white-space:nowrap; }
.m.pass { background:#1c3a24; color:#7fd39b; }
.m.warn { background:#3d3316; color:#e0c063; }
.m.fail { background:#4a1616; color:#ff8f8f; }
section.light .m.pass { background:#dcf3e3; color:#1c6b39; }
section.light .m.warn { background:#faf0cf; color:#7a5c07; }
section.light .m.fail { background:#fadcdc; color:#a11414; }

/* --- frontier chart ----------------------------------------------------- */
.frontier { margin:0 30px 34px; padding:20px 22px; background:#141414;
            border:1px solid #262626; border-radius:9px; }
.frontier h3 { font-size:12.5px; margin-bottom:3px; }
.frontier p { color:#7d7d7d; font-size:11.5px; margin-bottom:16px; max-width:80ch; }
.fchart { display:flex; align-items:flex-end; gap:1px; height:132px;
          border-bottom:1px solid #333; }
.fbar { flex:1; position:relative; border-radius:1px 1px 0 0; }
.flabels { display:flex; justify-content:space-between; margin-top:5px;
           font-size:9.5px; color:#6a6a6a;
           font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
.flegend { display:flex; gap:16px; margin-top:11px; font-size:11px; color:#8a8a8a; }
.flegend i { display:inline-block; width:9px; height:9px; border-radius:2px;
             margin-right:5px; vertical-align:-1px; }
"""

JS = r"""
const D = __DATA__;
const state = { preset: 'balanced', model: 'proposed' };

const ICONS = ['☰','⌕','⎇','▷','⚙'];

function badge(label, wcag, apca, needW, needA) {
  const ok = wcag >= needW && Math.abs(apca) >= needA;
  // "warn" = clears the legal WCAG floor but misses the perceptual APCA target.
  const warn = !ok && wcag >= needW;
  const cls = ok ? 'pass' : (warn ? 'warn' : 'fail');
  return `<span class="m ${cls}">${label} ${wcag.toFixed(1)}:1 / Lc ${Math.abs(apca).toFixed(0)}</span>`;
}

function windowHTML(w, theme) {
  const ta = w.titleBarActive, ti = w.titleBarInactive,
        ab = w.activityBar, sb = w.statusBar;
  const editorBg = D.themes[theme].editor;
  const editorFg = theme === 'dark' ? '#9d9d9d' : '#6b6b6b';
  const iconFg  = ab.fg;
  const iconDim = ab.fgInactive || ab.fg;
  const icons = ICONS.map((g, i) =>
    `<span style="color:${i === 0 ? iconFg : iconDim}">${g}</span>`).join('');
  return `
  <div class="win">
    <div class="tb" style="background:${ta.bg};color:${ta.fg}">
      <div class="dots"><i></i><i></i><i></i></div>my-project — active
    </div>
    <div class="mid">
      <div class="ab" style="background:${ab.bg}">${icons}</div>
      <div class="ed" style="background:${editorBg};color:${editorFg}">
        const hue = hash(path);<br>return tint(hue);
      </div>
    </div>
    <div class="sb" style="background:${sb.bg};color:${sb.fg}">
      <span>main*</span><span>&#9888; 0</span><span class="r">Ln 42, Col 8</span>
    </div>
    <div class="tb" style="background:${ti.bg};color:${ti.fg};height:23px">
      <div class="dots"><i></i><i></i><i></i></div>my-project — inactive
    </div>
  </div>`;
}

function cellHTML(c, theme) {
  const w = state.model === 'proposed'
    ? c.presets[state.preset][theme]
    : c.current[theme];
  const p = state.model === 'proposed';
  const ab = w.activityBar;
  let metrics =
      badge('title', w.titleBarActive.wcag, w.titleBarActive.apca, 4.5, 75)
    + badge('inactive', w.titleBarInactive.wcag, w.titleBarInactive.apca, 4.5, 60)
    + badge('status', w.statusBar.wcag, w.statusBar.apca, 4.5, 75);
  if (p) {
    metrics += badge('icons', ab.wcag, ab.apca, 4.5, 75)
             + badge('icons dim', ab.wcagInactive, ab.apcaInactive, 3.0, 40);
  } else {
    metrics += `<span class="m warn">icons unset (#58)</span>`;
  }
  return `<div class="cell">
    <div class="cap"><span class="nm">${c.name}</span><span class="hx">${c.base}</span></div>
    ${windowHTML(w, theme)}
    <div class="metrics">${metrics}</div>
  </div>`;
}

function frontierHTML() {
  const max = Math.max(...D.frontier.map(f => f.maxLc));
  const bars = D.frontier.map(f => {
    const dead = f.L > D.deadZone[0] && f.L < D.deadZone[1];
    const h = Math.max(2, (f.maxLc / max) * 100);
    const col = dead ? '#7d2a2a' : (f.maxLc >= 75 ? '#2f7d4f' : '#7d6a2a');
    return `<div class="fbar" style="height:${h}%;background:${col}"
             title="L=${f.L}  max |Lc|=${f.maxLc}"></div>`;
  }).join('');
  return `<div class="fchart">${bars}</div>
    <div class="flabels"><span>L 0.05</span><span>0.25</span><span>0.50</span>
      <span>0.75</span><span>L 0.98</span></div>
    <div class="flegend">
      <span><i style="background:#2f7d4f"></i>can carry body text (Lc&nbsp;75+)</span>
      <span><i style="background:#7d6a2a"></i>dimmed text only</span>
      <span><i style="background:#7d2a2a"></i>dead zone &mdash; unreadable either way</span>
    </div>`;
}

function render() {
  for (const theme of ['dark', 'light']) {
    document.getElementById('grid-' + theme).innerHTML =
      D.colors.map(c => cellHTML(c, theme)).join('');
  }
  document.querySelectorAll('[data-preset]').forEach(b =>
    b.classList.toggle('on', b.dataset.preset === state.preset));
  document.querySelectorAll('[data-model]').forEach(b =>
    b.classList.toggle('on', b.dataset.model === state.model));
  document.getElementById('presetCtl').style.opacity =
    state.model === 'proposed' ? 1 : .35;
  document.getElementById('frontier').innerHTML = frontierHTML();
}

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.preset) state.preset = b.dataset.preset;
  if (b.dataset.model) state.model = b.dataset.model;
  render();
});
render();
"""

HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Window Colors — palette review</title>
<style>__CSS__</style></head><body>

<header>
  <h1>Window Colors &mdash; proposed v2 palette</h1>
  <p>Every foreground below is derived from the background it is actually
     painted on, in OKLCH, and stops as soon as it clears both the WCAG&nbsp;2
     ratio and the APCA perceptual target &mdash; which is what makes it a
     tinted gray rather than pure white or black. Switch to
     <em>current v1.2.9</em> to see what ships today.</p>
  <div class="controls">
    <div class="ctl"><b>model</b>
      <button data-model="proposed">proposed v2</button>
      <button data-model="current">current v1.2.9</button></div>
    <div class="ctl" id="presetCtl"><b>vividness</b>
      <button data-preset="subtle">subtle</button>
      <button data-preset="balanced">balanced</button>
      <button data-preset="vivid">vivid</button></div>
  </div>
</header>

<div class="frontier">
  <h3>Contrast budget by bar lightness</h3>
  <p>The highest APCA contrast any tint of the bar's own hue can reach, as the
     bar's perceptual lightness sweeps 0&rarr;1. The red band is the dead zone:
     a bar placed there is unreadable no matter which foreground you pick, so
     bar lightness &mdash; not foreground choice &mdash; is the real
     constraint. v1.2.9 puts the light-mode inactive title bar deep below it.</p>
  <div id="frontier"></div>
</div>

<section class="dark">
  <h2>Dark theme</h2>
  <div class="note">Editor background #1F1F1F, as VS&nbsp;Code Dark Modern.</div>
  <div class="grid" id="grid-dark"></div>
</section>

<section class="light">
  <h2>Light theme</h2>
  <div class="note">Editor background #FFFFFF, as VS&nbsp;Code Light Modern.</div>
  <div class="grid" id="grid-light"></div>
</section>

<script>__JS__</script>
</body></html>
"""


def main():
    data = build_data()
    js = JS.replace('__DATA__', json.dumps(data, separators=(',', ':')))
    html = HTML.replace('__CSS__', CSS).replace('__JS__', js)
    with open(OUT, 'w') as f:
        f.write(html)
    print(f'wrote {OUT}  ({len(html) / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
