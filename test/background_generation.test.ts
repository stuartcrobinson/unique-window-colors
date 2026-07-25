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
  it('slightly lightens every inactive title bar in light mode', () => {
    for (const preset of BASE_COLORS) {
      const derived = deriveThemedColors(Color(preset.hex), 'light', true);
      equal(
        derived.inactiveTitleBar.lightness(),
        derived.sideBar.lightness() + 4,
        `${preset.name} should add four lightness points`,
      );

      const background = derived.inactiveTitleBar.hex();
      const foreground = foregroundFor(background);
      ok(
        contrastRatio(background, foreground) >= 4.5,
        `${preset.name} inactive title pair should clear WCAG AA`,
      );
    }
  });

  it('keeps the inactive title bar aligned with the activity bar in dark mode', () => {
    for (const preset of BASE_COLORS) {
      const derived = deriveThemedColors(Color(preset.hex), 'dark', true);
      equal(derived.inactiveTitleBar.hex(), derived.sideBar.hex(), preset.name);
    }
  });
});
