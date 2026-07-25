import * as Color from 'color';

export type ColorCustomizations = Record<string, string | undefined>;

export const BACKGROUND_FOREGROUND_PAIRS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['activityBar.background', ['activityBar.foreground', 'activityBar.inactiveForeground']],
  ['titleBar.activeBackground', ['titleBar.activeForeground']],
  ['titleBar.inactiveBackground', ['titleBar.inactiveForeground']],
  ['statusBar.background', ['statusBar.foreground']],
  ['statusBar.debuggingBackground', ['statusBar.debuggingForeground']],
  ['statusBar.noFolderBackground', ['statusBar.noFolderForeground']],
];

const MAX_LUMINOSITY_ITERATIONS = 500;
const WCAG_AA_CONTRAST = 4.5;

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
 * Prefer the existing same-hue near-white/near-black treatment when it clears
 * WCAG AA, then fall back to black or white for mid-luminance backgrounds that
 * cannot support a readable tint.
 */
export function foregroundFor(background: string): string {
  const backgroundColor = Color(background);
  const tintedCandidates = [
    getColorWithLuminosity(backgroundColor, 0.95, 1),
    getColorWithLuminosity(backgroundColor, 0, 0.01),
  ];
  const passingTint = tintedCandidates
    .map(candidate => ({ candidate, contrast: contrastRatio(backgroundColor, candidate) }))
    .filter(({ contrast }) => contrast >= WCAG_AA_CONTRAST)
    .sort((left, right) => right.contrast - left.contrast)[0];

  if (passingTint) {
    return passingTint.candidate.hex();
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
