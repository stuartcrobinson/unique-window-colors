import { deepStrictEqual } from 'assert';
import { describe, it } from 'node:test';
import { parseWorkspaceBackgrounds, removeManagedColorCustomizations } from '../src/settings_cleanup';

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

  it('reports nothing rather than throwing for unusable settings files', () => {
    deepStrictEqual(parseWorkspaceBackgrounds('{ "trailing": "comma", }'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('// comments are legal in settings.json'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{}'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{"workbench.colorCustomizations": []}'), {});
    deepStrictEqual(parseWorkspaceBackgrounds('{"workbench.colorCustomizations": "nope"}'), {});
  });
});

describe('removeManagedColorCustomizations', () => {
  it('removes extension colors without deleting unrelated workspace settings', () => {
    const original = {
      'workbench.colorCustomizations': {
        'activityBar.background': '#053241',
        'activityBar.foreground': '#F3FBFE',
        'editor.background': '#123456',
      },
      'editor.fontSize': 14,
    };

    deepStrictEqual(removeManagedColorCustomizations(original), {
      'workbench.colorCustomizations': {
        'editor.background': '#123456',
      },
      'editor.fontSize': 14,
    });
    deepStrictEqual(original, {
      'workbench.colorCustomizations': {
        'activityBar.background': '#053241',
        'activityBar.foreground': '#F3FBFE',
        'editor.background': '#123456',
      },
      'editor.fontSize': 14,
    });
  });

  it('removes an empty colorCustomizations object but preserves other settings', () => {
    deepStrictEqual(
      removeManagedColorCustomizations({
        'workbench.colorCustomizations': {
          'titleBar.activeBackground': '#34C1F0',
          'titleBar.activeForeground': '#031C25',
        },
        'windowColors.baseColor': '#0c7ba0',
      }),
      { 'windowColors.baseColor': '#0c7ba0' },
    );
  });

  it('does not alter malformed or non-object color customizations', () => {
    deepStrictEqual(
      removeManagedColorCustomizations({ 'workbench.colorCustomizations': 'unexpected' }),
      { 'workbench.colorCustomizations': 'unexpected' },
    );
  });
});
