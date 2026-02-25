import * as Color from 'color';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const randomSeed = require('random-seed');
import { ExtensionContext, workspace, WorkspaceFolder, commands, window, ColorThemeKind } from 'vscode';

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
  // Reds & Pinks
  { emoji: '🟥🟥🟥', name: 'Red',         hex: '#c0392b' },
  { emoji: '🟥🟥🟪', name: 'Crimson',     hex: '#9b1b5a' },
  { emoji: '🟥🟥⬛', name: 'Blood',       hex: '#7a0808' },
  { emoji: '🟥🟪🟪', name: 'Berry',       hex: '#6b1048' },
  // Browns & Oranges
  { emoji: '🟫🟫🟫', name: 'Brown',       hex: '#6d4c41' },
  { emoji: '🟫🟥🟥', name: 'Maroon',      hex: '#5c2020' },
  { emoji: '🟧🟧🟧', name: 'Orange',      hex: '#e67e22' },
  { emoji: '🟧🟧🟥', name: 'Rust',        hex: '#c0410a' },
  { emoji: '🟧🟧🟫', name: 'Ember',       hex: '#c46210' },
  // Yellows & Olives
  { emoji: '🟨🟨🟨', name: 'Yellow',      hex: '#f1c40f' },
  { emoji: '🟩🟨🟫', name: 'Olive',       hex: '#6b6b15' },
  { emoji: '🟨🟨🟩', name: 'Chartreuse',  hex: '#a3b820' },
  // Greens
  { emoji: '🟩🟩🟩', name: 'Green',       hex: '#27ae60' },
  { emoji: '🟩🟩🟨', name: 'Lime',        hex: '#6ba00d' },
  { emoji: '🟩🟩⬛', name: 'Forest',      hex: '#022002' },
  { emoji: '🟩⬜⬛', name: 'Sage',        hex: '#4a7a4a' },
  { emoji: '🟩🟩🟦', name: 'Emerald',     hex: '#10b035' },
  // Teals
  { emoji: '🟦🟩🟩', name: 'Juniper',     hex: '#18503e' },
  { emoji: '🟦🟦🟩', name: 'Teal',        hex: '#0a9e9e' },
  // Blues
  { emoji: '🟦🟦🟫', name: 'Petrol',      hex: '#0c7ba0' },
  { emoji: '🟦🟦⬛', name: 'Navy',        hex: '#031a30' },
  { emoji: '🟦🟦🟦', name: 'Blue',        hex: '#2980b9' },
  { emoji: '🟦⬛🟦', name: 'Cobalt',      hex: '#1050a0' },
  { emoji: '🟦🟦🟪', name: 'Ultramarine', hex: '#1818a0' },
  { emoji: '⬛⬛🟦', name: 'Midnight',    hex: '#151540' },
  // Purples
  { emoji: '🟦🟪🟪', name: 'Indigo',      hex: '#3a2a80' },
  { emoji: '🟪🟪🟪', name: 'Purple',      hex: '#8e44ad' },
  { emoji: '🟪🟪🟦', name: 'Violet',      hex: '#7a10a0' },
  { emoji: '🟪🟪⬛', name: 'Plum',        hex: '#400a55' },
  { emoji: '🟪⬜⬛', name: 'Mauve',       hex: '#7a4878' },
  { emoji: '🟪🟪🟥', name: 'Magenta',     hex: '#a00da0' },
  // Achromatics
  { emoji: '⬛⬛⬛', name: 'Black',       hex: '#080808' },
  { emoji: '⬜⬛⬜', name: 'Gray',        hex: '#808080' },
  { emoji: '⬜⬜⬜', name: 'White',       hex: '#e0e0e0' },
];

interface DerivedColors {
  sideBar: Color;
  titleBar: Color;
  titleBarText: Color;
  statusBar: Color;
  statusBarText: Color;
}

// Resolve the theme setting: "auto" detects from VS Code's active color theme.
function resolveTheme(setting: string | undefined): string | undefined {
  if (!setting || setting === 'auto') {
    const kind = window.activeColorTheme.kind;
    return (kind === ColorThemeKind.Light || kind === ColorThemeKind.HighContrastLight)
      ? 'light' : 'dark';
  }
  return setting;
}

// Derive themed sidebar, title bar, and title bar text colors from a raw base color.
// When respectExtremes is true, colors already beyond the dark/light threshold are
// kept as-is (used for user-chosen baseColor overrides like Black or White).
function deriveThemedColors(rawColor: Color, theme: string | undefined, respectExtremes = false): DerivedColors {
  const hue = rawColor.hue();
  const yellowish = hue >= 40 && hue <= 70;
  const achromatic = rawColor.saturationl() < 5;
  // Achromatic tiers: Gray (mid) gets darkest in dark mode,
  // White (light) gets a higher floor so it reads as lighter gray.
  // Black keeps its identity regardless of theme.
  const grayish = achromatic && rawColor.luminosity() > 0.05 && rawColor.luminosity() < 0.5;
  const whitish = achromatic && rawColor.luminosity() >= 0.5;

  // Dark-mode luminosity ranges (reused by light mode for the sidebar)
  const dkMin = whitish ? 0.03 : grayish ? 0.008 : yellowish ? 0.04 : 0.02;
  const dkMax = whitish ? 0.045 : grayish ? 0.013 : yellowish ? 0.055 : 0.027;

  if (theme === 'dark') {
    const sideBar = respectExtremes && rawColor.luminosity() < dkMin
      ? rawColor
      : getColorWithLuminosity(rawColor, dkMin, dkMax);
    return {
      sideBar,
      titleBar: sideBar.lighten(0.4),
      titleBarText: getColorWithLuminosity(sideBar, 0.95, 1),
      statusBar: sideBar,
      statusBarText: getColorWithLuminosity(sideBar, 0.95, 1),
    };
  }

  if (theme === 'light') {
    // Sidebar = dark version of the color (same as dark mode)
    const sideBar = respectExtremes && rawColor.luminosity() < dkMin
      ? rawColor
      : getColorWithLuminosity(rawColor, dkMin, dkMax);

    // Title bar = light/pastel version with dark text
    const ltMin = grayish ? 0.65 : 0.45;
    const ltMax = grayish ? 0.75 : 0.55;
    const titleBar = respectExtremes && rawColor.luminosity() > ltMax
      ? rawColor
      : getColorWithLuminosity(rawColor, ltMin, ltMax);

    // Status bar = a few shades lighter than the sidebar
    const statusBar = sideBar.lightness(sideBar.lightness() + 4);

    return {
      sideBar,
      titleBar,
      titleBarText: getColorWithLuminosity(titleBar, 0, 0.01),
      statusBar,
      statusBarText: getColorWithLuminosity(statusBar, 0.95, 1),
    };
  }

  // No theme (raw color mode)
  const titleBar = rawColor.lighten(0.3);
  const titleBarText = titleBar.luminosity() > 0.5
    ? getColorWithLuminosity(rawColor, 0, 0.01)
    : getColorWithLuminosity(rawColor, 0.95, 1);
  return {
    sideBar: rawColor,
    titleBar,
    titleBarText,
    statusBar: rawColor,
    statusBarText: titleBarText,
  };
}

export class SettingsFileDeleter {
  constructor(
    private workspaceRoot: string,
    private computedColors: Record<string, string>) { }

  /**
   * Deletes .vscode/settings.json if colors all match the computed defaults and no other settings exist.
   * Deletes .vscode if no other files exist.
   */
  public dispose() {
    const settingsFile = this.workspaceRoot + '/.vscode/settings.json';
    const vscodeDir = this.workspaceRoot + '/.vscode';

    if (!fs.existsSync(settingsFile)) {
      return;
    }

    const settingsFileJson = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    const cc = { ...(workspace.getConfiguration('workbench').get('colorCustomizations') as Record<string, string> || {}) };

    const deleteSettingsFileUponExit = workspace.getConfiguration('windowColors').get<boolean>('🌈 DeleteSettingsFileUponExit') ?? false;

    if (deleteSettingsFileUponExit) {
      fs.unlinkSync(settingsFile);
      try { fs.rmdirSync(vscodeDir); } catch { /* dir not empty, leave it */ }
    } else if (Object.keys(settingsFileJson).length === 1) {
      // All keys in cc must be managed keys (user hasn't added their own)
      const managedKeySet = new Set(MANAGED_COLOR_KEYS);
      const onlyManagedKeys = Object.keys(cc).every(k => managedKeySet.has(k));

      if (onlyManagedKeys) {
        // Check none of the managed colors were modified from computed defaults
        const aColorWasModified = Object.keys(this.computedColors).some(
          (key: string) => cc[key] && cc[key] !== this.computedColors[key]
        );

        if (!aColorWasModified) {
          fs.unlinkSync(settingsFile);
          try { fs.rmdirSync(vscodeDir); } catch { /* dir not empty, leave it */ }
        }
      }
    }
  }
}

async function applyWindowColors(workspaceRoot: string): Promise<Record<string, string>> {

  const neverColor = workspace.getConfiguration('windowColors').get<boolean>('🌈 NeverColorThisWindow') ?? false;
  if (neverColor) {
    // Strip any managed colors that may already be present, then bail out.
    const cc = { ...(workspace.getConfiguration('workbench').get('colorCustomizations') as Record<string, string> || {}) };
    let changed = false;
    for (const key of MANAGED_COLOR_KEYS) {
      if (cc[key] !== undefined) {
        cc[key] = undefined as unknown as string;
        changed = true;
      }
    }
    if (changed) {
      await workspace.getConfiguration('workbench').update('colorCustomizations', cc, false);
    }
    return {};
  }

  const extensionTheme = resolveTheme(workspace.getConfiguration('windowColors').get<string>('🌈 Theme'));
  let baseColor = workspace.getConfiguration('windowColors').get<string>('🌈 BaseColor');
  if (baseColor) {
    baseColor = baseColor.toLowerCase().trim();
  }
  const colorTitleBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorTitleBar') ?? true;
  const colorActivityBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorActivityBar') ?? true;
  const colorStatusBar = workspace.getConfiguration('windowColors').get<boolean>('🌈 ColorStatusBar') ?? false;

  // Retain initial unrelated colorCustomizations
  const cc = JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations') || {}));

  let derived: DerivedColors;

  if (baseColor) {
    derived = deriveThemedColors(Color(baseColor), extensionTheme, true);
  } else {
    // Include URI authority in the seed so that the same folder path opened on
    // different remote-SSH hosts produces a distinct color (issue #52).
    // For local windows the authority is empty and behaviour is unchanged.
    const firstFolder = workspace.workspaceFolders?.[0];
    const uriAuthority = firstFolder?.uri.authority || '';
    const colorSeed = uriAuthority ? `${uriAuthority}:${workspaceRoot}` : workspaceRoot;
    let rawColor: Color = Color(hashToBaseColor(colorSeed));

    // If the user already has an activityBar.background color (from a previous version)
    // and no explicit baseColor override, use their existing color as the base.
    // This ensures newly-added settings (like inactive title bar) derive from the
    // same color the user already sees, even if the hashing function has changed.
    if (cc['activityBar.background']) {
      rawColor = Color(cc['activityBar.background']);
    }

    derived = deriveThemedColors(rawColor, extensionTheme);
  }

  const { sideBar: sideBarColor, titleBar: titleBarColor, titleBarText: titleBarTextColor,
    statusBar: statusBarColor, statusBarText: statusBarTextColor } = derived;

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
        newCc['titleBar.inactiveBackground'] = sideBarColor.hex();
        newCc['titleBar.inactiveForeground'] = titleBarTextColor.hex();
      } else if (removeInactiveTitleBar) {
        newCc['titleBar.inactiveBackground'] = undefined;
        newCc['titleBar.inactiveForeground'] = undefined;
      }

      if (applyStatusBar) {
        newCc['statusBar.background'] = statusBarColor.hex();
        newCc['statusBar.foreground'] = statusBarTextColor.hex();
        newCc['statusBar.debuggingBackground'] = statusBarColor.hex();
        newCc['statusBar.debuggingForeground'] = statusBarTextColor.hex();
        newCc['statusBar.noFolderBackground'] = statusBarColor.hex();
        newCc['statusBar.noFolderForeground'] = statusBarTextColor.hex();
      } else if (removeStatusBar) {
        newCc['statusBar.background'] = undefined;
        newCc['statusBar.foreground'] = undefined;
        newCc['statusBar.debuggingBackground'] = undefined;
        newCc['statusBar.debuggingForeground'] = undefined;
        newCc['statusBar.noFolderBackground'] = undefined;
        newCc['statusBar.noFolderForeground'] = undefined;
      }
    }

    await workspace.getConfiguration('workbench').update('colorCustomizations', newCc, false);
  }

  // Build computedColors map for SettingsFileDeleter
  const computedColors: Record<string, string> = {};
  if (colorActivityBar) {
    computedColors['activityBar.background'] = sideBarColor.hex();
  }
  if (colorTitleBar) {
    computedColors['titleBar.activeBackground'] = titleBarColor.hex();
    computedColors['titleBar.activeForeground'] = titleBarTextColor.hex();
    computedColors['titleBar.inactiveBackground'] = sideBarColor.hex();
    computedColors['titleBar.inactiveForeground'] = titleBarTextColor.hex();
  }
  if (colorStatusBar) {
    computedColors['statusBar.background'] = statusBarColor.hex();
    computedColors['statusBar.foreground'] = statusBarTextColor.hex();
    computedColors['statusBar.debuggingBackground'] = statusBarColor.hex();
    computedColors['statusBar.debuggingForeground'] = statusBarTextColor.hex();
    computedColors['statusBar.noFolderBackground'] = statusBarColor.hex();
    computedColors['statusBar.noFolderForeground'] = statusBarTextColor.hex();
  }
  return computedColors;
}

export function activate(context: ExtensionContext) {

  if (!workspace.workspaceFolders) {
    return;
  }

  const workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders);

  applyWindowColors(workspaceRoot).then(computedColors => {
    const settingsFileDeleter = new SettingsFileDeleter(workspaceRoot, computedColors);
    context.subscriptions.push(settingsFileDeleter);
  });

  // Re-apply colors when VS Code's color theme changes (matters when Theme is "auto")
  context.subscriptions.push(
    window.onDidChangeActiveColorTheme(() => {
      const themeSetting = workspace.getConfiguration('windowColors').get<string>('🌈 Theme');
      if (!themeSetting || themeSetting === 'auto') {
        applyWindowColors(workspaceRoot);
      }
    })
  );

  const openSettingsDisposable = commands.registerCommand('windowColors.openSettings', async () => {

    const cfg = workspace.getConfiguration('windowColors');
    const curNeverColor = cfg.get<boolean>('🌈 NeverColorThisWindow') ?? false;
    const curTitleBar = cfg.get<boolean>('🌈 ColorTitleBar') ?? true;
    const curActivityBar = cfg.get<boolean>('🌈 ColorActivityBar') ?? true;
    const curStatusBar = cfg.get<boolean>('🌈 ColorStatusBar') ?? false;
    const curBaseColor = cfg.get<string>('🌈 BaseColor') ?? null;
    const curTheme = cfg.get<string>('🌈 Theme') ?? 'auto';

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
        label: `$(${curNeverColor ? 'check' : 'circle-slash'})  Never Color This Window`,
        description: curNeverColor ? 'ON' : 'off',
        detail: 'Permanently skip coloring this workspace — colors will not reapply on reload',
        action: 'toggleNeverColor',
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
      await applyWindowColors(workspaceRoot);

    } else if (picked.action === 'toggleActivityBar') {
      await cfg.update('🌈 ColorActivityBar', !curActivityBar, false);
      await applyWindowColors(workspaceRoot);

    } else if (picked.action === 'toggleStatusBar') {
      await cfg.update('🌈 ColorStatusBar', !curStatusBar, false);
      await applyWindowColors(workspaceRoot);

    } else if (picked.action === 'toggleNeverColor') {
      await cfg.update('🌈 NeverColorThisWindow', !curNeverColor, false);
      await applyWindowColors(workspaceRoot);

    } else if (picked.action === 'pickColor') {
      commands.executeCommand('windowColors.pickBaseColor');

    } else if (picked.action === 'pickTheme') {
      const themeItems = [
        { label: '🔄  auto',   description: curTheme === 'auto'   ? '← current' : '', value: 'auto' },
        { label: '🌙  dark',   description: curTheme === 'dark'   ? '← current' : '', value: 'dark' },
        { label: '☀️  light',  description: curTheme === 'light'  ? '← current' : '', value: 'light' },
        { label: '🚫  remove', description: curTheme === 'remove' ? '← current' : '', value: 'remove' },
      ];
      const themePicked = await window.showQuickPick(themeItems, { placeHolder: 'Select theme' });
      if (!themePicked) { return; }
      await cfg.update('🌈 Theme', themePicked.value, false);
      await applyWindowColors(workspaceRoot);

    } else if (picked.action === 'removeColors') {
      commands.executeCommand('windowColors.removeColors');
    }
  });

  context.subscriptions.push(openSettingsDisposable);

  const pickColorDisposable = commands.registerCommand('windowColors.pickBaseColor', async () => {

    const colorMap = new Map<string, string | null>();
    const items: { label: string; description: string }[] = [];

    for (const c of BASE_COLORS) {
      const label = `${c.emoji}  ${c.name}`;
      items.push({ label, description: c.hex });
      colorMap.set(label, c.hex);
    }

    const autoLabel = '✨  Auto (from folder name)';
    const customLabel = '✏️  Custom...';
    items.push({ label: autoLabel, description: 'Remove base color override' });
    items.push({ label: customLabel, description: 'Enter any hex or CSS color name' });
    colorMap.set(autoLabel, null);
    colorMap.set(customLabel, 'custom');

    const cfg = workspace.getConfiguration('windowColors');
    const currentTheme = resolveTheme(cfg.get<string>('🌈 Theme'));
    const currentColorTitleBar = cfg.get<boolean>('🌈 ColorTitleBar') ?? true;
    const currentColorActivityBar = cfg.get<boolean>('🌈 ColorActivityBar') ?? true;
    const currentColorStatusBar = cfg.get<boolean>('🌈 ColorStatusBar') ?? false;
    const originalCc = JSON.parse(JSON.stringify(
      workspace.getConfiguration('workbench').get('colorCustomizations') || {}
    ));

    const applyHex = async (hex: string) => {
      const { sideBar, titleBar, titleBarText, statusBar, statusBarText } = deriveThemedColors(Color(hex), currentTheme, true);

      const newCc = { ...originalCc };
      if (currentColorActivityBar) {
        newCc['activityBar.background'] = sideBar.hex();
      }
      if (currentColorTitleBar) {
        newCc['titleBar.activeBackground'] = titleBar.hex();
        newCc['titleBar.activeForeground'] = titleBarText.hex();
        newCc['titleBar.inactiveBackground'] = sideBar.hex();
        newCc['titleBar.inactiveForeground'] = titleBarText.hex();
      }
      if (currentColorStatusBar) {
        newCc['statusBar.background'] = statusBar.hex();
        newCc['statusBar.foreground'] = statusBarText.hex();
        newCc['statusBar.debuggingBackground'] = statusBar.hex();
        newCc['statusBar.debuggingForeground'] = statusBarText.hex();
        newCc['statusBar.noFolderBackground'] = statusBar.hex();
        newCc['statusBar.noFolderForeground'] = statusBarText.hex();
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

    // Remove all windowColors.* settings
    for (const key of Object.keys(fileContent)) {
      if (key.startsWith('windowColors.')) {
        delete fileContent[key];
      }
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

const MAX_LUMINOSITY_ITERATIONS = 500;

function getColorWithLuminosity(color: Color, min: number, max: number): Color {
  let c: Color = Color(color.hex());
  let iterations = 0;
  while (c.luminosity() > max && iterations++ < MAX_LUMINOSITY_ITERATIONS) {
    c = c.darken(0.01);
  }
  while (c.luminosity() < min && iterations++ < MAX_LUMINOSITY_ITERATIONS) {
    c = c.lighten(0.01);
  }
  return c;
}

export function getWorkspaceFolder(folders: readonly WorkspaceFolder[] | undefined): string {
  if (!folders) {
    return '';
  }
  return folders[0]?.uri.fsPath ?? '';
}

// Deterministically pick one of the curated BASE_COLORS from the workspace
// path hash.  Achromatics (Black, Gray, White) are excluded because they'd
// be invisible against dark or light editor backgrounds.
function hashToBaseColor(str: string): string {
  const selectableColors = BASE_COLORS.filter(c =>
    !['Black', 'Gray', 'White'].includes(c.name)
  );
  const rand = randomSeed.create(str);
  const index = rand(selectableColors.length);
  return selectableColors[index].hex;
}
