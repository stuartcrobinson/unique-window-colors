import * as Color from 'color';
import * as fs from 'fs';
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
  const colorStatusBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBar') || false;
  const colorStatusBarAllStates = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBarAllStates') || false;

  /** retain initial unrelated colorCustomizations*/
  const cc = JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations') || {}));

  let sideBarColor: Color = Color('#' + stringToARGB(workspaceRoot));
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

  let doUpdateColors = true;

  if (cc && (cc['activityBar.background'] || cc['titleBar.activeBackground'] || cc['titleBar.activeForeground'])) {
    //don't overwrite
    doUpdateColors = false;
  }

  if (baseColor) {
    doUpdateColors = true;
  }

  // Always add inactive colors if they're missing (handles upgrades from older versions)
  const doAddInactiveColors = doUpdateColors || !cc['titleBar.inactiveBackground'];

  // Handle status bar (normal state): add if enabled and missing, remove if disabled but present
  const doAddStatusBar = colorStatusBar && (doUpdateColors || !cc['statusBar.background']);
  const doRemoveStatusBar = !colorStatusBar && cc['statusBar.background'];

  // Handle status bar (all states: debugging, no-folder): same pattern
  const doAddStatusBarAllStates = colorStatusBarAllStates && (doUpdateColors || !cc['statusBar.debuggingBackground']);
  const doRemoveStatusBarAllStates = !colorStatusBarAllStates && cc['statusBar.debuggingBackground'];

  if (doUpdateColors || doRemoveColors || doAddInactiveColors || doAddStatusBar || doRemoveStatusBar || doAddStatusBarAllStates || doRemoveStatusBarAllStates) {

    const newCc = { ...cc };

    if (doRemoveColors) {
      newCc['activityBar.background'] = undefined;
      newCc['titleBar.activeBackground'] = undefined;
      newCc['titleBar.activeForeground'] = undefined;
      newCc['titleBar.inactiveBackground'] = undefined;
      newCc['titleBar.inactiveForeground'] = undefined;
      newCc['statusBar.background'] = undefined;
      newCc['statusBar.foreground'] = undefined;
      newCc['statusBar.debuggingBackground'] = undefined;
      newCc['statusBar.debuggingForeground'] = undefined;
      newCc['statusBar.noFolderBackground'] = undefined;
      newCc['statusBar.noFolderForeground'] = undefined;
    } else {
      if (doUpdateColors) {
        newCc['activityBar.background'] = sideBarColor.hex();
        newCc['titleBar.activeBackground'] = titleBarColor.hex();
        newCc['titleBar.activeForeground'] = titleBarTextColor.hex();
      }
      if (doAddInactiveColors) {
        newCc['titleBar.inactiveBackground'] = titleBarInactiveBackground.hex();
        newCc['titleBar.inactiveForeground'] = titleBarInactiveForeground.hex();
      }
      if (doAddStatusBar) {
        newCc['statusBar.background'] = sideBarColor.hex();
        newCc['statusBar.foreground'] = titleBarTextColor.hex();
      } else if (doRemoveStatusBar) {
        newCc['statusBar.background'] = undefined;
        newCc['statusBar.foreground'] = undefined;
      }
      if (doAddStatusBarAllStates) {
        newCc['statusBar.debuggingBackground'] = sideBarColor.hex();
        newCc['statusBar.debuggingForeground'] = titleBarTextColor.hex();
        newCc['statusBar.noFolderBackground'] = sideBarColor.hex();
        newCc['statusBar.noFolderForeground'] = titleBarTextColor.hex();
      } else if (doRemoveStatusBarAllStates) {
        newCc['statusBar.debuggingBackground'] = undefined;
        newCc['statusBar.debuggingForeground'] = undefined;
        newCc['statusBar.noFolderBackground'] = undefined;
        newCc['statusBar.noFolderForeground'] = undefined;
      }
    }

    workspace.getConfiguration('workbench').update('colorCustomizations', newCc, false);
  }

  // Build computedColors map for SettingsFileDeleter
  const computedColors: Record<string, string> = {
    'activityBar.background': sideBarColor.hex(),
    'titleBar.activeBackground': titleBarColor.hex(),
    'titleBar.activeForeground': titleBarTextColor.hex(),
    'titleBar.inactiveBackground': titleBarInactiveBackground.hex(),
    'titleBar.inactiveForeground': titleBarInactiveForeground.hex(),
  };
  if (colorStatusBar) {
    computedColors['statusBar.background'] = sideBarColor.hex();
    computedColors['statusBar.foreground'] = titleBarTextColor.hex();
  }
  if (colorStatusBarAllStates) {
    computedColors['statusBar.debuggingBackground'] = sideBarColor.hex();
    computedColors['statusBar.debuggingForeground'] = titleBarTextColor.hex();
    computedColors['statusBar.noFolderBackground'] = sideBarColor.hex();
    computedColors['statusBar.noFolderForeground'] = titleBarTextColor.hex();
  }

  const settingsFileDeleter = new SettingsFileDeleter(workspaceRoot, computedColors);
  context.subscriptions.push(settingsFileDeleter);

  const openSettingsDisposable = commands.registerCommand('windowColors.openSettings', async () => {

    const cfg = workspace.getConfiguration('windowColors');
    const curStatusBar = cfg.get<boolean>('🌈 ColorStatusBar') || false;
    const curStatusBarAllStates = cfg.get<boolean>('🌈 ColorStatusBarAllStates') || false;
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
        label: `$(${curStatusBar ? 'check' : 'circle-slash'})  Color Status Bar`,
        description: curStatusBar ? 'ON' : 'off',
        detail: 'Apply window color to the bottom status bar (normal/idle state)',
        action: 'toggleStatusBar',
      },
      {
        label: `$(${curStatusBarAllStates ? 'check' : 'circle-slash'})  Color Status Bar — All States`,
        description: curStatusBarAllStates ? 'ON' : 'off',
        detail: 'Also color the status bar during debug sessions and when no folder is open',
        action: 'toggleStatusBarAllStates',
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
    ];

    const picked = await window.showQuickPick(settingsItems, {
      placeHolder: 'Window Colors — select a setting to change',
      matchOnDescription: true,
    });

    if (!picked) { return; }

    if (picked.action === 'toggleStatusBar') {
      await cfg.update('🌈 ColorStatusBar', !curStatusBar, false);
      const action = await window.showInformationMessage(
        `Status Bar Color: ${!curStatusBar ? 'ON' : 'OFF'}. Reload to apply.`, 'Reload Window'
      );
      if (action === 'Reload Window') { commands.executeCommand('workbench.action.reloadWindow'); }

    } else if (picked.action === 'toggleStatusBarAllStates') {
      await cfg.update('🌈 ColorStatusBarAllStates', !curStatusBarAllStates, false);
      const action = await window.showInformationMessage(
        `Status Bar Color All States: ${!curStatusBarAllStates ? 'ON' : 'OFF'}. Reload to apply.`, 'Reload Window'
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
    const currentColorStatusBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBar') || false;
    const currentColorStatusBarAllStates = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBarAllStates') || false;
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
      newCc['activityBar.background'] = sideBarColor.hex();
      newCc['titleBar.activeBackground'] = titleBarColor.hex();
      newCc['titleBar.activeForeground'] = titleBarTextColor.hex();
      newCc['titleBar.inactiveBackground'] = sideBarColor.hex();
      newCc['titleBar.inactiveForeground'] = titleBarTextColor.hex();
      if (currentColorStatusBar) {
        newCc['statusBar.background'] = sideBarColor.hex();
        newCc['statusBar.foreground'] = titleBarTextColor.hex();
      }
      if (currentColorStatusBarAllStates) {
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
}

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

function stringToARGB(str: string) {
  return intToARGB(hashCode(str));
}

// https://www.designedbyaturtle.co.uk/convert-string-to-hexidecimal-colour-with-javascript-vanilla/
// Hash any string into an integer value
// Then we'll use the int and convert to hex.
function hashCode(str: string) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

// https://www.designedbyaturtle.co.uk/convert-string-to-hexidecimal-colour-with-javascript-vanilla/
// Convert an int to hexadecimal with a max length
// of six characters.
function intToARGB(i: number) {
  var hex = ((i >> 24) & 0xFF).toString(16) +
    ((i >> 16) & 0xFF).toString(16) +
    ((i >> 8) & 0xFF).toString(16) +
    (i & 0xFF).toString(16);
  // Sometimes the string returned will be too short so we
  // add zeros to pad it out, which later get removed if
  // the length is greater than six.
  hex += '000000';
  return hex.substring(0, 6);
}


// https://stackoverflow.com/questions/45218663/use-workbench-colorcustomizations-in-extension
