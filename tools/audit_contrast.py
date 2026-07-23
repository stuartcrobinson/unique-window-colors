"""
Audit the CURRENT (v1.2.9) color derivation for contrast failures.

Faithfully reimplements src/extension.ts `deriveThemedColors` and
`getColorWithLuminosity`, including the npm `color@3` semantics they rely on
(HSL-space lighten/darken, WCAG relative luminance).

Run:  python3 tools/audit_contrast.py
Exit code is non-zero if any text/background pair falls below WCAG AA (4.5:1),
so this doubles as a regression gate.

Known-answer check: base 'Petrol' in light mode must reproduce the exact hexes
a user reported in issue #73 (#053241 / #34C1F0 / #031C25).
"""
import colorsys
import sys

# ---------------------------------------------------------------- color model
# Mirrors npm `color@3`: HSL is the working space for lighten/darken, and
# `.luminosity()` is WCAG relative luminance.


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return '#{:02X}{:02X}{:02X}'.format(
        *(max(0, min(255, int(round(c)))) for c in rgb))


def rgb_to_hsl(rgb):
    r, g, b = (c / 255.0 for c in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return [h * 360.0, s * 100.0, l * 100.0]


def hsl_to_rgb(hsl):
    h, s, l = hsl
    # color-convert clamps s/l into range on conversion
    s = max(0.0, min(100.0, s)) / 100.0
    l = max(0.0, min(100.0, l)) / 100.0
    r, g, b = colorsys.hls_to_rgb((h % 360.0) / 360.0, l, s)
    return (r * 255.0, g * 255.0, b * 255.0)


class Color:
    """Minimal stand-in for npm `color@3`, HSL-backed like the real thing."""

    def __init__(self, value):
        if isinstance(value, str):
            self.hsl = rgb_to_hsl(hex_to_rgb(value))
        else:
            self.hsl = list(value)

    def rgb(self):
        return hsl_to_rgb(self.hsl)

    def hex(self):
        return rgb_to_hex(self.rgb())

    def hue(self):
        return self.hsl[0]

    def saturationl(self):
        return self.hsl[1]

    def lightness(self, value=None):
        if value is None:
            return self.hsl[2]
        return Color([self.hsl[0], self.hsl[1], value])

    def lighten(self, ratio):
        # color@3: hsl[2] += hsl[2] * ratio
        return Color([self.hsl[0], self.hsl[1], self.hsl[2] + self.hsl[2] * ratio])

    def darken(self, ratio):
        return Color([self.hsl[0], self.hsl[1], self.hsl[2] - self.hsl[2] * ratio])

    def luminosity(self):
        def chan(c):
            c = c / 255.0
            return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
        r, g, b = self.rgb()
        return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)


def contrast(a, b):
    """WCAG 2.x contrast ratio between two Colors (or hex strings)."""
    la = a.luminosity() if isinstance(a, Color) else Color(a).luminosity()
    lb = b.luminosity() if isinstance(b, Color) else Color(b).luminosity()
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ------------------------------------------------------- extension.ts, verbatim
MAX_LUMINOSITY_ITERATIONS = 500


def get_color_with_luminosity(color, lo, hi):
    c = Color(color.hex())
    it = 0
    while c.luminosity() > hi and it < MAX_LUMINOSITY_ITERATIONS:
        it += 1
        c = c.darken(0.01)
    while c.luminosity() < lo and it < MAX_LUMINOSITY_ITERATIONS:
        it += 1
        c = c.lighten(0.01)
    return c


def derive_themed_colors(raw, theme, respect_extremes=False):
    hue = raw.hue()
    yellowish = 40 <= hue <= 70
    achromatic = raw.saturationl() < 5
    orangish = (not achromatic) and 8 <= hue < 40
    grayish = achromatic and 0.05 < raw.luminosity() < 0.5
    whitish = achromatic and raw.luminosity() >= 0.5

    dk_min = 0.03 if whitish else 0.008 if grayish else 0.05 if yellowish else 0.08 if orangish else 0.02
    dk_max = 0.045 if whitish else 0.013 if grayish else 0.07 if yellowish else 0.11 if orangish else 0.027

    if theme == 'dark':
        side = raw if (respect_extremes and raw.luminosity() < dk_min) \
            else get_color_with_luminosity(raw, dk_min, dk_max)
        return {
            'sideBar': side,
            'titleBar': side.lighten(0.4),
            'titleBarText': get_color_with_luminosity(side, 0.95, 1),
            'statusBar': side,
            'statusBarText': get_color_with_luminosity(side, 0.95, 1),
        }

    if theme == 'light':
        side = raw if (respect_extremes and raw.luminosity() < dk_min) \
            else get_color_with_luminosity(raw, dk_min, dk_max)
        lt_min = 0.65 if grayish else 0.45
        lt_max = 0.75 if grayish else 0.55
        title = raw if (respect_extremes and raw.luminosity() > lt_max) \
            else get_color_with_luminosity(raw, lt_min, lt_max)
        status = side.lightness(side.lightness() + 4)
        return {
            'sideBar': side,
            'titleBar': title,
            'titleBarText': get_color_with_luminosity(title, 0, 0.01),
            'statusBar': status,
            'statusBarText': get_color_with_luminosity(status, 0.95, 1),
        }

    raise ValueError(theme)


# ------------------------------------------------------------------- palette
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

# VS Code default editor backgrounds, for "does the chrome read as part of the
# theme, or as a black hole?" checks.
EDITOR_BG = {'dark': '#1F1F1F', 'light': '#FFFFFF'}

AA = 4.5      # WCAG AA, normal text
UI_MIN = 3.0  # WCAG AA, large text / UI components


def audit():
    failures = []
    print(f'{"color":<12} {"theme":<6} {"bar":<16} {"bg":<9} {"fg":<9} {"ratio":>7}  verdict')
    print('-' * 78)
    for name, hexv in BASE_COLORS:
        for theme in ('dark', 'light'):
            d = derive_themed_colors(Color(hexv), theme)
            pairs = [
                ('titleBar.active', d['titleBar'], d['titleBarText']),
                # NOTE: extension.ts writes inactiveBackground = sideBar but
                # inactiveForeground = titleBarText (derived from the *active*
                # title bar). That mismatch is the bug behind #70 / #73.
                ('titleBar.inactive', d['sideBar'], d['titleBarText']),
                ('statusBar', d['statusBar'], d['statusBarText']),
            ]
            for bar, bg, fg in pairs:
                r = contrast(bg, fg)
                ok = r >= AA
                if not ok:
                    failures.append((name, theme, bar, bg.hex(), fg.hex(), r))
                print(f'{name:<12} {theme:<6} {bar:<16} {bg.hex():<9} {fg.hex():<9} '
                      f'{r:>6.2f}:1  {"ok" if ok else "FAIL"}')
    return failures


def known_answer_check():
    """Issue #73 reported exact hexes; reproduce them from base 'Petrol'."""
    d = derive_themed_colors(Color('#0c7ba0'), 'light')
    got = (d['sideBar'].hex(), d['titleBar'].hex(), d['titleBarText'].hex())
    want = ('#053241', '#34C1F0', '#031C25')
    print('\nknown-answer check (issue #73, base Petrol, light mode)')
    print(f'  expected {want}')
    print(f'  actual   {got}')
    match = got == want
    print(f'  -> {"MATCH — reimplementation is faithful" if match else "MISMATCH"}')
    return match


if __name__ == '__main__':
    fails = audit()
    faithful = known_answer_check()

    print(f'\n{len(fails)} of {len(BASE_COLORS) * 2 * 3} text/background pairs '
          f'fall below WCAG AA ({AA}:1).')
    if fails:
        worst = sorted(fails, key=lambda f: f[5])[:12]
        print('\nworst offenders:')
        for name, theme, bar, bg, fg, r in worst:
            print(f'  {r:5.2f}:1  {name:<12} {theme:<6} {bar:<18} bg={bg} fg={fg}')

    # Non-zero exit when the audit finds failures, so CI can gate on it.
    sys.exit(0 if (not fails and faithful) else 1)
