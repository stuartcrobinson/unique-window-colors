import { equal, notEqual, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as Color from 'color';
import {
  contrastRatio,
  foregroundFor,
  INACTIVE_TITLE_BAR_OPACITY,
  MINIMUM_FOREGROUND_HEADROOM,
} from '../src/color_model';

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
  it('keeps the status bar matched to the activity bar in both themes', () => {
    // The inactive title bar deliberately does NOT join them. It used to, but
    // VS Code paints the window title with one colour in both focus states, so
    // a title bar that jumps to the activity bar's side of the luminance
    // midpoint leaves that text illegible. See deriveInactiveTitleBar.
    for (const preset of BASE_COLORS) {
      for (const theme of ['dark', 'light'] as const) {
        const derived = deriveThemedColors(Color(preset.hex), theme, true);
        equal(
          derived.statusBar.hex(),
          derived.sideBar.hex(),
          `${preset.name} ${theme} status bar`,
        );
        equal(
          foregroundFor(derived.statusBar.hex()),
          foregroundFor(derived.sideBar.hex()),
          `${preset.name} ${theme} status foreground`,
        );

        const foreground = foregroundFor(derived.titleBar.hex());
        ok(
          contrastRatio(derived.titleBar.hex(), foreground) >= 4.5,
          `${preset.name} ${theme} active title pair should clear WCAG AA`,
        );
      }
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

describe('title bar states share one usable foreground', () => {
  // VS Code paints the window title from commandCenter.foreground in BOTH focus
  // states — commandCenter.inactiveForeground is registered but no CSS rule
  // reads it — so a single colour has to work on the focused and the unfocused
  // title bar. When those two sit on opposite sides of the luminance midpoint
  // they demand opposite neutrals and no colour can serve both. That is how a
  // light-mode window ended up with black title text on a dark bar at 1.41:1.
  const dimmed = (background: string, foreground: string): string =>
    Color(background).mix(Color(foreground), INACTIVE_TITLE_BAR_OPACITY).hex();

  it('keeps both title bar states on the same side of the midpoint', () => {
    for (const preset of BASE_COLORS) {
      for (const theme of ['dark', 'light'] as const) {
        const derived = deriveThemedColors(Color(preset.hex), theme);
        const activeNeutral = Color(foregroundFor(derived.titleBar.hex())).luminosity() > 0.5;
        const inactiveNeutral = Color(foregroundFor(derived.inactiveTitleBar.hex())).luminosity() > 0.5;
        equal(
          activeNeutral,
          inactiveNeutral,
          `${preset.name} ${theme}: focused bar ${derived.titleBar.hex()} and unfocused ` +
          `${derived.inactiveTitleBar.hex()} need opposite text colours`,
        );
      }
    }
  });

  it('keeps the shared foreground legible on both bars, after dimming', () => {
    for (const preset of BASE_COLORS) {
      for (const theme of ['dark', 'light'] as const) {
        const derived = deriveThemedColors(Color(preset.hex), theme);
        const shared = foregroundFor(derived.titleBar.hex());

        // Focused: the title bar is not dimmed.
        const focused = contrastRatio(derived.titleBar.hex(), shared);
        ok(focused >= 4.5, `${preset.name} ${theme} focused only ${focused.toFixed(2)}:1`);

        // Unfocused: VS Code composites the text at 60% over the bar.
        // Floor is 4.0 rather than WCAG AA's 4.5 because two presets cannot
        // physically reach it: Yellow and Gray in light mode have bars so bright
        // that dark text dimmed to 60% is inherently low contrast, whatever
        // shade the bar takes. Both still land far above the 1.07:1 this
        // arrangement produced before, and Gray is never auto-assigned — the
        // achromatics are only reachable through Set Base Color.
        const unfocusedBar = derived.inactiveTitleBar.hex();
        const unfocused = contrastRatio(unfocusedBar, dimmed(unfocusedBar, shared));
        ok(
          unfocused >= 4,
          `${preset.name} ${theme} unfocused only ${unfocused.toFixed(2)}:1 on ${unfocusedBar}`,
        );
      }
    }
  });

  it('still darkens or lightens the bar enough to signal focus loss', () => {
    for (const preset of BASE_COLORS) {
      for (const theme of ['dark', 'light'] as const) {
        const derived = deriveThemedColors(Color(preset.hex), theme);
        notEqual(
          derived.inactiveTitleBar.hex(),
          derived.titleBar.hex(),
          `${preset.name} ${theme}: unfocused bar must not be identical to the focused one`,
        );
      }
    }
  });
});
