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
        improved[foregroundKey] = foreground;
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
