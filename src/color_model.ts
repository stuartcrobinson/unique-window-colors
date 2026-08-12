import * as Color from 'color';

export type ColorCustomizations = Record<string, string | undefined>;

export interface ManagedColorAreas {
  activityBar: boolean;
  titleBar: boolean;
  statusBar: boolean;
  removeAll: boolean;
}

export const BACKGROUND_FOREGROUND_PAIRS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['activityBar.background', ['activityBar.foreground', 'activityBar.inactiveForeground']],
  ['titleBar.activeBackground', ['titleBar.activeForeground']],
  ['titleBar.inactiveBackground', ['titleBar.inactiveForeground']],
  ['statusBar.background', ['statusBar.foreground']],
  ['statusBar.debuggingBackground', ['statusBar.debuggingForeground']],
  ['statusBar.noFolderBackground', ['statusBar.noFolderForeground']],
  // VS Code draws the window title inside the command center. Its stylesheet
  // only ever reads --vscode-commandCenter-foreground: it registers
  // commandCenter.inactiveForeground but no CSS rule uses it, so the title text
  // keeps the ACTIVE colour after a window loses focus. With a light-mode
  // palette that leaves black text on the dark inactive bar at 1.41:1.
  //
  // One shared foreground cannot be legible on both a pale active bar and a
  // dark inactive one — no sRGB colour reaches even 3:1 against both — so the
  // command center is given its own background and reads as a self-contained
  // chip in either state.
  ['commandCenter.background', [
    'commandCenter.foreground',
    'commandCenter.activeForeground',
    'commandCenter.inactiveForeground',
  ]],
];

export const MANAGED_COLOR_KEYS: readonly string[] = BACKGROUND_FOREGROUND_PAIRS.reduce<string[]>(
  (keys, [backgroundKey, foregroundKeys]) => keys.concat(backgroundKey, ...foregroundKeys),
  [],
);

/**
 * Parse a base color supplied through settings. The value can be hand-edited or
 * come from workspace settings, so an unusable string must not abort coloring.
 */
export function parseBaseColor(value: string): Color | undefined {
  try {
    return Color(value);
  } catch {
    return undefined;
  }
}

const MAX_LUMINOSITY_ITERATIONS = 500;

export function getColorWithLuminosity(color: Color, min: number, max: number): Color {
  let candidate: Color = Color(color.hex());
  let iterations = 0;
  while (candidate.luminosity() > max && iterations++ < MAX_LUMINOSITY_ITERATIONS) {
    candidate = candidate.darken(0.01);
  }
  while (candidate.luminosity() < min && iterations++ < MAX_LUMINOSITY_ITERATIONS) {
    candidate = candidate.lighten(0.01);
  }
  return candidate;
}

export function contrastRatio(first: string | Color, second: string | Color): number {
  const firstLuminosity = typeof first === 'string' ? Color(first).luminosity() : first.luminosity();
  const secondLuminosity = typeof second === 'string' ? Color(second).luminosity() : second.luminosity();
  return (Math.max(firstLuminosity, secondLuminosity) + 0.05) /
    (Math.min(firstLuminosity, secondLuminosity) + 0.05);
}

/**
 * Contrast ratio that generated foregrounds aim for.
 *
 * Using the strongest neutral made contrast an accident of the background: it
 * ranged from 4.9:1 to 16.7:1 across the presets, so bars in one window did not
 * match — glare on a dark activity bar beside a washed-out title bar. A fixed
 * target evens the window out. Comfortably above WCAG AA (4.5:1) and AAA (7:1).
 */
export const TARGET_FOREGROUND_CONTRAST = 10;

/** Bisection steps; 24 is far past the precision an 8-bit channel can show. */
const CONTRAST_SEARCH_STEPS = 24;

/**
 * Contrast a generated bar must be able to offer its foreground.
 *
 * Mid-luminance hues — yellows, olives, oranges, rusts, browns — sit where
 * neither neutral has much room, so they cannot reach the target above and look
 * dim beside bars that do. Moving them out of that dead zone trades a little
 * vividness for legibility. 7:1 is WCAG AAA for normal text.
 */
export const MINIMUM_FOREGROUND_HEADROOM = 7;

/** Step size when moving a background out of the low-contrast dead zone. */
const HEADROOM_STEP = 0.01;
const MAX_HEADROOM_STEPS = 400;

/**
 * Move a generated background away from mid-luminance until the better neutral
 * can reach MINIMUM_FOREGROUND_HEADROOM against it.
 *
 * Applies only to colors this extension generates. Backgrounds a workspace
 * already has are authoritative and must never be pushed around by this.
 */
export function ensureForegroundHeadroom(color: Color): Color {
  const towardWhite = contrastRatio(color, '#FFFFFF') >= contrastRatio(color, '#000000');
  const neutral = towardWhite ? '#FFFFFF' : '#000000';

  let adjusted = color;
  let steps = 0;
  while (
    contrastRatio(adjusted, neutral) < MINIMUM_FOREGROUND_HEADROOM &&
    steps++ < MAX_HEADROOM_STEPS
  ) {
    // A light foreground needs a darker bar; a dark foreground needs a lighter
    // one. Either way the bar moves further from the middle.
    adjusted = towardWhite ? adjusted.darken(HEADROOM_STEP) : adjusted.lighten(HEADROOM_STEP);
  }
  return adjusted;
}

/**
 * Derive a readable foreground from the exact background it will be painted on.
 *
 * Picks the neutral direction with more room, then softens toward the
 * background until the result just clears TARGET_FOREGROUND_CONTRAST. When the
 * background has no headroom — the strongest neutral is already short of the
 * target — that neutral is used unchanged.
 */
export function foregroundFor(background: string): string {
  const backgroundColor = Color(background);
  if (backgroundColor.alpha() < 1) {
    throw new Error('Cannot determine contrast for a translucent background');
  }

  const black = Color('#000000');
  const white = Color('#FFFFFF');
  const extreme = contrastRatio(backgroundColor, white) >= contrastRatio(backgroundColor, black)
    ? white
    : black;

  if (contrastRatio(backgroundColor, extreme) <= TARGET_FOREGROUND_CONTRAST) {
    return extreme.hex();
  }

  // Contrast falls monotonically as the foreground moves toward the background,
  // so bisect for the softest foreground that still meets the target. Each
  // candidate is rounded to 8-bit first, so the ratio measured here is the ratio
  // the returned colour actually delivers.
  let meetsTarget = 0;      // mix weight known to satisfy the target
  let missesTarget = 1;     // mix weight landing on the background itself
  let result = extreme;
  for (let step = 0; step < CONTRAST_SEARCH_STEPS; step++) {
    const weight = (meetsTarget + missesTarget) / 2;
    const candidate = Color(extreme.mix(backgroundColor, weight).hex());
    if (contrastRatio(backgroundColor, candidate) >= TARGET_FOREGROUND_CONTRAST) {
      result = candidate;
      meetsTarget = weight;
    } else {
      missesTarget = weight;
    }
  }
  return result.hex();
}

/**
 * Opacity VS Code forces onto the contents of an inactive title bar.
 *
 * Its stylesheet contains `.part.titlebar.inactive > * { opacity: .6 }`, which
 * is not themeable. Whatever colour is written for `titleBar.inactiveForeground`
 * is therefore composited over its own background before anyone sees it, so
 * writing the same hex as the undimmed bars renders visibly fainter than them
 * rather than identical — 10.05:1 becomes 4.54:1 on a #05284A bar.
 */
export const INACTIVE_TITLE_BAR_OPACITY = 0.6;

/**
 * Foreground roles that sit inside the title bar and are therefore subject to
 * the dimming above. The command center roles are included because the chip
 * lives in the title bar, so its text is dimmed along with everything else.
 */
const DIMMED_WITH_INACTIVE_TITLE_BAR: ReadonlySet<string> = new Set([
  'titleBar.inactiveForeground',
  'commandCenter.foreground',
  'commandCenter.activeForeground',
  'commandCenter.inactiveForeground',
]);

const CHANNEL_MAX = 255;

/**
 * Pre-brighten a foreground so that, once VS Code dims it, what lands on screen
 * is as close to `target` as the sRGB gamut allows.
 *
 * Compositing is linear per channel: rendered = opacity*written + (1-opacity)*background.
 * Solving for the value to write and clamping to the channel range gives the
 * closest achievable match; an exact one is often out of gamut, in which case
 * the strongest available colour is used and the bar simply reads a little
 * quieter than the others.
 */
export function compensateForInactiveTitleOpacity(background: string, target: string): string {
  const backgroundColor = Color(background);
  const targetColor = Color(target);
  const written = [0, 1, 2].map(channel => {
    const base = backgroundColor.rgb().array()[channel];
    const wanted = targetColor.rgb().array()[channel];
    const value = (wanted - (1 - INACTIVE_TITLE_BAR_OPACITY) * base) / INACTIVE_TITLE_BAR_OPACITY;
    return Math.round(Math.min(CHANNEL_MAX, Math.max(0, value)));
  });
  return Color.rgb(written).hex();
}

/** Contrast the unfocused title bar must still offer once VS Code dims it. */
const INACTIVE_TITLE_LEGIBILITY_FLOOR = 4.5;
const INACTIVE_SHIFT_STEP = 0.01;
/** Where the shift starts: enough to read as a change, small enough to keep the hue. */
const PREFERRED_INACTIVE_SHIFT_STEPS = 25;
const MAX_INACTIVE_SHIFT_STEPS = 60;

/**
 * Derive the unfocused title bar from the focused one.
 *
 * It must stay on the same side of the luminance midpoint as the focused bar.
 * VS Code paints the window title from `commandCenter.foreground` in both focus
 * states — `commandCenter.inactiveForeground` is registered but no CSS rule
 * reads it — so one colour has to serve both bars. Two bars on opposite sides
 * demand opposite neutrals, and then no colour can: that is how a light-mode
 * window ended up with black title text on a dark bar at 1.41:1.
 *
 * So the bar is moved *away* from its own text colour, never past it, as far as
 * legibility allows once the 60% dimming is applied. That keeps a clear focus
 * cue while leaving the shared foreground usable.
 */
export function deriveInactiveTitleBar(activeTitleBar: Color): Color {
  const shared = foregroundFor(activeTitleBar.hex());
  const textIsLight = Color(shared).luminosity() > 0.5;

  const shift = (amount: number): Color =>
    textIsLight ? activeTitleBar.darken(amount) : activeTitleBar.lighten(amount);
  const legibilityOf = (bar: Color): number =>
    contrastRatio(bar.hex(), Color(bar.hex()).mix(Color(shared), INACTIVE_TITLE_BAR_OPACITY).hex());

  // Start from a moderate shift and grow it only while the bar is still hard to
  // read. Taking the largest legible shift instead would drive most bars to
  // plain white or black, throwing away the very thing this extension exists to
  // provide: a colour that identifies the window.
  for (let step = PREFERRED_INACTIVE_SHIFT_STEPS; step <= MAX_INACTIVE_SHIFT_STEPS; step++) {
    const candidate = shift(step * INACTIVE_SHIFT_STEP);
    if (legibilityOf(candidate) >= INACTIVE_TITLE_LEGIBILITY_FLOOR) {
      return candidate;
    }
  }

  // Very bright bars — the yellows above all — cannot reach the floor at any
  // shift, because dark text dimmed to 60% on a light bar is inherently low
  // contrast. Take the largest shift, which reads best of the options.
  return shift(MAX_INACTIVE_SHIFT_STEPS * INACTIVE_SHIFT_STEP);
}

/** Return a copy with foregrounds synchronized to their actual backgrounds. */
export function improveForegrounds(customizations: ColorCustomizations): ColorCustomizations {
  const improved = { ...customizations };
  for (const [backgroundKey, foregroundKeys] of BACKGROUND_FOREGROUND_PAIRS) {
    const background = improved[backgroundKey];
    if (!background) {
      continue;
    }

    try {
      const foreground = foregroundFor(background);
      for (const foregroundKey of foregroundKeys) {
        // Roles inside the title bar are dimmed by VS Code when the window
        // loses focus, so they need a stronger value to end up looking like the
        // bars beside them.
        improved[foregroundKey] = DIMMED_WITH_INACTIVE_TITLE_BAR.has(foregroundKey)
          ? compensateForInactiveTitleOpacity(background, foreground)
          : foreground;
      }
    } catch {
      // Preserve the user's current foreground when a background is not a CSS color.
    }
  }
  return improved;
}

/** Capture only backgrounds owned by this extension, preserving exact strings. */
export function extractBackgrounds(customizations: ColorCustomizations): ColorCustomizations {
  const backgrounds: ColorCustomizations = {};
  for (const [backgroundKey] of BACKGROUND_FOREGROUND_PAIRS) {
    const background = customizations[backgroundKey];
    if (background !== undefined) {
      backgrounds[backgroundKey] = background;
    }
  }
  return backgrounds;
}

/** Restore remembered backgrounds only where workspace settings have no value. */
export function mergePreservedBackgrounds(
  current: ColorCustomizations,
  preserved: ColorCustomizations | undefined,
): ColorCustomizations {
  const merged = { ...current };
  if (!preserved) {
    return merged;
  }

  for (const [backgroundKey] of BACKGROUND_FOREGROUND_PAIRS) {
    if (merged[backgroundKey] === undefined && preserved[backgroundKey] !== undefined) {
      merged[backgroundKey] = preserved[backgroundKey];
    }
  }
  return merged;
}

const UNIFIED_INACTIVE_BACKGROUND_KEYS = [
  'titleBar.inactiveBackground',
  'statusBar.background',
  'statusBar.debuggingBackground',
  'statusBar.noFolderBackground',
] as const;

/**
 * Upgrade an existing workspace to the unified inactive-bar layout.
 *
 * The activity background remains the authoritative anchor. This versioned
 * migration intentionally replaces the extension-managed inactive-title and
 * status backgrounds so the layout guarantee applies to every existing opaque
 * workspace, not only palettes whose historical floating-point calculations
 * can be reconstructed exactly. The active title background is never changed.
 * Invalid and translucent anchors are left alone because their final rendered
 * foreground cannot be determined safely.
 *
 * The returned object is a copy. Activation can compare it with the current
 * snapshot and perform one settings update without mutating its source data.
 */
export function migrateLegacyGeneratedBarLayout(
  current: ColorCustomizations,
): ColorCustomizations {
  const migrated = { ...current };
  const activityBackground = current['activityBar.background'];
  if (!activityBackground) {
    return migrated;
  }

  let activityColor: Color;
  try {
    activityColor = Color(activityBackground);
  } catch {
    return migrated;
  }

  if (activityColor.alpha() < 1) {
    return migrated;
  }

  for (const key of UNIFIED_INACTIVE_BACKGROUND_KEYS) {
    // Missing roles are still filled by normal generation according to the
    // user's enabled bar settings. This migration only replaces saved roles.
    if (current[key] !== undefined) {
      migrated[key] = activityBackground;
    }
  }

  return migrated;
}

/** Apply the complete managed-color policy as one deterministic transformation. */
export function reconcileColorCustomizations(
  current: ColorCustomizations,
  preservedBackgrounds: ColorCustomizations | undefined,
  generatedBackgrounds: ColorCustomizations,
  areas: ManagedColorAreas,
): ColorCustomizations {
  const restored = mergePreservedBackgrounds(current, preservedBackgrounds);
  const reconciled = mergePreservedBackgrounds(restored, generatedBackgrounds);
  const removeManagedArea = (prefix: string) => {
    for (const key of MANAGED_COLOR_KEYS) {
      if (key.startsWith(prefix)) {
        delete reconciled[key];
      }
    }
  };

  if (areas.removeAll) {
    for (const key of MANAGED_COLOR_KEYS) {
      delete reconciled[key];
    }
    return reconciled;
  }

  if (!areas.activityBar) { removeManagedArea('activityBar.'); }
  if (!areas.titleBar) { removeManagedArea('titleBar.'); }
  if (!areas.statusBar) { removeManagedArea('statusBar.'); }
  return improveForegrounds(reconciled);
}
