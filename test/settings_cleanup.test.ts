import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { join } from 'node:path';
import {
  LEGACY_SETTING_MIGRATIONS,
  migrateLegacySettingKeys,
  parseWorkspaceBackgrounds,
  removeManagedSettings,
} from '../src/settings_cleanup';

describe('parseWorkspaceBackgrounds', () => {
  it('recovers the backgrounds a workspace already has on disk', () => {
    const raw = JSON.stringify({
      'workbench.colorCustomizations': {
        'activityBar.background': '#410A56',
        'titleBar.activeBackground': '#5A0E78',
        'titleBar.activeForeground': '#FEFBFF',
        'editor.background': '#123456',
      },
    });

    // Foregrounds and unrelated colors are excluded; backgrounds survive exactly.
    deepStrictEqual(parseWorkspaceBackgrounds(raw), {
      'activityBar.background': '#410A56',
      'titleBar.activeBackground': '#5A0E78',
    });
  });

  it('recovers backgrounds from a settings file that uses comments', () => {
    const raw = `{
  // Window Colors wrote these.
  "workbench.colorCustomizations": {
    "activityBar.background": "#410A56",
    "titleBar.activeBackground": "#5A0E78",
  },
}
`;
    deepStrictEqual(parseWorkspaceBackgrounds(raw), {
      'activityBar.background': '#410A56',
      'titleBar.activeBackground': '#5A0E78',
    });
  });

  it('reports nothing rather than throwing for unusable settings files', () => {
    deepStrictEqual(parseWorkspaceBackgrounds('// only a comment, no object'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{ "unterminated": '), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{}'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{"workbench.colorCustomizations": []}'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{"workbench.colorCustomizations": "nope"}'), {});
  });
});

describe('removeManagedSettings', () => {
  it('removes extension colors without deleting unrelated workspace settings', () => {
    const original = `{
  "workbench.colorCustomizations": {
    "activityBar.background": "#053241",
    "activityBar.foreground": "#F3FBFE",
    "editor.background": "#123456"
  },
  "editor.fontSize": 14
}
`;
    const removal = removeManagedSettings(original);
    equal(removal?.changed, true);
    equal(removal?.disposable, false);
    equal(removal?.text, `{
  "workbench.colorCustomizations": {
    "editor.background": "#123456"
  },
  "editor.fontSize": 14
}
`);
  });

  it('removes an empty colorCustomizations block but preserves other settings', () => {
    const original = `{
  "workbench.colorCustomizations": {
    "titleBar.activeBackground": "#34C1F0",
    "titleBar.activeForeground": "#031C25"
  },
  "windowColors.baseColor": "#0c7ba0"
}
`;
    const removal = removeManagedSettings(original);
    equal(removal?.text, `{
  "windowColors.baseColor": "#0c7ba0"
}
`);
    equal(removal?.disposable, false);
  });

  it('keeps the comments in a JSONC settings file', () => {
    const original = `{
  // Shared team settings — do not reformat.
  "editor.tabSize": 2,
  "workbench.colorCustomizations": {
    "activityBar.background": "#053241"
  }
}
`;
    const removal = removeManagedSettings(original);
    equal(removal?.changed, true);
    equal(removal?.text, `{
  // Shared team settings — do not reformat.
  "editor.tabSize": 2
}
`);
  });

  it('reports a file holding nothing but managed colors as disposable', () => {
    const removal = removeManagedSettings(`{
  "workbench.colorCustomizations": {
    "activityBar.background": "#053241"
  }
}
`);
    equal(removal?.changed, true);
    equal(removal?.disposable, true);
  });

  it('does not report a file as disposable while a comment remains', () => {
    const removal = removeManagedSettings(`{
  // keep this note
  "workbench.colorCustomizations": {
    "activityBar.background": "#053241"
  }
}
`);
    equal(removal?.changed, true);
    equal(removal?.disposable, false);
  });

  it('optionally removes this extension\'s own settings too', () => {
    const original = `{
  "windowColors.baseColor": "#0c7ba0",
  "windowColors.theme": "dark",
  "editor.fontSize": 14
}
`;
    equal(removeManagedSettings(original)?.changed, false);
    equal(
      removeManagedSettings(original, { includeWindowColorsSettings: true })?.text,
      '{\n  "editor.fontSize": 14\n}\n',
    );
  });

  it('does not alter malformed or non-object color customizations', () => {
    const original = '{ "workbench.colorCustomizations": "unexpected" }';
    const removal = removeManagedSettings(original);
    equal(removal?.changed, false);
    equal(removal?.text, original);
  });

  it('refuses to touch a file it cannot parse', () => {
    equal(removeManagedSettings('{ "workbench.colorCustomizations": '), undefined);
    equal(removeManagedSettings('not json at all'), undefined);
  });

  it('reports no change when there is nothing managed to remove', () => {
    const original = '{\n  "editor.fontSize": 14\n}\n';
    const removal = removeManagedSettings(original);
    equal(removal?.changed, false);
    equal(removal?.text, original);
  });
});

describe('migrateLegacySettingKeys', () => {
  // Versions <= 1.2.4 wrote emoji-prefixed keys. VS Code no longer recognises
  // them, so they cannot be rewritten through the configuration API and have to
  // be renamed in the file directly.
  it('renames a legacy key while keeping its value, comments and formatting', () => {
    const original = `{
  // chosen by the team
  "windowColors.🌈 Theme": "dark",
  "editor.fontSize": 14
}
`;
    equal(migrateLegacySettingKeys(original), `{
  // chosen by the team
  "windowColors.theme": "dark",
  "editor.fontSize": 14
}
`);
  });

  it('migrates every legacy key in one pass', () => {
    const original = `{
  "windowColors.🌈 Theme": "light",
  "windowColors.🌈 BaseColor": "#0c7ba0",
  "windowColors.🌈 ColorTitleBar": false
}
`;
    const migrated = migrateLegacySettingKeys(original);
    deepStrictEqual(JSON.parse(migrated ?? ''), {
      'windowColors.theme': 'light',
      'windowColors.baseColor': '#0c7ba0',
      'windowColors.colorTitleBar': false,
    });
  });

  // The modern key is the user's current intent; a stale legacy value must not
  // clobber it. The legacy key is still dropped so it cannot migrate again.
  it('discards the legacy key when the modern key already has a value', () => {
    const original = `{
  "windowColors.🌈 Theme": "dark",
  "windowColors.theme": "light"
}
`;
    deepStrictEqual(JSON.parse(migrateLegacySettingKeys(original) ?? ''), {
      'windowColors.theme': 'light',
    });
  });

  it('leaves a file with no legacy keys byte for byte unchanged', () => {
    const original = '{\n  // note\n  "windowColors.theme": "dark",\n}\n';
    equal(migrateLegacySettingKeys(original), original);
  });

  it('refuses to touch a file it cannot parse', () => {
    equal(migrateLegacySettingKeys('{ "windowColors.🌈 Theme": '), undefined);
    equal(migrateLegacySettingKeys('not json'), undefined);
  });

  it('produces only keys the extension actually declares', () => {
    // Guards against a typo in the migration table silently creating a setting
    // that package.json never contributes, which VS Code would ignore forever.
    // Read from the working directory, not relative to this file: compiled
    // tests run from .test-out/, where a relative hop would miss the manifest.
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { contributes: { configuration: { properties: Record<string, unknown> } } };
    const contributed = Object.keys(manifest.contributes.configuration.properties);
    for (const [, modern] of LEGACY_SETTING_MIGRATIONS) {
      ok(
        contributed.includes(`windowColors.${modern}`),
        `migration target windowColors.${modern} is not contributed by package.json`,
      );
    }
  });
});
