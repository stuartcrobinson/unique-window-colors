"""
Generate 25 maximally distinct colors for dark and light mode.
Uses HSL for reliable gamut coverage, OKLAB for perceptual distance.
"""
import colorsys
import json
import math


def hsl_to_hex(h, s, l):
    """h in [0,360], s in [0,1], l in [0,1] -> '#rrggbb'"""
    r, g, b = colorsys.hls_to_rgb(h / 360.0, l, s)
    return '#{:02x}{:02x}{:02x}'.format(
        int(round(r * 255)), int(round(g * 255)), int(round(b * 255)))


def hex_to_rgb01(h):
    return int(h[1:3], 16)/255, int(h[3:5], 16)/255, int(h[5:7], 16)/255


def rgb01_to_oklab(r, g, b):
    """sRGB [0,1] -> OKLab (L, a, b)"""
    def inv_gamma(x):
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = inv_gamma(r), inv_gamma(g), inv_gamma(b)
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    l_ = l_ ** (1/3) if l_ > 0 else 0
    m_ = m_ ** (1/3) if m_ > 0 else 0
    s_ = s_ ** (1/3) if s_ > 0 else 0
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, A, B


def delta_e_ok(hex1, hex2):
    """Perceptual distance in OKLab space."""
    L1, a1, b1 = rgb01_to_oklab(*hex_to_rgb01(hex1))
    L2, a2, b2 = rgb01_to_oklab(*hex_to_rgb01(hex2))
    return math.sqrt((L1 - L2)**2 + (a1 - a2)**2 + (b1 - b2)**2)


def generate_candidates(lightness_range, saturation_range, n_hues=120):
    """Generate candidates with guaranteed full hue coverage."""
    candidates = []
    l_min, l_max = lightness_range
    s_min, s_max = saturation_range
    n_l = 5
    n_s = 5
    for hi in range(n_hues):
        hue = (hi / n_hues) * 360
        for li in range(n_l):
            l = l_min + (l_max - l_min) * li / (n_l - 1)
            for si in range(n_s):
                s = s_min + (s_max - s_min) * si / (n_s - 1)
                candidates.append(hsl_to_hex(hue, s, l))
    return list(dict.fromkeys(candidates))


def greedy_select(candidates, n):
    """Greedy max-min-distance selection."""
    # Start with the candidate that has the most unique hue region
    selected = [candidates[0]]
    remaining = list(range(1, len(candidates)))
    min_dist = {i: delta_e_ok(candidates[0], candidates[i]) for i in remaining}

    for _ in range(n - 1):
        best = max(remaining, key=lambda i: min_dist[i])
        selected.append(candidates[best])
        remaining.remove(best)
        for i in remaining:
            d = delta_e_ok(candidates[best], candidates[i])
            if d < min_dist[i]:
                min_dist[i] = d

    return selected


def oklab_hue(hex_color):
    L, a, b = rgb01_to_oklab(*hex_to_rgb01(hex_color))
    return math.degrees(math.atan2(b, a)) % 360


# ---- Dark mode ----
# Lightness 0.13-0.22 in HSL, saturation 0.3-0.9
# This gives dark but clearly tinted colors
print("Generating dark mode candidates...")
dark_cands = generate_candidates(
    lightness_range=(0.13, 0.22),
    saturation_range=(0.30, 0.90),
    n_hues=120
)
print(f"  {len(dark_cands)} candidates")

print("Selecting 25 dark colors...")
dark_palette = greedy_select(dark_cands, 25)
dark_palette.sort(key=oklab_hue)

# ---- Light mode ----
# Lightness 0.72-0.82, saturation 0.35-0.85
# Pastel but not washed out
print("Generating light mode candidates...")
light_cands = generate_candidates(
    lightness_range=(0.72, 0.82),
    saturation_range=(0.35, 0.85),
    n_hues=120
)
print(f"  {len(light_cands)} candidates")

print("Selecting 25 light colors...")
light_palette = greedy_select(light_cands, 25)
light_palette.sort(key=oklab_hue)

print()
print("=== DARK MODE (25 colors) ===")
for i, h in enumerate(dark_palette):
    r, g, b = hex_to_rgb01(h)
    hsl_h = colorsys.rgb_to_hls(r, g, b)
    print(f"  {i+1:2d}. {h}  (hue≈{oklab_hue(h):5.1f}°)")

print()
print("=== LIGHT MODE (25 colors) ===")
for i, h in enumerate(light_palette):
    print(f"  {i+1:2d}. {h}  (hue≈{oklab_hue(h):5.1f}°)")

print()
print("// JS arrays:")
print(f"const DARK_COLORS = {json.dumps(dark_palette)};")
print()
print(f"const LIGHT_COLORS = {json.dumps(light_palette)};")
