"""
Design lab for the proposed v2 color model.

Everything here is perceptual (OKLCH) rather than HSL, and every foreground is
derived from the background it will actually be painted on — which is the
single defect behind issues #70, #73 and half of #69.

Run:  python3 tools/palette_lab.py            # audit the proposed model
      python3 tools/palette_lab.py --json     # emit palette.json for the preview page

Contrast is dual-gated: a pair must satisfy BOTH WCAG 2.x (legal baseline) and
APCA (perceptual truth, and the one that actually reflects dark-mode legibility).
"""
import json
import math
import sys

# ============================================================ color conversions

def _srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def hex_to_rgb01(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def rgb01_to_hex(rgb):
    return '#{:02X}{:02X}{:02X}'.format(
        *(max(0, min(255, int(round(c * 255)))) for c in rgb))


def rgb01_to_oklab(rgb):
    r, g, b = (_srgb_to_linear(c) for c in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def oklab_to_rgb01(lab):
    L, A, B = lab
    l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(_linear_to_srgb(c) for c in (r, g, b))


def oklch_to_oklab(L, C, H):
    rad = math.radians(H)
    return (L, C * math.cos(rad), C * math.sin(rad))


def oklab_to_oklch(lab):
    L, A, B = lab
    return (L, math.hypot(A, B), math.degrees(math.atan2(B, A)) % 360.0)


def hex_to_oklch(h):
    return oklab_to_oklch(rgb01_to_oklab(hex_to_rgb01(h)))


def in_gamut(rgb, eps=1e-4):
    return all(-eps <= c <= 1 + eps for c in rgb)


def oklch_to_hex(L, C, H):
    """Convert OKLCH to hex, reducing chroma until the colour fits in sRGB.

    Lightness and hue are preserved exactly; only chroma is sacrificed, which
    is the standard gamut-mapping tradeoff (CSS Color 4 does the same).
    """
    L = max(0.0, min(1.0, L))
    if C <= 0:
        return rgb01_to_hex(oklab_to_rgb01(oklch_to_oklab(L, 0, H)))
    lo, hi = 0.0, C
    if in_gamut(oklab_to_rgb01(oklch_to_oklab(L, C, H))):
        lo = C
    else:
        for _ in range(24):
            mid = (lo + hi) / 2
            if in_gamut(oklab_to_rgb01(oklch_to_oklab(L, mid, H))):
                lo = mid
            else:
                hi = mid
    rgb = oklab_to_rgb01(oklch_to_oklab(L, lo, H))
    return rgb01_to_hex(tuple(max(0.0, min(1.0, c)) for c in rgb))


# ================================================================== contrast

def wcag_luminance(hexv):
    r, g, b = (_srgb_to_linear(c) for c in hex_to_rgb01(hexv))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def wcag_contrast(a, b):
    la, lb = wcag_luminance(a), wcag_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# APCA-W3 0.1.9 constants, transcribed from Myndex/apca-w3 src/apca-w3.js
_APCA = dict(mainTRC=2.4, Rco=0.2126729, Gco=0.7151522, Bco=0.0721750,
             normBG=0.56, normTXT=0.57, revTXT=0.62, revBG=0.65,
             blkThrs=0.022, blkClmp=1.414, scale=1.14,
             loOffset=0.027, deltaYmin=0.0005, loClip=0.1)


def _apca_y(hexv):
    r, g, b = hex_to_rgb01(hexv)
    k = _APCA
    return (k['Rco'] * r ** k['mainTRC'] + k['Gco'] * g ** k['mainTRC']
            + k['Bco'] * b ** k['mainTRC'])


def apca_lc(text_hex, bg_hex):
    """APCA lightness contrast. Negative = light text on dark background."""
    k = _APCA
    ytxt, ybg = _apca_y(text_hex), _apca_y(bg_hex)
    soft = lambda y: y if y > k['blkThrs'] else y + (k['blkThrs'] - y) ** k['blkClmp']
    ytxt, ybg = soft(ytxt), soft(ybg)
    if abs(ybg - ytxt) < k['deltaYmin']:
        return 0.0
    if ybg > ytxt:  # dark text on light bg
        sapc = (ybg ** k['normBG'] - ytxt ** k['normTXT']) * k['scale']
        out = 0.0 if sapc < k['loClip'] else sapc - k['loOffset']
    else:           # light text on dark bg
        sapc = (ybg ** k['revBG'] - ytxt ** k['revTXT']) * k['scale']
        out = 0.0 if sapc > -k['loClip'] else sapc + k['loOffset']
    return out * 100.0


# ============================================ the proposed foreground algorithm

# Dual gate: a pair must clear the WCAG ratio AND the APCA |Lc|.
#
# Targets are calibrated against what VS Code's own Dark/Light Modern themes
# actually achieve, measured with this module (see tools/README):
#   primary chrome text  WCAG 10.5-15.7  APCA |Lc| 74.6-99.4
#   dimmed/inactive text WCAG  2.9- 6.1  APCA |Lc| 36.5-76.7
# We hold the primary floor at VS Code's own floor (Lc 75) and set the dimmed
# floor *above* VS Code's (Lc 40 icons / 60 text) because inactive title bar
# legibility is the specific thing users filed #70 and #73 about.
ROLE_TARGETS = {
    #                     wcag   apca   how much chroma the text keeps
    'text':      dict(wcag=4.5, apca=75, tint=0.30, tint_cap=0.045),
    'text_dim':  dict(wcag=4.5, apca=60, tint=0.30, tint_cap=0.045),
    'icon':      dict(wcag=4.5, apca=75, tint=0.25, tint_cap=0.040),
    'icon_dim':  dict(wcag=3.0, apca=40, tint=0.25, tint_cap=0.040),
}

# The contrast dead zone (see contrast_frontier()). A bar whose perceptual
# lightness lands between these bounds cannot carry readable text in *either*
# polarity, no matter what foreground you pick. Every bar lightness below must
# stay outside it; test_no_bar_in_dead_zone() enforces that.
# Measured sub-Lc-75 band is L 0.58-0.83; the bounds below are widened a notch
# on each side so the guard errs toward rejecting a marginal bar, not allowing one.
DEAD_ZONE = (0.56, 0.84)


def foreground_detail(bg_hex, role='text', margin=1.06):
    """Pick the *least extreme* colour that clears both contrast gates.

    Returns (hex, tinted). The colour is a low-chroma tint of the background's
    own hue — a "gray that belongs to this colour" rather than pure #FFF/#000.
    Stopping at the threshold instead of driving to the extreme is what keeps
    it a gray rather than white.

    `margin` buys headroom above the gate so 8-bit rounding can't drop a pair
    below the line.

    `tinted` is False when the background sits too close to mid-lightness for
    any tint of its own hue to reach the gate, forcing an achromatic fallback.
    That is a design smell, not a rendering bug: it means the *background*
    lightness is wrong. Callers should treat it as a failure.
    """
    t = ROLE_TARGETS[role]
    L_bg, C_bg, H_bg = hex_to_oklch(bg_hex)
    C_fg = min(C_bg * t['tint'], t['tint_cap'])

    want_wcag = t['wcag'] * margin
    want_apca = t['apca'] * margin

    def ok(hexv):
        return (wcag_contrast(hexv, bg_hex) >= want_wcag
                and abs(apca_lc(hexv, bg_hex)) >= want_apca)

    # Try both polarities; prefer the one that needs less travel from the
    # background, and fall back to the other if the first can't reach the gate.
    candidates = []
    for direction in ('lighter', 'darker'):
        lo, hi = (L_bg, 1.0) if direction == 'lighter' else (0.0, L_bg)
        if not ok(oklch_to_hex(hi if direction == 'lighter' else lo, C_fg, H_bg)):
            continue
        # Binary-search the L closest to the background that still passes.
        for _ in range(30):
            mid = (lo + hi) / 2
            if ok(oklch_to_hex(mid, C_fg, H_bg)):
                if direction == 'lighter':
                    hi = mid
                else:
                    lo = mid
            else:
                if direction == 'lighter':
                    lo = mid
                else:
                    hi = mid
        L_fg = hi if direction == 'lighter' else lo
        candidates.append((abs(L_fg - L_bg), oklch_to_hex(L_fg, C_fg, H_bg)))

    if not candidates:
        return max(('#FFFFFF', '#000000'),
                   key=lambda c: wcag_contrast(c, bg_hex)), False
    return min(candidates)[1], True


def foreground_for(bg_hex, role='text', margin=1.06):
    return foreground_detail(bg_hex, role, margin)[0]


# ==================================================== proposed bar backgrounds
#
# Each theme places the four bars at fixed perceptual lightnesses. The active
# title bar sits furthest from the editor background (most prominent); the
# inactive title bar recedes toward it. Hue and chroma carry the window's
# identity; lightness carries the role. Because lightness is fixed per role,
# every window gets the same visual hierarchy regardless of which hue it drew.

THEME_ENV = {
    'dark':  dict(editor='#1F1F1F', page_bg='#141414', vscode_chrome='#181818'),
    'light': dict(editor='#FFFFFF', page_bg='#F2F2F2', vscode_chrome='#F8F8F8'),
}

# Three points on the "how loud is the colour?" axis. This is the axis users
# are actually arguing about: #69 wants louder ("inactive title bars were going
# totally gray"), #73 wants calmer. Making it an explicit setting beats picking
# one hidden compromise. All three presets must clear the same contrast gates —
# vividness buys saturation, never legibility.
PRESETS = {
    'subtle': {
        'dark':  {'titleBarActive':   dict(L=0.30, C=0.055),
                  'activityBar':      dict(L=0.24, C=0.050),
                  'statusBar':        dict(L=0.24, C=0.050),
                  'titleBarInactive': dict(L=0.21, C=0.030)},
        'light': {'titleBarActive':   dict(L=0.93, C=0.055),
                  'activityBar':      dict(L=0.95, C=0.045),
                  'statusBar':        dict(L=0.95, C=0.045),
                  'titleBarInactive': dict(L=0.97, C=0.025)},
    },
    'balanced': {
        'dark':  {'titleBarActive':   dict(L=0.40, C=0.090),
                  'activityBar':      dict(L=0.31, C=0.085),
                  'statusBar':        dict(L=0.31, C=0.085),
                  'titleBarInactive': dict(L=0.25, C=0.055)},
        'light': {'titleBarActive':   dict(L=0.89, C=0.100),
                  'activityBar':      dict(L=0.92, C=0.075),
                  'statusBar':        dict(L=0.92, C=0.075),
                  'titleBarInactive': dict(L=0.95, C=0.045)},
    },
    'vivid': {
        'dark':  {'titleBarActive':   dict(L=0.52, C=0.130),
                  'activityBar':      dict(L=0.42, C=0.125),
                  'statusBar':        dict(L=0.42, C=0.125),
                  'titleBarInactive': dict(L=0.32, C=0.085)},
        'light': {'titleBarActive':   dict(L=0.88, C=0.150),
                  'activityBar':      dict(L=0.90, C=0.120),
                  'statusBar':        dict(L=0.90, C=0.120),
                  'titleBarInactive': dict(L=0.93, C=0.080)},
    },
}
DEFAULT_PRESET = 'balanced'

# Roles: which foreground gate each bar's text/icons must clear.
BAR_ROLES = {
    'titleBarActive':   'text',
    'titleBarInactive': 'text_dim',
    'activityBar':      'icon',
    'statusBar':        'text',
}


def build_window(base_hex, theme, preset=DEFAULT_PRESET):
    """Full colour set for one window, in one theme."""
    bars = PRESETS[preset][theme]
    _, C_base, H_base = hex_to_oklch(base_hex)
    out = {}
    for bar, geom in bars.items():
        # Scale the target chroma by how saturated the base colour is, so
        # achromatic bases (Gray/Black/White) stay genuinely neutral.
        chroma = min(geom['C'], C_base) if C_base < 0.04 else geom['C']
        bg = oklch_to_hex(geom['L'], chroma, H_base)
        role = BAR_ROLES[bar]
        fg, tinted = foreground_detail(bg, role)
        entry = {'bg': bg, 'fg': fg, 'tinted': tinted}
        if bar == 'activityBar':
            fg2, tinted2 = foreground_detail(bg, 'icon_dim')
            entry['fgInactive'], entry['tintedInactive'] = fg2, tinted2
        out[bar] = entry
    return out


def contrast_frontier(hue=250.0, chroma=0.09, tint=0.30, tint_cap=0.045):
    """Max achievable APCA |Lc| for a tinted-gray foreground, by bar lightness.

    This is what defines DEAD_ZONE: between roughly L 0.56 and L 0.82 neither
    a lighter nor a darker tint of the background's own hue can reach the text
    gate, so no foreground algorithm can rescue a bar placed there.
    """
    rows = []
    for i in range(5, 99):
        L = i / 100.0
        bg = oklch_to_hex(L, chroma, hue)
        _, C, _ = hex_to_oklch(bg)
        c_fg = min(C * tint, tint_cap)
        best = max(abs(apca_lc(oklch_to_hex(0.0, c_fg, hue), bg)),
                   abs(apca_lc(oklch_to_hex(1.0, c_fg, hue), bg)))
        rows.append((L, bg, best))
    return rows


def test_no_bar_in_dead_zone():
    """Guard: no preset may place a bar in the unreadable lightness band."""
    bad = []
    for preset, themes in PRESETS.items():
        for theme, bars in themes.items():
            for bar, geom in bars.items():
                if DEAD_ZONE[0] < geom['L'] < DEAD_ZONE[1]:
                    bad.append(f'{preset}/{theme}/{bar} L={geom["L"]}')
    return bad


# ==================================================================== palette
BASE_COLORS = [
    ('Red', '#c0392b'), ('Crimson', '#9b1b5a'), ('Blood', '#7a0808'),
    ('Berry', '#6b1048'), ('Brown', '#6d4c41'), ('Maroon', '#5c2020'),
    ('Orange', '#d88000'), ('Rust', '#a02c18'), ('Ember', '#a84808'),
    ('Yellow', '#f1c40f'), ('Olive', '#6b6b15'), ('Chartreuse', '#a3b820'),
    ('Green', '#27ae60'), ('Lime', '#6ba00d'), ('Forest', '#022002'),
    ('Sage', '#4a7a4a'), ('Emerald', '#10b035'), ('Juniper', '#18503e'),
    ('Teal', '#0a9e9e'), ('Petrol', '#0c7ba0'), ('Navy', '#031a30'),
    ('Blue', '#2980b9'), ('Cobalt', '#1050a0'), ('Ultramarine', '#1818a0'),
    ('Midnight', '#151540'), ('Indigo', '#3a2a80'), ('Purple', '#8e44ad'),
    ('Violet', '#7a10a0'), ('Plum', '#400a55'), ('Mauve', '#7a4878'),
    ('Magenta', '#a00da0'), ('Black', '#080808'), ('Gray', '#808080'),
    ('White', '#e0e0e0'),
]


def audit(verbose=False):
    fails = []
    worst = {}
    for preset in PRESETS:
        for name, hexv in BASE_COLORS:
            for theme in ('dark', 'light'):
                w = build_window(hexv, theme, preset)
                for bar, v in w.items():
                    checks = [('fg', v['fg'], ROLE_TARGETS[BAR_ROLES[bar]],
                               v['tinted'])]
                    if 'fgInactive' in v:
                        checks.append(('fgInactive', v['fgInactive'],
                                       ROLE_TARGETS['icon_dim'],
                                       v['tintedInactive']))
                    for label, fg, g, tinted in checks:
                        cr = wcag_contrast(fg, v['bg'])
                        lc = apca_lc(fg, v['bg'])
                        ok = cr >= g['wcag'] and abs(lc) >= g['apca'] and tinted
                        key = f'{preset}/{theme}/{bar}.{label}'
                        if key not in worst or abs(lc) < abs(worst[key][1]):
                            worst[key] = (cr, lc, name, v['bg'], fg)
                        if not ok:
                            fails.append((preset, name, theme,
                                          f'{bar}.{label}', v['bg'], fg, cr, lc))
                        if verbose:
                            print(f'{preset:<9} {name:<12} {theme:<6} '
                                  f'{bar + "." + label:<18} {v["bg"]:<9} {fg:<9} '
                                  f'{cr:>5.2f}:1 {lc:>+7.1f}  {"ok" if ok else "FAIL"}')

    print('Worst case across all 34 base colours, per preset/theme/bar:')
    print(f'  {"preset/theme/bar":<44} {"bg":<9} {"fg":<9} {"WCAG":>7} {"APCA":>7}')
    print('  ' + '-' * 78)
    for key in sorted(worst):
        cr, lc, name, bg, fg = worst[key]
        print(f'  {key:<44} {bg:<9} {fg:<9} {cr:>6.2f}:1 {lc:>+7.1f}')
    return fails


def emit_json():
    data = {'themes': THEME_ENV, 'presets': list(PRESETS), 'default': DEFAULT_PRESET,
            'deadZone': DEAD_ZONE, 'targets': ROLE_TARGETS, 'barRoles': BAR_ROLES,
            'frontier': [{'L': round(L, 2), 'hex': h, 'maxLc': round(lc, 1)}
                         for L, h, lc in contrast_frontier()],
            'colors': []}
    for name, hexv in BASE_COLORS:
        entry = {'name': name, 'base': hexv.upper(), 'presets': {}}
        for preset in PRESETS:
            entry['presets'][preset] = {}
            for theme in ('dark', 'light'):
                w = build_window(hexv, theme, preset)
                for v in w.values():
                    v['wcag'] = round(wcag_contrast(v['fg'], v['bg']), 2)
                    v['apca'] = round(apca_lc(v['fg'], v['bg']), 1)
                    if 'fgInactive' in v:
                        v['wcagInactive'] = round(
                            wcag_contrast(v['fgInactive'], v['bg']), 2)
                        v['apcaInactive'] = round(
                            apca_lc(v['fgInactive'], v['bg']), 1)
                entry['presets'][preset][theme] = w
        data['colors'].append(entry)
    return data


if __name__ == '__main__':
    if '--json' in sys.argv:
        print(json.dumps(emit_json(), indent=2))
        sys.exit(0)

    if '--frontier' in sys.argv:
        print(f'{"L":>6} {"bar":>9} {"max |Lc|":>9}')
        for L, h, lc in contrast_frontier():
            mark = '  <-- DEAD ZONE' if DEAD_ZONE[0] < L < DEAD_ZONE[1] else ''
            print(f'{L:>6.2f} {h:>9} {lc:>9.1f}{mark}')
        sys.exit(0)

    dz = test_no_bar_in_dead_zone()
    fails = audit(verbose='-v' in sys.argv)
    total = len(BASE_COLORS) * 2 * 5 * len(PRESETS)

    print(f'\ndead-zone guard: {"PASS" if not dz else "FAIL -> " + ", ".join(dz)}')
    print(f'contrast gate:   {len(fails)} of {total} pairs fail.')
    for f in fails[:20]:
        print(f'  FAIL {f[0]} {f[1]} {f[2]} {f[3]} bg={f[4]} fg={f[5]} '
              f'wcag={f[6]:.2f} apca={f[7]:+.1f}')
    sys.exit(0 if (not fails and not dz) else 1)
