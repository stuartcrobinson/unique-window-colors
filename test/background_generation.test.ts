import { equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Color from 'color';
import { contrastRatio, foregroundFor, MINIMUM_FOREGROUND_HEADROOM } from '../src/color_model';

interface NodeModuleLoader {
  _load(
    request: string,
    parent: NodeModuleLoader | undefined,
    isMain: boolean,
  ): unknown;
}

// Load the pure background-generation exports without a running VS Code host.
const nodeModule = require('node:module') as NodeModuleLoader;
const originalLoad = nodeModule._load;
let extension: typeof import('../src/extension');
try {
  nodeModule._load = function loadWithVscodeHost(request, parent, isMain) {
    if (request === 'vscode') {
      return {};
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  extension = require('../src/extension') as typeof import('../src/extension');
} finally {
  nodeModule._load = originalLoad;
}

const { BASE_COLORS, deriveThemedColors } = extension;

describe('background generation', () => {
  it('places every light-mode inactive title bar between the activity and active title bars', () => {
    for (const preset of BASE_COLORS) {
      const derived = deriveThemedColors(Color(preset.hex), 'light', true);
      ok(
        derived.inactiveTitleBar.luminosity() > derived.sideBar.luminosity(),
        `${preset.name} inactive title should be brighter than its activity bar`,
      );
      ok(
        derived.inactiveTitleBar.luminosity() < derived.titleBar.luminosity(),
        `${preset.name} inactive title should be darker than its active title`,
      );
      ok(
        derived.inactiveTitleBar.luminosity() >= 0.28 &&
          derived.inactiveTitleBar.luminosity() <= 0.32,
        `${preset.name} inactive title should be considerably brighter`,
      );

      const background = derived.inactiveTitleBar.hex();
      const foreground = foregroundFor(background);
      ok(
        contrastRatio(background, foreground) >= 6.5,
        `${preset.name} inactive title pair should comfortably clear WCAG AA`,
      );
    }
  });

  it('keeps the inactive title bar aligned with the activity bar in dark mode', () => {
    for (const preset of BASE_COLORS) {
      const derived = deriveThemedColors(Color(preset.hex), 'dark', true);
      equal(derived.inactiveTitleBar.hex(), derived.sideBar.hex(), preset.name);
      // The active title bar keeps its lift above the activity bar. This is
      // asserted as an ordering rather than as an exact `lighten(0.5)` result,
      // because a bar may afterwards be nudged out of the low-contrast dead
      // zone and no longer equal that formula exactly.
      ok(
        derived.titleBar.luminosity() > derived.sideBar.luminosity(),
        `${preset.name} active title should sit above its activity bar`,
      );

      const foreground = foregroundFor(derived.titleBar.hex());
      ok(
        contrastRatio(derived.titleBar.hex(), foreground) >= 4.5,
        `${preset.name} active title pair should clear WCAG AA`,
      );
    }
  });
});

describe('generated bars leave room for a readable foreground', () => {
  // Mid-luminance hues — the yellows, olives, oranges, rusts and browns — sit
  // where neither black nor white has much contrast, so a generated bar could
  // land at 4.9:1: legal under WCAG AA but visibly dim next to the ~10:1 the
  // other bars reach. Generated backgrounds are therefore pushed away from that
  // dead zone. This does not touch backgrounds a workspace already has.
  it('keeps every generated bar at or above the headroom floor', () => {
    for (const preset of BASE_COLORS) {
      for (const theme of ['dark', 'light'] as const) {
        const derived = deriveThemedColors(Color(preset.hex), theme);
        const bars: [string, Color][] = [
          ['activity bar', derived.sideBar],
          ['active title bar', derived.titleBar],
          ['inactive title bar', derived.inactiveTitleBar],
          ['status bar', derived.statusBar],
        ];
        for (const [label, bar] of bars) {
          const achieved = contrastRatio(bar.hex(), foregroundFor(bar.hex()));
          ok(
            achieved >= MINIMUM_FOREGROUND_HEADROOM - 0.05,
            `${preset.name} ${theme} ${label} (${bar.hex()}) reaches only ${achieved.toFixed(2)}:1`,
          );
        }
      }
    }
  });

  it('leaves a colour that already has headroom untouched', () => {
    // A very dark navy has plenty of room against white and must not be
    // darkened further just because the rule exists.
    const derived = deriveThemedColors(Color('#031a30'), 'dark');
    equal(derived.sideBar.hex(), deriveThemedColors(Color('#031a30'), 'dark').sideBar.hex());
    ok(contrastRatio(derived.sideBar.hex(), '#FFFFFF') > MINIMUM_FOREGROUND_HEADROOM);
  });
});
