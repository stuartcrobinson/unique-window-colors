#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const Color = require('color');

const repoRoot = path.resolve(__dirname, '..');
const previewPath = path.join(repoRoot, 'color-preview.html');

// The shipping extension module imports VS Code at runtime. The preview only
// calls its pure palette functions, so provide an empty host while loading it.
const originalLoad = Module._load;
Module._load = function loadWithVscodeHost(request, parent, isMain) {
  if (request === 'vscode') {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

let extension;
let colorModel;
try {
  extension = require(path.join(repoRoot, 'out', 'extension.js'));
  colorModel = require(path.join(repoRoot, 'out', 'color_model.js'));
} finally {
  Module._load = originalLoad;
}

const { BASE_COLORS, deriveThemedColors } = extension;
const { contrastRatio, foregroundFor } = colorModel;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function role(label, background, detail) {
  const foreground = foregroundFor(background);
  const contrast = contrastRatio(background, foreground).toFixed(2);
  return `
          <div class="role">
            <div class="swatch" style="--role-bg: ${escapeHtml(background)}; --role-fg: ${escapeHtml(foreground)}">
              <span class="sample-icon" aria-hidden="true">◆</span>
              <span>${escapeHtml(label)}</span>
            </div>
            <dl>
              <div><dt>BG</dt><dd>${escapeHtml(background)}</dd></div>
              <div><dt>FG</dt><dd>${escapeHtml(foreground)}</dd></div>
              <div><dt>AA</dt><dd>${contrast}:1</dd></div>
            </dl>
            <p>${escapeHtml(detail)}</p>
          </div>`;
}

function presetCard(preset, mode) {
  // This is the exact path used after choosing a Set Base Color preset.
  const derived = deriveThemedColors(Color(preset.hex), mode, true);
  const activity = derived.sideBar.hex();
  const titleActive = derived.titleBar.hex();
  const titleInactive = derived.inactiveTitleBar.hex();
  const status = derived.statusBar.hex();

  return `
      <article class="preset-card">
        <header class="preset-heading">
          <div>
            <span class="emoji" aria-hidden="true">${escapeHtml(preset.emoji)}</span>
            <h3>${escapeHtml(preset.name)}</h3>
          </div>
          <span class="base-chip" style="--base-bg: ${escapeHtml(preset.hex)}">${escapeHtml(preset.hex)}</span>
        </header>
        <div class="roles">
${role('Activity bar', activity, 'activityBar foreground + inactiveForeground')}
${role('Title bar · active', titleActive, 'titleBar.activeForeground')}
${role('Title bar · inactive', titleInactive, 'titleBar.inactiveForeground')}
${role('Status bar', status, 'normal, debugging, and no-folder states')}
        </div>
      </article>`;
}

function modeSection(mode, label, description) {
  const cards = BASE_COLORS.map(preset => presetCard(preset, mode)).join('\n');
  return `
  <section class="mode-section ${mode}" id="${mode}">
    <div class="section-heading">
      <div>
        <p class="eyebrow">${escapeHtml(mode)} theme</p>
        <h2>${escapeHtml(label)}</h2>
      </div>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="preset-grid">
${cards}
    </div>
  </section>`;
}

function buildPreview() {
  const dark = modeSection(
    'dark',
    `Dark mode · ${BASE_COLORS.length} presets`,
    'Exact output after selecting each preset while Window Colors is using its dark theme.',
  );
  const light = modeSection(
    'light',
    `Light mode · ${BASE_COLORS.length} presets`,
    'Exact output after selecting each preset while Window Colors is using its light theme.',
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Window Colors · Shipping preset preview</title>
  <style>
    :root {
      color-scheme: dark;
      --page: #0b0d12;
      --panel: #141821;
      --panel-strong: #1b202b;
      --line: #2a3241;
      --text: #f3f6fb;
      --muted: #9ba8bb;
      --accent: #74c7ec;
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      background:
        radial-gradient(circle at 10% -10%, rgba(116, 199, 236, 0.14), transparent 28rem),
        var(--page);
      color: var(--text);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .hero {
      max-width: 1540px;
      margin: 0 auto;
      padding: 52px 28px 34px;
    }

    .hero-copy {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(300px, 0.8fr);
      gap: 40px;
      align-items: end;
    }

    .eyebrow {
      margin: 0 0 10px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    h1, h2, h3, p { margin-top: 0; }

    h1 {
      max-width: 820px;
      margin-bottom: 18px;
      font-size: clamp(36px, 5vw, 72px);
      line-height: 0.98;
      letter-spacing: -0.045em;
    }

    .lede {
      max-width: 800px;
      margin-bottom: 0;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.6;
    }

    .legend {
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(20, 24, 33, 0.78);
    }

    .legend h2 {
      margin-bottom: 10px;
      font-size: 15px;
    }

    .legend p {
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .legend p:last-child { margin-bottom: 0; }

    nav {
      display: flex;
      gap: 10px;
      margin-top: 30px;
    }

    nav a {
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }

    nav a:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    .mode-section {
      padding: 34px max(28px, calc((100vw - 1540px) / 2 + 28px)) 64px;
    }

    .mode-section.light {
      --section-bg: #eef1f5;
      --card-bg: #ffffff;
      --card-line: #d8dee8;
      --section-text: #151923;
      --section-muted: #5e6878;
      background: var(--section-bg);
      color: var(--section-text);
    }

    .mode-section.dark {
      --section-bg: #10131a;
      --card-bg: #171b24;
      --card-line: #2a3241;
      --section-text: #f3f6fb;
      --section-muted: #9ba8bb;
      background: var(--section-bg);
      color: var(--section-text);
    }

    .section-heading {
      display: flex;
      justify-content: space-between;
      gap: 30px;
      align-items: end;
      margin-bottom: 22px;
    }

    .section-heading h2 {
      margin-bottom: 0;
      font-size: clamp(25px, 3vw, 42px);
      letter-spacing: -0.035em;
    }

    .section-heading > p {
      max-width: 560px;
      margin-bottom: 2px;
      color: var(--section-muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .preset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 14px;
    }

    .preset-card {
      overflow: hidden;
      border: 1px solid var(--card-line);
      border-radius: 14px;
      background: var(--card-bg);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
    }

    .preset-heading {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: center;
      min-height: 65px;
      padding: 13px 14px;
      border-bottom: 1px solid var(--card-line);
    }

    .preset-heading > div {
      display: flex;
      gap: 9px;
      align-items: center;
      min-width: 0;
    }

    .emoji {
      font-size: 17px;
      letter-spacing: -7px;
      padding-right: 7px;
    }

    .preset-heading h3 {
      margin: 0;
      font-size: 16px;
    }

    .base-chip {
      flex: 0 0 auto;
      padding: 6px 8px;
      border: 1px solid color-mix(in srgb, var(--base-bg), white 22%);
      border-radius: 7px;
      background: var(--base-bg);
      color: white;
      font: 700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      text-shadow: 0 1px 3px black, 0 0 2px black;
    }

    .roles { display: grid; }

    .role {
      display: grid;
      grid-template-columns: minmax(128px, 1.25fr) minmax(104px, 0.75fr);
      border-bottom: 1px solid var(--card-line);
    }

    .role:last-child { border-bottom: 0; }

    .swatch {
      display: flex;
      gap: 8px;
      align-items: center;
      min-height: 52px;
      padding: 11px 12px;
      background: var(--role-bg);
      color: var(--role-fg);
      font-size: 12px;
      font-weight: 750;
    }

    .sample-icon { font-size: 11px; }

    dl {
      display: grid;
      align-content: center;
      gap: 2px;
      margin: 0;
      padding: 7px 10px;
      border-left: 1px solid var(--card-line);
      font: 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    dl div {
      display: grid;
      grid-template-columns: 22px 1fr;
      gap: 5px;
    }

    dt {
      color: var(--section-muted);
      font-weight: 800;
    }

    dd {
      margin: 0;
      color: var(--section-text);
    }

    .role p {
      grid-column: 1 / -1;
      margin: 0;
      padding: 6px 11px 7px;
      border-top: 1px solid var(--card-line);
      color: var(--section-muted);
      font-size: 9px;
      line-height: 1.35;
    }

    footer {
      padding: 24px 28px 38px;
      background: var(--page);
      color: var(--muted);
      text-align: center;
      font-size: 12px;
    }

    code {
      color: var(--accent);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    @media (max-width: 760px) {
      .hero-copy { grid-template-columns: 1fr; }
      .section-heading { display: block; }
      .section-heading > p { margin-top: 12px; }
      .preset-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <!-- Generated by scripts/generate-color-preview.js. Do not edit by hand. -->
  <header class="hero">
    <div class="hero-copy">
      <div>
        <p class="eyebrow">Window Colors · shipping implementation</p>
        <h1>Every preset. Every bar. Exact foregrounds.</h1>
        <p class="lede">
          All ${BASE_COLORS.length} Set Base Color presets rendered through the extension’s
          current TypeScript background derivation and foreground contrast logic,
          in both dark and light modes.
        </p>
      </div>
      <aside class="legend">
        <h2>How to read this</h2>
        <p><strong>BG</strong> and <strong>FG</strong> are the exact emitted hex values.</p>
        <p><strong>AA</strong> is the WCAG contrast ratio for that pair; every opaque pair must be at least 4.5:1.</p>
        <p>Status normal, debugging, and no-folder roles share one generated pair for a newly selected preset.</p>
      </aside>
    </div>
    <nav aria-label="Preview mode">
      <a href="#dark">Dark mode</a>
      <a href="#light">Light mode</a>
    </nav>
  </header>
${dark}
${light}
  <footer>
    Generated from <code>src/extension.ts</code> and <code>src/color_model.ts</code>.
    Regenerate with <code>npm run preview:generate</code>.
  </footer>
</body>
</html>
`;
}

const generated = buildPreview();
if (process.argv.includes('--check')) {
  const current = fs.existsSync(previewPath) ? fs.readFileSync(previewPath, 'utf8') : '';
  if (current !== generated) {
    console.error('color-preview.html is stale. Run: npm run preview:generate');
    process.exitCode = 1;
  } else {
    console.log(`color-preview.html matches ${BASE_COLORS.length} shipping presets in both modes.`);
  }
} else {
  fs.writeFileSync(previewPath, generated);
  console.log(`Generated ${previewPath} with ${BASE_COLORS.length} presets in both modes.`);
}
