import { equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Color from 'color';
import { contrastRatio, foregroundFor } from '../src/color_model';

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
      equal(
        derived.titleBar.hex(),
        derived.sideBar.lighten(0.5).hex(),
        `${preset.name} active title should use the brighter dark-mode lift`,
      );

      const foreground = foregroundFor(derived.titleBar.hex());
      ok(
        contrastRatio(derived.titleBar.hex(), foreground) >= 4.5,
        `${preset.name} active title pair should clear WCAG AA`,
      );
    }
  });
});
