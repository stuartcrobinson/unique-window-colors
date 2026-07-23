# Handoff — Window Colors v2 colour model

**Written:** 2026-07-23 · **Repo state at writing:** `master` @ `f2454d5` · **Shipping:** v1.2.9

This document is the entry point for the work that fixes the contrast complaints
(#69, #70, #71, #73) and the unset-icon-colour request (#58). It is written to be
picked up cold — by a person or an AI agent — with no other context.

Read this file, then `tools/palette_lab.py`, then open `palette_preview.html`.

---

## 0. TL;DR

The extension picks a foreground colour, then paints it on a *different*
background than the one it was computed against. That single defect produces
**38 of 204** unreadable text/background pairs in the shipping version — including
**every one of the 34 base colours** in light mode, where the inactive title bar
lands at 1.05–1.57:1 contrast (WCAG AA needs 4.5:1).

The fix is not a tweak to the numbers. It is a restructure: derive every
foreground *from the background it will actually sit on*, in a perceptual colour
space, and stop as soon as it clears a contrast gate. A validated design is in
`tools/palette_lab.py` and renders in `palette_preview.html`; it passes
**1020 of 1020** pairs across three vividness presets.

---

## 1. State of the repo

| Thing | State |
|---|---|
| Branch | `master`, clean, synced with origin |
| HEAD | `f2454d5 wip: save uncommitted state before laptop migration`, preceded by `41ccd49 wip`, `276c3ee wip` — **review these before building on them** |
| `node_modules/` | **absent** — `npm install` required before `tsc`/`vsce` will run |
| Tests | **none.** `package.json` has `"test": "npm run compile"`, i.e. the test script only type-checks. `src/test/` contains a stub. |
| CI | **none on `master`.** A `.github/workflows/publish-ovsx.yml` exists only on the reverted `feb22_2` branch. |
| Docs | `AGENTS.md` (validation commands), `CHANGELOG.md` (empty — never maintained) |

The absent test suite is the highest-leverage gap. See §7.

---

## 2. Diagnosis — what is actually broken

### 2.1 The root defect: foregrounds paired with the wrong background

In [`src/extension.ts`](src/extension.ts), `deriveThemedColors()` returns one
`titleBarText` value. `applyWindowColors()` then writes it to **two** different
backgrounds:

```ts
// src/extension.ts — light-mode branch
titleBarText: getColorWithLuminosity(titleBar, 0, 0.01)   // computed vs the LIGHT title bar

// src/extension.ts — apply step
newCc['titleBar.inactiveBackground'] = sideBarColor.hex();      // a NEAR-BLACK bar
newCc['titleBar.inactiveForeground'] = titleBarTextColor.hex(); // ...gets the near-BLACK text
```

In light mode `sideBar` is clamped to WCAG luminance 0.02–0.027 (near-black) while
`titleBarText` is clamped to ≤0.01 (also near-black). Near-black on near-black.

The same shape of bug hits dark mode: `titleBarText` is derived from `sideBar`,
but painted on `sideBar.lighten(0.4)`.

### 2.2 Quantified

`tools/audit_contrast.py` reimplements the shipping algorithm exactly — including
`color@3`'s HSL `lighten`/`darken` semantics — and audits all 34 base colours × 2
themes × 3 text pairs.

```
$ python3 tools/audit_contrast.py
38 of 204 text/background pairs fall below WCAG AA (4.5:1).

worst offenders:
   1.05:1  Gray         light  titleBar.inactive  bg=#1E1E1E fg=#191919
   1.17:1  Black/Navy/Midnight/Plum  light  titleBar.inactive
   1.18:1  Forest       light  titleBar.inactive  bg=#032F03 fg=#021F02
   ...
```

Breakdown of the 38:

- **34** — light-mode `titleBar.inactive`, *every base colour*, 1.05–1.57:1.
- **4** — dark-mode `titleBar.active` for the warm hues (Brown, Orange, Rust,
  Ember), 3.62–4.38:1. These take a raised luminosity floor (`orangish`), then
  `lighten(0.4)`, ending too light for the near-white text derived from the sidebar.

**Known-answer validation.** Issue #73 reported exact hexes. Feeding base `Petrol`
(`#0c7ba0`) through the reimplementation in light mode reproduces them bit-for-bit:

```
expected ('#053241', '#34C1F0', '#031C25')
actual   ('#053241', '#34C1F0', '#031C25')   -> MATCH
```

So the reimplementation is trustworthy, and #73 is fully explained: the reporter's
inactive title bar is at **1.29:1**.

### 2.3 A second, unreported bug in the same area

v1.2.9 never writes `activityBar.foreground`. In **dark** mode that is harmless —
the theme's light icon colour sits on a dark bar. In **light** mode the extension
paints the activity bar near-black (`#053241`) while VS Code Light Modern supplies
`activityBar.foreground: #1F1F1F` — dark icons on a near-black bar, **1.21:1**.

Issue #58 asks for `activityBar.foreground` as a feature request. In light mode it
is a bug: the icons are invisible. Fixing §3 fixes #58 for free.

### 2.4 Why colours changed for existing folders (#71)

Two mechanisms, both real:

1. `hashToBaseColor()` does `rand(selectableColors.length)` — an **index into an
   array**. Adding or reordering `BASE_COLORS` reshuffles every existing
   workspace's assignment. The palette was rewritten in `276c3ee`.
2. There *is* a mitigation — reuse `cc['activityBar.background']` if present — but
   `SettingsFileDeleter` deletes `.vscode/settings.json` on exit when it holds only
   managed keys. The memory is erased, so the next launch recomputes from the
   changed palette. The mitigation and the deleter defeat each other.

### 2.5 Why user base colours stopped being respected (#69)

`deriveThemedColors(..., respectExtremes = true)` only preserves a user colour when
it is *already past* the clamp threshold:

```ts
const sideBar = respectExtremes && rawColor.luminosity() < dkMin
  ? rawColor : getColorWithLuminosity(rawColor, dkMin, dkMax);
```

The reporter's `hsl(20, 66%, 40%)` orange has luminosity well above `dkMin`, so it
is clamped to 0.08–0.11 — arriving as brown, exactly as reported.

---

## 3. The proposed v2 colour model

Reference implementation: **`tools/palette_lab.py`**. It is deliberately written to
be transliterated into TypeScript.

### 3.1 Work in OKLCH, not HSL

HSL lightness is not perceptual: `lighten(0.4)` moves a dark blue and a dark yellow
by visually different amounts, which is why the current code needs the
`yellowish`/`orangish`/`grayish`/`whitish` special cases. In OKLCH, `L` *is*
perceived lightness, so one rule covers every hue and all four special cases delete.

`generate_palettes.py` already uses OKLab — this is not a new dependency of ideas.

### 3.2 Dual contrast gate

Every text/background pair must clear **both**:

- **WCAG 2.x ratio** — the legal/compliance baseline.
- **APCA `Lc`** — the perceptual one. WCAG 2 materially overstates contrast for
  dark colours, which is precisely the regime this extension operates in.

Targets are calibrated against what VS Code's own Dark/Light Modern themes achieve
(measured with `palette_lab.py`, not guessed):

| Role | VS Code default achieves | v2 gate |
|---|---|---|
| Primary chrome text | WCAG 10.5–15.7, \|Lc\| 74.6–99.4 | WCAG 4.5, \|Lc\| 75 |
| Active icons | WCAG 12.3–15.5, \|Lc\| 81.2–99.3 | WCAG 4.5, \|Lc\| 75 |
| Inactive title text | WCAG 2.9–6.1, \|Lc\| 47.3–53.5 | WCAG 4.5, \|Lc\| 60 |
| Inactive icons | WCAG 4.9–5.8, \|Lc\| 36.5–76.7 | WCAG 3.0, \|Lc\| 40 |

Note the inactive gates are set *above* what VS Code itself ships. That is
deliberate: inactive title bar legibility is the specific thing #70 and #73 are
about.

### 3.3 `foregroundFor(background, role)` — the core function

This is the piece that was missing. Given the background it will actually be
painted on:

1. Convert the background to OKLCH → `(L_bg, C_bg, H_bg)`.
2. Choose the foreground's chroma as a fraction of the background's, capped:
   `C_fg = min(C_bg × 0.30, 0.045)`. **This is what makes it a tinted gray**
   rather than a neutral one — it carries the background's hue at a chroma low
   enough to read as gray.
3. For each polarity (lighter / darker), binary-search `L_fg` for the value
   *closest to the background* that still clears the gate.
4. Prefer whichever polarity travelled less; that is the least-extreme colour that
   is still comfortably readable.
5. Gamut-map by reducing chroma only, preserving `L` and `H`.

Stopping at the gate instead of driving to the extreme is the whole trick: it is
why the result is `#D8EBF4` rather than `#FFFFFF`.

```
Petrol, dark, balanced:
  titleBar.active    bg #004F69   fg #D8EBF4    7.37:1   Lc -79.6
  activityBar        bg #003648   fg #D2DEE3    9.44:1   Lc -79.6
                                  icons dim #919DA2  4.66:1  Lc -42.4
  statusBar          bg #003648   fg #D0DFE5    9.48:1   Lc -79.9
  titleBar.inactive  bg #002634   fg #B3BEC3    8.34:1   Lc -63.7
```

### 3.4 The contrast dead zone — the constraint nobody encoded

Sweeping bar lightness 0→1 and asking "what is the best APCA contrast *any* tint of
this hue can reach?" produces a U-curve with a floor. Run it yourself:

```
python3 tools/palette_lab.py --frontier
```

Across **L 0.58–0.83, no foreground of any lightness — lighter or darker — reaches
the body-text gate (Lc 75)**; the curve bottoms out at **Lc 55** around L 0.71,
i.e. dimmed-text quality at best. A bar placed there cannot be rescued by any
foreground algorithm; the *background lightness* is the bug. The guard constant
`DEAD_ZONE` is widened to (0.56, 0.84) so it errs toward rejection.

This yields a hard rule, enforced by `test_no_bar_in_dead_zone()`:

> Every bar must sit at **L ≤ 0.56** (dark themes) or **L ≥ 0.84** (light themes).

Empirically the light-mode floor is tighter still: at the chroma levels v2 uses,
a bar below **L 0.88** leaves the tinted-gray search unable to reach the gate, so
it collapses to pure `#000000`. Light-mode bars are therefore placed at L 0.88–0.97.
This is why the light palette is pastel — it is a constraint of the sRGB gamut at
high lightness, not a taste decision.

### 3.5 Vividness presets — resolving #69 against #73

#69 wants louder colours ("inactive title bars were going totally gray"). #73 wants
calmer ones. These are genuinely opposed, so make it an axis rather than a hidden
compromise. `windowColors.vividness` ∈ `subtle` | `balanced` | `vivid`, default
`balanced`. **All three clear the same contrast gates** — vividness buys saturation,
never legibility.

Bar lightness/chroma per preset is the `PRESETS` table in `tools/palette_lab.py`.
The role hierarchy is constant across presets: the active title bar sits furthest
from the editor background, the inactive title bar recedes toward it.

### 3.6 Result

```
$ python3 tools/palette_lab.py
dead-zone guard: PASS
contrast gate:   0 of 1020 pairs fail.
```

1020 = 34 base colours × 2 themes × 5 pairs × 3 presets. Every foreground is a real
tint; none fall back to pure black or white.

---

## 4. Stable colour assignment (fixes #71)

Two changes, both required:

1. **Hash to a hue angle, not an array index.**
   `hash(path) → H ∈ [0, 360)`, then build the bars procedurally from `H`. Palette
   edits then cannot disturb anyone's colour, ever. `BASE_COLORS` survives only as
   the manual picker's menu.
2. **Persist the assignment outside the workspace.**
   Write the resolved hue to `context.globalState`, keyed by workspace path. It
   must not live in `.vscode/settings.json`, because `SettingsFileDeleter` erases
   that (§2.4). On upgrade, seed `globalState` from the user's existing
   `activityBar.background` so **nobody's colour changes** on the v2 update.

Item 2 is what makes the v2 rollout non-disruptive. Do not skip it.

---

## 5. Issue map

| Issue | Status under this plan |
|---|---|
| #73 Colors weird / contrast unusable | Fixed by §3.3. Reporter's 1.29:1 case becomes ≥4.5:1. |
| #70 inactiveBackground too dark in light mode | Fixed by §3.4 — light bars move to L 0.88–0.97. |
| #69 Base colour no longer respected | Fixed by §3.5 + honouring user hue/chroma; only *lightness* is retargeted, and only enough to leave the dead zone. |
| #71 Colors changed for existing dir | Fixed by §4. |
| #58 `activityBar.foreground` | Fixed by §3.3 — also closes the light-mode 1.21:1 invisible-icon bug (§2.3). |
| #68 Delete property, not file | Independent, small: make `SettingsFileDeleter` remove only `workbench.colorCustomizations` keys. Interacts with §4 — do it in the same pass. |
| #67 "Please don't use AI" | Not a code issue, but real: 256k installs, and the Feb regressions were shipped without tests. The answer is §7 plus a visible verification story. `palette_preview.html` is that artefact. |
| #35 Publish to open-vsx | Already published but **stale and duplicated** — see §8.3. |

Untouched by this plan and still open: #56, #46, #44, #42, #39, #36, #34, #32,
#31, #28, #26, #25, #24, #22, #15, #14, #50.

---

## 6. Implementation plan

Staged so each stage is independently shippable.

**Stage 1 — port the colour engine.** New `src/color/` module: OKLab/OKLCH
conversions, WCAG, APCA, `foregroundFor()`, `buildWindow()`. Pure functions, no
`vscode` imports, so it is unit-testable without the extension host. Transliterate
from `tools/palette_lab.py`; keep the function names aligned so the two stay
comparable.

**Stage 2 — red tests first.** Port `tools/audit_contrast.py`'s known-answer check
and the full gate sweep into the TS suite (§7). They must fail against v1.2.9's
logic and pass against Stage 1.

**Stage 3 — wire it in.** Replace `deriveThemedColors`. Delete `getColorWithLuminosity`
and the `yellowish`/`orangish`/`grayish`/`whitish` special cases — OKLCH makes them
dead code. Add `activityBar.foreground` / `activityBar.inactiveForeground` to
`MANAGED_COLOR_KEYS`.

**Stage 4 — stable assignment + migration** (§4). Highest regression risk; needs
its own tests for the "existing user upgrades" path.

**Stage 5 — settings.** Add `windowColors.vividness`. Update
`docs`/`package.json` descriptions.

**Stage 6 — release.** §8.

---

## 7. Testing — the actual gap

There is no test suite. The Feb 2026 regressions reached 256k installs because
nothing could have caught them. Before any of §6 lands:

- Add a real runner (`@vscode/test-cli` + Mocha, or Vitest for the pure module —
  Vitest is simpler since Stage 1 has no `vscode` imports).
- Replace `"test": "npm run compile"` with something that runs tests.

Tests that must exist, mirroring the Python tools:

1. **Known-answer**: fixed base colour + theme + preset → exact expected hexes.
   Hand-checked, tight. This is what makes a regression *fail* rather than merely
   look different.
2. **Gate sweep**: all base colours × themes × presets → assert every pair clears
   its WCAG and APCA gate, and that no foreground is an achromatic fallback.
   This is `palette_lab.audit()`; port it.
3. **Dead-zone guard**: no preset places a bar in `L ∈ (0.56, 0.82)`.
4. **Stability**: given a fixed path, the assigned hue is unchanged after
   `BASE_COLORS` is mutated. This is the #71 regression test.
5. **Migration**: an existing `activityBar.background` seeds `globalState` and the
   rendered colour is unchanged across the upgrade.

A CI workflow running these on push is the other half — see §8.4.

---

## 8. Publishing and deploy

### 8.1 Current published state (verified 2026-07-23)

| Registry | Identity | Version | Reach |
|---|---|---|---|
| VS Marketplace | `stuart.unique-window-colors` | **1.2.9** (2026-02-25) | 256,500 installs · 4.9★ / 60 ratings |
| Open VSX | `stuart/unique-window-colors` | **1.2.0** (2026-02-22) | 2,515 downloads · verified |
| Open VSX | `stuartcrobinson/unique-window-colors` | **1.2.0** (2026-02-22) | 466 downloads · verified |

### 8.2 VS Marketplace

```bash
npm install
npm install -g @vscode/vsce      # or use npx
vsce login stuart                # publisher id — must match package.json "publisher"
vsce package                     # produces .vsix; inspect before publishing
vsce publish patch               # or minor / major / <exact version>
```

`vsce publish` in a git repo also creates a version commit and tag.

> ⚠️ **Deadline: Azure DevOps global PATs retire 1 December 2026.** Automated
> publishing must migrate to Microsoft Entra ID workload identity federation, and
> `vsce` must be ≥ 2.26.1. Roughly four months out at time of writing — worth
> handling during this work rather than discovering it at the next release.

Marketplace constraints worth remembering: icon must be PNG (SVG is rejected),
image URLs must be HTTPS.

### 8.3 Open VSX — needs cleanup

Two problems:

1. **Two namespaces exist** for the same extension. `package.json` says
   `"publisher": "stuart"`, and `ovsx` publishes under that field — but the
   reverted workflow ran `ovsx create-namespace stuartcrobinson`, creating a
   duplicate. Consolidate on **`stuart`** (matches `package.json`, and has 5× the
   downloads). Contact Open VSX to retire the other.
2. **Nine versions behind.** The workflow triggers on GitHub *release published*,
   and only one release (`v1.2.0`) was ever created, while 1.2.1–1.2.9 went out via
   direct `vsce publish`. VSCodium/Cursor users have been on a five-month-old build.

Manual publish:

```bash
npx ovsx create-namespace stuart -p $OVSX_PAT   # already exists; no-op
npx ovsx publish -p $OVSX_PAT                   # or: npx ovsx publish <file>.vsix -p $OVSX_PAT
```

Token: open-vsx.org → Settings → Access Tokens. Requires an Eclipse account whose
GitHub username matches, plus a signed Publisher Agreement. Published extensions
sit "Deactivated" for ~5–10s during automated scanning, then activate.

### 8.4 Recommended CI

Restore `.github/workflows/publish-ovsx.yml` (recoverable via
`git show 1855b2e:.github/workflows/publish-ovsx.yml`) with two changes:

- Fix the namespace to `stuart`.
- Add a **test job** that runs §7 on every push — that is the guard that would
  have caught the Feb regression.

Keep publishing release-triggered, but then *actually cut releases* — or drive both
registries from one `vsce publish` + `ovsx publish` step so they cannot drift again.

---

## 9. Tools in this repo

| Path | What it does |
|---|---|
| `tools/audit_contrast.py` | Reimplements the **shipping v1.2.9** algorithm faithfully; audits it; includes the issue-#73 known-answer check. Exits non-zero on failure. |
| `tools/palette_lab.py` | The **proposed v2** model. `--json` emits data, `--frontier` prints the dead-zone curve, `-v` prints every pair. Exits non-zero on failure. |
| `tools/build_preview.py` | Renders `palette_preview.html` from both of the above. |
| `palette_preview.html` | Self-contained visual review: 34 colours × dark/light × 3 presets, with a v1.2.9 comparison toggle and live contrast badges. Open directly in a browser. |

The Python tools are **design instruments, not shipping code** — they are excluded
from the `.vsix` via `.vscodeignore`. They exist so the colour model can be argued
about with numbers before any TypeScript is written, and so §7's tests have a
reference to be checked against.

---

## 10. Open questions for Stuart

1. **Default vividness** — `balanced` is my proposal. Compare the three presets in
   `palette_preview.html` and overrule if `subtle` feels closer to what the
   pre-Feb versions looked like.
2. **Should the status bar match the activity bar?** v2 currently gives them
   identical lightness/chroma. Distinguishing them is free if you want it.
3. **#73's alpha suggestion** — the reporter proposed deriving inactive colours by
   adding alpha to the active ones. Rejected here because compositing over an
   unknown backdrop makes contrast unverifiable; v2 computes opaque dimmed colours
   with their own gate instead. Worth replying to them on the thread.
4. **Deprecate `windowColors.theme: "remove"`?** It overlaps `removeColors` and
   `neverColorThisWindow`; three ways to do one thing.

---

## References

- APCA thresholds and algorithm — <https://git.apcacontrast.com/documentation/APCAeasyIntro.html>, <https://github.com/Myndex/apca-w3>
- Why WCAG 2 misreports dark-mode contrast — <https://github.com/Myndex/SAPC-APCA/discussions/30>
- VS Code theme colour keys — <https://code.visualstudio.com/api/references/theme-color>
- VS Code default themes (calibration source) — `microsoft/vscode` → `extensions/theme-defaults/themes/{dark,light}_modern.json`
- Publishing — <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>, <https://github.com/EclipseFdn/open-vsx.org/wiki/Publishing-Extensions>
