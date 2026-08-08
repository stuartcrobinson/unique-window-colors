import { deepStrictEqual, equal, notEqual, ok } from 'assert';
import { describe, it } from 'node:test';
import * as Color from 'color';
import {
  BACKGROUND_FOREGROUND_PAIRS,
  contrastRatio,
  TARGET_FOREGROUND_CONTRAST,
  extractBackgrounds,
  foregroundFor,
  improveForegrounds,
  mergePreservedBackgrounds,
  parseBaseColor,
  reconcileColorCustomizations,
} from '../src/color_model';

describe('parseBaseColor', () => {
  it('accepts the color forms the setting documents', () => {
    equal(parseBaseColor('whitesmoke')?.hex(), '#F5F5F5');
    equal(parseBaseColor('#ffffff')?.hex(), '#FFFFFF');
    equal(parseBaseColor('#c0392b')?.hex(), '#C0392B');
  });

  it('returns undefined for values that would otherwise abort coloring', () => {
    for (const invalid of ['not-a-color', '#ggg', '#12345', 'rgb(', 'grey1']) {
      equal(parseBaseColor(invalid), undefined, invalid);
    }
  });
});

describe('foregroundFor', () => {
  // Foregrounds aim for a consistent contrast rather than the strongest one.
  // Always choosing pure white or pure black made contrast a side effect of
  // whatever the background happened to be: across the shipping presets it
  // ranged from 4.9:1 to 16.7:1, so within a single window the activity bar
  // glared at 13.7:1 while the title bar looked washed out at 9.7:1.
  it('picks the correct neutral direction', () => {
    ok(Color(foregroundFor('#053241')).luminosity() > 0.5, 'dark background takes a light foreground');
    ok(Color(foregroundFor('#34C1F0')).luminosity() < 0.5, 'light background takes a dark foreground');
    ok(Color(foregroundFor('#031C25')).luminosity() > 0.5);
    ok(Color(foregroundFor('#996A5B')).luminosity() > 0.5);
    ok(Color(foregroundFor('#BD7000')).luminosity() < 0.5);
  });

  it('softens the foreground when a background could exceed the target contrast', () => {
    // #411F4F is the activity bar of the Purple preset in dark mode. Pure white
    // against it measures 13.7:1, which reads as glare.
    const foreground = foregroundFor('#411F4F');
    notEqual(foreground, '#FFFFFF', 'pure white on a very dark bar is too harsh');
    ok(
      contrastRatio('#411F4F', foreground) < 13,
      `expected softening, got ${contrastRatio('#411F4F', foreground)}:1`,
    );
    ok(contrastRatio('#411F4F', foreground) >= 4.5, 'must still clear WCAG AA');
  });

  it('keeps the full-strength neutral when the target is out of reach', () => {
    // #612F76 is the title bar of that same window; white only reaches 9.7:1,
    // so there is no headroom to give away and it must stay pure white.
    equal(foregroundFor('#612F76'), '#FFFFFF');
  });

  it('clears WCAG AA and never overshoots the target across a deterministic sRGB grid', () => {
    const channelLevels = [0, 51, 102, 153, 204, 255];
    for (const red of channelLevels) {
      for (const green of channelLevels) {
        for (const blue of channelLevels) {
          const background = `#${[red, green, blue]
            .map(channel => channel.toString(16).padStart(2, '0'))
            .join('')}`;
          const foreground = foregroundFor(background);
          const achieved = contrastRatio(background, foreground);
          const best = Math.max(
            contrastRatio(background, '#000000'),
            contrastRatio(background, '#FFFFFF'),
          );
          ok(
            achieved >= 4.5,
            `${foreground} should clear WCAG AA against ${background}, got ${achieved}`,
          );
          // Either the target was met, or the background had no headroom and
          // the strongest available neutral was used.
          ok(
            achieved >= TARGET_FOREGROUND_CONTRAST - 0.5 || achieved >= best - 0.001,
            `${foreground} against ${background} reached ${achieved}, below target with headroom to spare`,
          );
        }
      }
    }
  });
});

describe('improveForegrounds', () => {
  it('changes foregrounds while preserving every existing background byte-for-byte', () => {
    const original = {
      'activityBar.background': '#053241',
      'activityBar.foreground': '#1F1F1F',
      'titleBar.activeBackground': '#34C1F0',
      'titleBar.activeForeground': '#031C25',
      'titleBar.inactiveBackground': '#031C25',
      'titleBar.inactiveForeground': '#031C25',
      'statusBar.background': '#996A5B',
      'statusBar.foreground': '#FBF9F8',
      'statusBar.debuggingBackground': '#BD7000',
      'statusBar.debuggingForeground': '#FFF9F1',
      'statusBar.noFolderBackground': '#DE3F24',
      'statusBar.noFolderForeground': '#FEF9F8',
      'editor.background': '#123456',
    };

    const improved = improveForegrounds(original);

    for (const [backgroundKey] of BACKGROUND_FOREGROUND_PAIRS) {
      if (original[backgroundKey as keyof typeof original] !== undefined) {
        equal(improved[backgroundKey], original[backgroundKey as keyof typeof original]);
      }
    }
    equal(improved['editor.background'], '#123456');
    // Foregrounds on a dark bar are light but softened rather than pure white,
    // and the two activity-bar roles stay in step with each other.
    ok(Color(improved['activityBar.foreground'] as string).luminosity() > 0.5);
    equal(improved['activityBar.inactiveForeground'], improved['activityBar.foreground']);
    ok(Color(improved['titleBar.inactiveForeground'] as string).luminosity() > 0.5);

    for (const [backgroundKey, foregroundKeys] of BACKGROUND_FOREGROUND_PAIRS) {
      const background = improved[backgroundKey];
      if (!background) {
        continue;
      }
      for (const foregroundKey of foregroundKeys) {
        const foreground = improved[foregroundKey];
        ok(foreground, `${foregroundKey} should be set`);
        ok(
          contrastRatio(background, foreground) >= 4.5,
          `${foregroundKey} should clear WCAG AA against ${backgroundKey}`,
        );
      }
    }
  });

  it('leaves an existing foreground alone when its background is not parseable', () => {
    deepStrictEqual(
      improveForegrounds({
        'activityBar.background': 'not-a-color',
        'activityBar.foreground': '#ABCDEF',
      }),
      {
        'activityBar.background': 'not-a-color',
        'activityBar.foreground': '#ABCDEF',
      },
    );
  });

  it('leaves an existing foreground alone for translucent backgrounds', () => {
    deepStrictEqual(
      improveForegrounds({
        'activityBar.background': '#05324180',
        'activityBar.foreground': '#ABCDEF',
      }),
      {
        'activityBar.background': '#05324180',
        'activityBar.foreground': '#ABCDEF',
      },
    );
  });
});

describe('background persistence', () => {
  it('stores arbitrary legacy colors without requiring palette membership', () => {
    const customizations = {
      'activityBar.background': '#123456',
      'titleBar.activeBackground': '#654321',
      'editor.background': '#000001',
    };

    deepStrictEqual(extractBackgrounds(customizations), {
      'activityBar.background': '#123456',
      'titleBar.activeBackground': '#654321',
    });
  });

  it('restores missing backgrounds without replacing current workspace values', () => {
    deepStrictEqual(
      mergePreservedBackgrounds(
        { 'activityBar.background': '#CURRENT' },
        {
          'activityBar.background': '#OLD',
          'titleBar.activeBackground': '#LEGACY',
        },
      ),
      {
        'activityBar.background': '#CURRENT',
        'titleBar.activeBackground': '#LEGACY',
      },
    );
  });

  it('never replaces any current background role while filling missing roles', () => {
    const current = Object.fromEntries(
      BACKGROUND_FOREGROUND_PAIRS.map(([backgroundKey], index) => [backgroundKey, `#OLD00${index}`]),
    );
    const generated = Object.fromEntries(
      BACKGROUND_FOREGROUND_PAIRS.map(([backgroundKey], index) => [backgroundKey, `#NEW00${index}`]),
    );

    deepStrictEqual(mergePreservedBackgrounds(current, generated), current);
  });
});

describe('reconcileColorCustomizations', () => {
  it('preserves every current background while refreshing its foreground', () => {
    const result = reconcileColorCustomizations(
      {
        'activityBar.background': '#053241',
        'activityBar.foreground': '#1F1F1F',
        'titleBar.activeBackground': '#34C1F0',
      },
      { 'titleBar.inactiveBackground': '#031C25' },
      {
        'activityBar.background': '#FFFFFF',
        'titleBar.activeBackground': '#FFFFFF',
        'statusBar.background': '#996A5B',
      },
      { activityBar: true, titleBar: true, statusBar: true, removeAll: false },
    );

    equal(result['activityBar.background'], '#053241');
    equal(result['titleBar.activeBackground'], '#34C1F0');
    equal(result['titleBar.inactiveBackground'], '#031C25');
    equal(result['statusBar.background'], '#996A5B');
    // The stale dark foreground on a dark bar is replaced with a light one.
    ok(Color(result['activityBar.foreground'] as string).luminosity() > 0.5);
    ok(contrastRatio('#053241', result['activityBar.foreground'] as string) >= 4.5);
  });

  it('removes all keys for disabled areas, including orphaned foregrounds', () => {
    deepStrictEqual(
      reconcileColorCustomizations(
        {
          'activityBar.foreground': '#FFFFFF',
          'activityBar.inactiveForeground': '#AAAAAA',
          'editor.background': '#123456',
        },
        undefined,
        {},
        { activityBar: false, titleBar: true, statusBar: true, removeAll: false },
      ),
      { 'editor.background': '#123456' },
    );
  });

  it('removes all managed colors while preserving unrelated customizations', () => {
    deepStrictEqual(
      reconcileColorCustomizations(
        {
          'activityBar.background': '#053241',
          'titleBar.activeForeground': '#FFFFFF',
          'editor.background': '#123456',
        },
        undefined,
        {},
        { activityBar: true, titleBar: true, statusBar: true, removeAll: true },
      ),
      { 'editor.background': '#123456' },
    );
  });
});
