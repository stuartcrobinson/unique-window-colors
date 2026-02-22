import * as Color from 'color';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const randomSeed = require('random-seed');
import { ExtensionContext, workspace, WorkspaceFolder, commands, window } from 'vscode';

const MANAGED_COLOR_KEYS = [
  'activityBar.background',
  'titleBar.activeBackground',
  'titleBar.activeForeground',
  'titleBar.inactiveBackground',
  'titleBar.inactiveForeground',
  'statusBar.background',
  'statusBar.foreground',
  'statusBar.debuggingBackground',
  'statusBar.debuggingForeground',
  'statusBar.noFolderBackground',
  'statusBar.noFolderForeground',
];

const BASE_COLORS = [
  { emoji: '🟥', name: 'Red',    hex: '#c0392b' },
  { emoji: '🟧', name: 'Orange', hex: '#e67e22' },
  { emoji: '🟨', name: 'Yellow', hex: '#f1c40f' },
  { emoji: '🟩', name: 'Green',  hex: '#27ae60' },
  { emoji: '🔵', name: 'Blue',   hex: '#2980b9' },
  { emoji: '🟪', name: 'Purple', hex: '#8e44ad' },
  { emoji: '🟫', name: 'Brown',  hex: '#6d4c41' },
  { emoji: '⚫', name: 'Black',  hex: '#1a1a1a' },
];

export class SettingsFileDeleter {
  constructor(
    private workspaceRoot: string,
    private computedColors: Record<string, string>) { }

  /**
   * Deletes .vscode/settings.json if colors all match the computed defaults and no other settings exist.
   * Deletes .vscode if no other files exist.
   */
  public dispose() {

    const settingsfile = this.workspaceRoot + '/.vscode/settings.json';
    const vscodeSettingsDir = this.workspaceRoot + '/.vscode';

    if (!fs.existsSync(settingsfile)) {
      return;
    }

    const settingsFileJson = JSON.parse((fs.readFileSync(settingsfile, "utf8")));
    const cc = JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations') || {}));

    const deleteSettingsFileUponExit = JSON.parse(JSON.stringify(workspace.getConfiguration('windowColors').get<string>('🌈 DeleteSettingsFileUponExit')));

    if (deleteSettingsFileUponExit) {
      fs.unlinkSync(settingsfile);
      fs.rmdirSync(vscodeSettingsDir);  //only deletes empty folders
    }
    else if (Object.keys(settingsFileJson).length === 1) {

      // All keys in cc must be managed keys (user hasn't added their own)
      const ccKeys = Object.keys(cc);
      const managedKeySet = new Set(MANAGED_COLOR_KEYS);
      const onlyManagedKeys = ccKeys.every(k => managedKeySet.has(k));

      if (onlyManagedKeys) {
        // Check none of the managed colors were modified from computed defaults
        const aColorWasModified = Object.keys(this.computedColors).some(
          (key: string) => cc[key] && cc[key] !== this.computedColors[key]
        );

        if (!aColorWasModified) {
          fs.unlinkSync(settingsfile);
          fs.rmdirSync(vscodeSettingsDir);  //only deletes empty folders
        }
      }
    }
  }
}

export function activate(context: ExtensionContext) {

  if (!workspace.workspaceFolders) {
    return;
  }

  let workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders);

  const extensionTheme = workspace.getConfiguration('windowColors').get<string>('🌈 Theme');
  let baseColor = workspace.getConfiguration('windowColors').get<string>('🌈 BaseColor');
  if (baseColor) {
    baseColor = baseColor.toLowerCase().trim();
  }
  const colorTitleBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorTitleBar') ?? true;
  const colorActivityBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorActivityBar') ?? true;
  const colorStatusBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBar') || false;

  /** retain initial unrelated colorCustomizations*/
  const cc = JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations') || {}));

  // Include URI authority in the seed so that the same folder path opened on
  // different remote-SSH hosts produces a distinct color (issue #52).
  // For local windows the authority is empty and behaviour is unchanged.
  const firstFolder = workspace.workspaceFolders[0];
  const uriAuthority = firstFolder?.uri.authority || '';
  const colorSeed = uriAuthority ? `${uriAuthority}:${workspaceRoot}` : workspaceRoot;
  let sideBarColor: Color = Color('#' + stringToARGB(colorSeed));
  let titleBarTextColor: Color = Color('#ffffff');
  let titleBarColor: Color = Color('#ffffff');

  const sideBarColor_dark = getColorWithLuminosity(sideBarColor, .02, .027);
  const titleBarTextColor_dark = getColorWithLuminosity(sideBarColor_dark, 0.95, 1);
  const titleBarColor_dark = sideBarColor_dark.lighten(0.4);

  const sideBarColor_light = getColorWithLuminosity(sideBarColor, 0.45, 0.55);
  const titleBarTextColor_light = getColorWithLuminosity(sideBarColor_light, 0, 0.01);
  const titleBarColor_light = sideBarColor_light.lighten(0.1);

  if (extensionTheme === 'dark') {

    sideBarColor = sideBarColor_dark;
    titleBarTextColor = titleBarTextColor_dark;
    titleBarColor = titleBarColor_dark;
  }
  else if (extensionTheme === 'light') {

    sideBarColor = sideBarColor_light;
    titleBarTextColor = titleBarTextColor_light;
    titleBarColor = titleBarColor_light;
  }
  if (baseColor) {

    const rawColor = Color(baseColor);
    if (extensionTheme === 'dark') {
      sideBarColor = getColorWithLuminosity(rawColor, .02, .027);
      titleBarColor = sideBarColor.lighten(0.4);
      titleBarTextColor = getColorWithLuminosity(sideBarColor, 0.95, 1);
    } else if (extensionTheme === 'light') {
      sideBarColor = getColorWithLuminosity(rawColor, 0.45, 0.55);
      titleBarColor = sideBarColor.lighten(0.1);
      titleBarTextColor = getColorWithLuminosity(sideBarColor, 0, 0.01);
    } else {
      sideBarColor = rawColor;
      titleBarColor = sideBarColor.lighten(0.3);
      if (titleBarColor.luminosity() > 0.5) {
        titleBarTextColor = getColorWithLuminosity(sideBarColor, 0, 0.01);
      } else {
        titleBarTextColor = getColorWithLuminosity(sideBarColor, 0.95, 1);
      }
    }
  }

  // Inactive title bar matches the activity bar (sidebar) exactly
  const titleBarInactiveBackground = sideBarColor;
  const titleBarInactiveForeground = titleBarTextColor;

  const doRemoveColors = extensionTheme === 'remove';

  // For each area, determine whether to apply or remove colors.
  // We avoid overwriting existing (possibly user-customised) colors unless baseColor is set.
  const applyActivityBar = !doRemoveColors && colorActivityBar && (!cc['activityBar.background'] || !!baseColor);
  const removeActivityBar = !doRemoveColors && !colorActivityBar && !!cc['activityBar.background'];

  const applyTitleBar = !doRemoveColors && colorTitleBar && (!cc['titleBar.activeBackground'] || !!baseColor);
  const removeTitleBar = !doRemoveColors && !colorTitleBar && !!cc['titleBar.activeBackground'];

  const applyInactiveTitleBar = !doRemoveColors && colorTitleBar && (applyTitleBar || !cc['titleBar.inactiveBackground']);
  const removeInactiveTitleBar = !doRemoveColors && !colorTitleBar && !!cc['titleBar.inactiveBackground'];

  const applyStatusBar = !doRemoveColors && colorStatusBar && (!cc['statusBar.background'] || !!baseColor);
  const removeStatusBar = !doRemoveColors && !colorStatusBar && !!cc['statusBar.background'];

  const anyChange = doRemoveColors || applyActivityBar || removeActivityBar ||
    applyTitleBar || removeTitleBar || applyInactiveTitleBar || removeInactiveTitleBar ||
    applyStatusBar || removeStatusBar;

  if (anyChange) {

    const newCc = { ...cc };

    if (doRemoveColors) {
      for (const key of MANAGED_COLOR_KEYS) {
        newCc[key] = undefined;
      }
    } else {
      if (applyActivityBar) {
        newCc['activityBar.background'] = sideBarColor.hex();
      } else if (removeActivityBar) {
        newCc['activityBar.background'] = undefined;
      }

      if (applyTitleBar) {
        newCc['titleBar.activeBackground'] = titleBarColor.hex();
        newCc['titleBar.activeForeground'] = titleBarTextColor.hex();
      } else if (removeTitleBar) {
        newCc['titleBar.activeBackground'] = undefined;
        newCc['titleBar.activeForeground'] = undefined;
      }

      if (applyInactiveTitleBar) {
        newCc['titleBar.inactiveBackground'] = titleBarInactiveBackground.hex();
        newCc['titleBar.inactiveForeground'] = titleBarInactiveForeground.hex();
      } else if (removeInactiveTitleBar) {
        newCc['titleBar.inactiveBackground'] = undefined;
        newCc['titleBar.inactiveForeground'] = undefined;
      }

      if (applyStatusBar) {
        newCc['statusBar.background'] = sideBarColor.hex();
        newCc['statusBar.foreground'] = titleBarTextColor.hex();
        newCc['statusBar.debuggingBackground'] = sideBarColor.hex();
        newCc['statusBar.debuggingForeground'] = titleBarTextColor.hex();
        newCc['statusBar.noFolderBackground'] = sideBarColor.hex();
        newCc['statusBar.noFolderForeground'] = titleBarTextColor.hex();
      } else if (removeStatusBar) {
        newCc['statusBar.background'] = undefined;
        newCc['statusBar.foreground'] = undefined;
        newCc['statusBar.debuggingBackground'] = undefined;
        newCc['statusBar.debuggingForeground'] = undefined;
        newCc['statusBar.noFolderBackground'] = undefined;
        newCc['statusBar.noFolderForeground'] = undefined;
      }
    }

    workspace.getConfiguration('workbench').update('colorCustomizations', newCc, false);
  }

  // Build computedColors map for SettingsFileDeleter
  const computedColors: Record<string, string> = {};
  if (colorActivityBar) {
    computedColors['activityBar.background'] = sideBarColor.hex();
  }
  if (colorTitleBar) {
    computedColors['titleBar.activeBackground'] = titleBarColor.hex();
    computedColors['titleBar.activeForeground'] = titleBarTextColor.hex();
    computedColors['titleBar.inactiveBackground'] = titleBarInactiveBackground.hex();
    computedColors['titleBar.inactiveForeground'] = titleBarInactiveForeground.hex();
  }
  if (colorStatusBar) {
    computedColors['statusBar.background'] = sideBarColor.hex();
    computedColors['statusBar.foreground'] = titleBarTextColor.hex();
    computedColors['statusBar.debuggingBackground'] = sideBarColor.hex();
    computedColors['statusBar.debuggingForeground'] = titleBarTextColor.hex();
    computedColors['statusBar.noFolderBackground'] = sideBarColor.hex();
    computedColors['statusBar.noFolderForeground'] = titleBarTextColor.hex();
  }

  const settingsFileDeleter = new SettingsFileDeleter(workspaceRoot, computedColors);
  context.subscriptions.push(settingsFileDeleter);

  const openSettingsDisposable = commands.registerCommand('windowColors.openSettings', async () => {

    const cfg = workspace.getConfiguration('windowColors');
    const curTitleBar = cfg.get<boolean>('🌈 ColorTitleBar') ?? true;
    const curActivityBar = cfg.get<boolean>('🌈 ColorActivityBar') ?? true;
    const curStatusBar = cfg.get<boolean>('🌈 ColorStatusBar') || false;
    const curBaseColor = cfg.get<string>('🌈 BaseColor') || null;
    const curTheme = cfg.get<string>('🌈 Theme') || 'dark';

    interface SettingsItem {
      label: string;
      description: string;
      detail: string;
      action: string;
    }

    const settingsItems: SettingsItem[] = [
      {
        label: `$(${curTitleBar ? 'check' : 'circle-slash'})  Color Title Bar`,
        description: curTitleBar ? 'ON' : 'off',
        detail: 'Apply window color to the top title bar',
        action: 'toggleTitleBar',
      },
      {
        label: `$(${curActivityBar ? 'check' : 'circle-slash'})  Color Activity Bar`,
        description: curActivityBar ? 'ON' : 'off',
        detail: 'Apply window color to the left activity bar',
        action: 'toggleActivityBar',
      },
      {
        label: `$(${curStatusBar ? 'check' : 'circle-slash'})  Color Status Bar`,
        description: curStatusBar ? 'ON' : 'off',
        detail: 'Apply window color to the bottom status bar (all states)',
        action: 'toggleStatusBar',
      },
      {
        label: `$(paintcan)  Set Base Color...`,
        description: curBaseColor || 'auto (from folder name)',
        detail: 'Override the auto-generated window color with a specific color',
        action: 'pickColor',
      },
      {
        label: `$(symbol-color)  Theme`,
        description: curTheme,
        detail: 'Switch between dark, light, or remove colors',
        action: 'pickTheme',
      },
      {
        label: `$(trash)  Remove Colors from This Window`,
        description: '',
        detail: 'Wipe all window color settings and delete .vscode/settings.json if it becomes empty',
        action: 'removeColors',
      },
    ];

    const picked = await window.showQuickPick(settingsItems, {
      placeHolder: 'Window Colors — select a setting to change',
      matchOnDescription: true,
    });

    if (!picked) { return; }

    if (picked.action === 'toggleTitleBar') {
      await cfg.update('🌈 ColorTitleBar', !curTitleBar, false);
      const action = await window.showInformationMessage(
        `Title Bar Color: ${!curTitleBar ? 'ON' : 'OFF'}. Reload to apply.`, 'Reload Window'
      );
      if (action === 'Reload Window') { commands.executeCommand('workbench.action.reloadWindow'); }

    } else if (picked.action === 'toggleActivityBar') {
      await cfg.update('🌈 ColorActivityBar', !curActivityBar, false);
      const action = await window.showInformationMessage(
        `Activity Bar Color: ${!curActivityBar ? 'ON' : 'OFF'}. Reload to apply.`, 'Reload Window'
      );
      if (action === 'Reload Window') { commands.executeCommand('workbench.action.reloadWindow'); }

    } else if (picked.action === 'toggleStatusBar') {
      await cfg.update('🌈 ColorStatusBar', !curStatusBar, false);
      const action = await window.showInformationMessage(
        `Status Bar Color: ${!curStatusBar ? 'ON' : 'OFF'}. Reload to apply.`, 'Reload Window'
      );
      if (action === 'Reload Window') { commands.executeCommand('workbench.action.reloadWindow'); }

    } else if (picked.action === 'pickColor') {
      commands.executeCommand('windowColors.pickBaseColor');

    } else if (picked.action === 'pickTheme') {
      const themeItems = [
        { label: '🌙  dark',   description: curTheme === 'dark'   ? '← current' : '', value: 'dark' },
        { label: '☀️  light',  description: curTheme === 'light'  ? '← current' : '', value: 'light' },
        { label: '🚫  remove', description: curTheme === 'remove' ? '← current' : '', value: 'remove' },
      ];
      const themePicked = await window.showQuickPick(themeItems, { placeHolder: 'Select theme' });
      if (!themePicked) { return; }
      await cfg.update('🌈 Theme', themePicked.value, false);
      const action = await window.showInformationMessage(
        `Theme set to "${themePicked.value}". Reload to apply.`, 'Reload Window'
      );
      if (action === 'Reload Window') { commands.executeCommand('workbench.action.reloadWindow'); }

    } else if (picked.action === 'removeColors') {
      commands.executeCommand('windowColors.removeColors');
    }
  });

  context.subscriptions.push(openSettingsDisposable);

  const pickColorDisposable = commands.registerCommand('windowColors.pickBaseColor', async () => {

    const colorMap = new Map<string, string | null>();
    const items: { label: string; description: string }[] = [];

    // Singles (hue order)
    for (const c of BASE_COLORS) {
      const label = `${c.emoji}  ${c.name}`;
      items.push({ label, description: c.hex });
      colorMap.set(label, c.hex);
    }

    // All two-color combos C(8,2) = 28
    for (let i = 0; i < BASE_COLORS.length; i++) {
      for (let j = i + 1; j < BASE_COLORS.length; j++) {
        const a = BASE_COLORS[i];
        const b = BASE_COLORS[j];
        const blendHex = Color(a.hex).mix(Color(b.hex), 0.5).hex().toLowerCase();
        const label = `${a.emoji}${b.emoji}  ${a.name} + ${b.name}`;
        items.push({ label, description: blendHex });
        colorMap.set(label, blendHex);
      }
    }

    const autoLabel = '✨  Auto (from folder name)';
    const customLabel = '✏️  Custom...';
    items.push({ label: autoLabel, description: 'Remove base color override' });
    items.push({ label: customLabel, description: 'Enter any hex or CSS color name' });
    colorMap.set(autoLabel, null);
    colorMap.set(customLabel, 'custom');

    const currentTheme = workspace.getConfiguration('windowColors').get<string>('🌈 Theme');
    const currentColorTitleBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorTitleBar') ?? true;
    const currentColorActivityBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorActivityBar') ?? true;
    const currentColorStatusBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBar') || false;
    const originalCc = JSON.parse(JSON.stringify(
      workspace.getConfiguration('workbench').get('colorCustomizations') || {}
    ));

    const applyHex = async (hex: string) => {
      let sideBarColor = Color(hex);
      let titleBarColor: Color;
      let titleBarTextColor: Color;

      if (currentTheme === 'dark') {
        sideBarColor = getColorWithLuminosity(sideBarColor, .02, .027);
        titleBarColor = sideBarColor.lighten(0.4);
        titleBarTextColor = getColorWithLuminosity(sideBarColor, 0.95, 1);
      } else if (currentTheme === 'light') {
        sideBarColor = getColorWithLuminosity(sideBarColor, 0.45, 0.55);
        titleBarColor = sideBarColor.lighten(0.1);
        titleBarTextColor = getColorWithLuminosity(sideBarColor, 0, 0.01);
      } else {
        titleBarColor = sideBarColor.lighten(0.3);
        if (titleBarColor.luminosity() > 0.5) {
          titleBarTextColor = getColorWithLuminosity(sideBarColor, 0, 0.01);
        } else {
          titleBarTextColor = getColorWithLuminosity(sideBarColor, 0.95, 1);
        }
      }

      const newCc = { ...originalCc };
      if (currentColorActivityBar) {
        newCc['activityBar.background'] = sideBarColor.hex();
      }
      if (currentColorTitleBar) {
        newCc['titleBar.activeBackground'] = titleBarColor.hex();
        newCc['titleBar.activeForeground'] = titleBarTextColor.hex();
        newCc['titleBar.inactiveBackground'] = sideBarColor.hex();
        newCc['titleBar.inactiveForeground'] = titleBarTextColor.hex();
      }
      if (currentColorStatusBar) {
        newCc['statusBar.background'] = sideBarColor.hex();
        newCc['statusBar.foreground'] = titleBarTextColor.hex();
        newCc['statusBar.debuggingBackground'] = sideBarColor.hex();
        newCc['statusBar.debuggingForeground'] = titleBarTextColor.hex();
        newCc['statusBar.noFolderBackground'] = sideBarColor.hex();
        newCc['statusBar.noFolderForeground'] = titleBarTextColor.hex();
      }
      await workspace.getConfiguration('workbench').update('colorCustomizations', newCc, false);
    };

    const qp = window.createQuickPick();
    qp.items = items;
    qp.placeholder = 'Select a base color for this window';
    let accepted = false;

    qp.onDidChangeActive(async (activeItems) => {
      if (!activeItems.length) { return; }
      const hex = colorMap.get(activeItems[0].label);
      if (typeof hex === 'string' && hex !== 'custom') {
        await applyHex(hex);
      } else {
        await workspace.getConfiguration('workbench').update('colorCustomizations', originalCc, false);
      }
    });

    qp.onDidAccept(async () => {
      accepted = true;
      const picked = qp.activeItems[0];
      qp.hide();
      if (!picked) { return; }

      let hexValue: string | null | undefined = colorMap.get(picked.label);

      if (hexValue === 'custom') {
        await workspace.getConfiguration('workbench').update('colorCustomizations', originalCc, false);
        const input = await window.showInputBox({
          prompt: 'Enter a hex color (eg #ff0000) or CSS color name (eg cornflowerblue)',
          placeHolder: '#c0392b',
        });
        if (!input) { return; }
        hexValue = input.trim();
        try {
          await applyHex(hexValue);
        } catch {
          return;
        }
      }

      await workspace.getConfiguration('windowColors').update('🌈 BaseColor', hexValue === null ? undefined : hexValue, false);
    });

    qp.onDidHide(() => {
      if (!accepted) {
        workspace.getConfiguration('workbench').update('colorCustomizations', originalCc, false);
      }
      qp.dispose();
    });

    qp.show();
  });

  context.subscriptions.push(pickColorDisposable);

  const removeColorsDisposable = commands.registerCommand('windowColors.removeColors', async () => {
    const settingsFile = workspaceRoot + '/.vscode/settings.json';
    const vscodeDir = workspaceRoot + '/.vscode';

    if (!fs.existsSync(settingsFile)) {
      window.showInformationMessage('No workspace settings file found — nothing to remove.');
      return;
    }

    let fileContent: Record<string, unknown>;
    try {
      fileContent = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {
      window.showErrorMessage('Could not parse .vscode/settings.json.');
      return;
    }

    // Remove all managed color keys from workbench.colorCustomizations
    const cc = (fileContent['workbench.colorCustomizations'] as Record<string, unknown>) || {};
    for (const key of MANAGED_COLOR_KEYS) {
      delete cc[key];
    }

    if (Object.keys(cc).length === 0) {
      delete fileContent['workbench.colorCustomizations'];
    } else {
      fileContent['workbench.colorCustomizations'] = cc;
    }

    if (Object.keys(fileContent).length === 0) {
      fs.unlinkSync(settingsFile);
      try { fs.rmdirSync(vscodeDir); } catch { /* dir not empty, leave it */ }
      window.showInformationMessage('Window colors removed. Settings file deleted.');
    } else {
      fs.writeFileSync(settingsFile, JSON.stringify(fileContent, null, 2) + '\n');
      window.showInformationMessage('Window colors removed from workspace settings.');
    }
  });

  context.subscriptions.push(removeColorsDisposable);
}

const getColorWithLuminosity = (color: Color, min: number, max: number): Color => {

  let c: Color = Color(color.hex());

  while (c.luminosity() > max) {
    c = c.darken(0.01);
  }
  while (c.luminosity() < min) {
    c = c.lighten(0.01);
  }
  return c;
};

//https://itnext.io/how-to-make-a-visual-studio-code-extension-77085dce7d82
// takes an array of workspace folder objects and return
// workspace root, assumed to be the first item in the array
export const getWorkspaceFolder = (folders: readonly WorkspaceFolder[] |
  undefined): string => {
  if (!folders) {
    return '';
  }

  const folder = folders[0] || {};
  const uri = folder.uri;

  return uri.fsPath;
};

// Use a seeded PRNG so that similar strings (e.g. my-repo-1 vs my-repo-2)
// produce very different colors rather than adjacent hash values.
function stringToARGB(str: string): string {
  const rand = randomSeed.create(str);
  return [rand(256), rand(256), rand(256)]
    .map((n: number) => n.toString(16).padStart(2, '0'))
    .join('');
}


// https://stackoverflow.com/questions/45218663/use-workbench-colorcustomizations-in-extension
