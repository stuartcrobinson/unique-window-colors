import { deepStrictEqual, equal, ok } from 'assert';
import { describe, it } from 'node:test';
import {
  BACKGROUND_FOREGROUND_PAIRS,
  contrastRatio,
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
  it('reproduces optimized foregrounds for the reported Petrol colors', () => {
    equal(foregroundFor('#053241'), '#FFFFFF');
    equal(foregroundFor('#34C1F0'), '#000000');
    equal(foregroundFor('#031C25'), '#FFFFFF');
  });

  it('uses the strongest neutral contrast for warm colors', () => {
    equal(foregroundFor('#996A5B'), '#FFFFFF');
    equal(foregroundFor('#BD7000'), '#000000');
    equal(foregroundFor('#DE3F24'), '#000000');
    equal(foregroundFor('#D95D0A'), '#000000');
  });

  it('chooses the maximum-contrast neutral and clears WCAG AA across a deterministic sRGB grid', () => {
    const channelLevels = [0, 51, 102, 153, 204, 255];
    for (const red of channelLevels) {
      for (const green of channelLevels) {
        for (const blue of channelLevels) {
          const background = `#${[red, green, blue]
            .map(channel => channel.toString(16).padStart(2, '0'))
            .join('')}`;
          const foreground = foregroundFor(background);
          const blackContrast = contrastRatio(background, '#000000');
          const whiteContrast = contrastRatio(background, '#FFFFFF');
          equal(
            contrastRatio(background, foreground),
            Math.max(blackContrast, whiteContrast),
            `${foreground} should maximize neutral contrast against ${background}`,
          );
          ok(
            contrastRatio(background, foreground) >= 4.5,
            `${foreground} should clear WCAG AA against ${background}`,
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
    equal(improved['activityBar.foreground'], '#FFFFFF');
    equal(improved['activityBar.inactiveForeground'], '#FFFFFF');
    equal(improved['titleBar.inactiveForeground'], '#FFFFFF');

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
    equal(result['activityBar.foreground'], '#FFFFFF');
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
