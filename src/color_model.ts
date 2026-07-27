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
 * Derive a readable foreground from the exact background it will be painted on.
 * Black or white always provides the strongest available sRGB contrast for an
 * opaque background; choose the better of those two neutral endpoints.
 */
export function foregroundFor(background: string): string {
  const backgroundColor = Color(background);
  if (backgroundColor.alpha() < 1) {
    throw new Error('Cannot determine contrast for a translucent background');
  }

  const black = Color('#000000');
  const white = Color('#FFFFFF');
  return contrastRatio(backgroundColor, white) >= contrastRatio(backgroundColor, black)
    ? white.hex()
    : black.hex();
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
