import * as Color from 'color';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const randomSeed = require('random-seed');
import { ConfigurationTarget, ExtensionContext, workspace, WorkspaceFolder, commands, window, ColorThemeKind } from 'vscode';
import {
  ColorCustomizations,
  extractBackgrounds,
  getColorWithLuminosity,
  improveForegrounds,
  MANAGED_COLOR_KEYS,
  mergePreservedBackgrounds,
  parseBaseColor,
  reconcileColorCustomizations,
} from './color_model';
import { removeManagedColorCustomizations, WorkspaceSettings } from './settings_cleanup';

export const BASE_COLORS = [
  // Reds & Pinks
  { emoji: '🟥🟥🟥', name: 'Red',         hex: '#c0392b' },
  { emoji: '🟥🟥🟪', name: 'Crimson',     hex: '#9b1b5a' },
  { emoji: '🟥🟥⬛', name: 'Blood',       hex: '#7a0808' },
  { emoji: '🟥🟪🟪', name: 'Berry',       hex: '#6b1048' },
  // Browns & Oranges
  { emoji: '🟫🟫🟫', name: 'Brown',       hex: '#6d4c41' },
  { emoji: '🟫🟥🟥', name: 'Maroon',      hex: '#5c2020' },
  { emoji: '🟧🟧🟧', name: 'Orange',      hex: '#d88000' },
  { emoji: '🟧🟧🟥', name: 'Rust',        hex: '#a02c18' },
  { emoji: '🟧🟧🟫', name: 'Ember',       hex: '#a84808' },
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

export interface DerivedColors {
  sideBar: Color;
  titleBar: Color;
  inactiveTitleBar: Color;
  statusBar: Color;
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

// Derive themed bar backgrounds from a raw base color.
// When respectExtremes is true, colors already beyond the dark/light threshold are
// kept as-is (used for user-chosen baseColor overrides like Black or White).
export function deriveThemedColors(
  rawColor: Color,
  theme: string | undefined,
  respectExtremes = false,
): DerivedColors {
  const hue = rawColor.hue();
  const yellowish = hue >= 40 && hue <= 70;
  const achromatic = rawColor.saturationl() < 5;
  // Orange-to-red hues (8–40°) need a higher luminosity floor than other colors —
  // at lum 0.02 they become indistinguishable from dark brown.
  const orangish = !achromatic && hue >= 8 && hue < 40;
  // Achromatic tiers: Gray (mid) gets darkest in dark mode,
  // White (light) gets a higher floor so it reads as lighter gray.
  // Black keeps its identity regardless of theme.
  const grayish = achromatic && rawColor.luminosity() > 0.05 && rawColor.luminosity() < 0.5;
  const whitish = achromatic && rawColor.luminosity() >= 0.5;

  // Dark-mode luminosity ranges (reused by light mode for the sidebar)
  const dkMin = whitish ? 0.03 : grayish ? 0.008 : yellowish ? 0.05 : orangish ? 0.08 : 0.02;
  const dkMax = whitish ? 0.045 : grayish ? 0.013 : yellowish ? 0.07 : orangish ? 0.11 : 0.027;

  if (theme === 'dark') {
    const sideBar = respectExtremes && rawColor.luminosity() < dkMin
      ? rawColor
      : getColorWithLuminosity(rawColor, dkMin, dkMax);
    return {
      sideBar,
      titleBar: sideBar.lighten(0.5),
      inactiveTitleBar: sideBar,
      statusBar: sideBar,
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

    // Inactive title bars sit clearly above the dark activity bar while
    // remaining well below the pastel active title bar in perceived brightness.
    const inactiveTitleBar = getColorWithLuminosity(rawColor, 0.28, 0.32);

    // Status bar = a few shades lighter than the sidebar
    const statusBar = sideBar.lightness(sideBar.lightness() + 4);

    return {
      sideBar,
      titleBar,
      inactiveTitleBar,
      statusBar,
    };
  }

  // No theme (raw color mode)
  const titleBar = rawColor.lighten(0.3);
  return {
    sideBar: rawColor,
    titleBar,
    inactiveTitleBar: rawColor,
    statusBar: rawColor,
  };
}

export class SettingsFileDeleter {
  constructor(private workspaceRoot: string) { }

  /**
   * When explicitly enabled, removes extension-owned colors on shutdown while
   * preserving all unrelated workspace settings.
   */
  public dispose() {
    const deleteSettingsFileUponExit = workspace.getConfiguration('windowColors')
      .get<boolean>('deleteSettingsFileUponExit') ?? false;
    if (!deleteSettingsFileUponExit) {
      return;
    }

    const settingsFile = this.workspaceRoot + '/.vscode/settings.json';
    const vscodeDir = this.workspaceRoot + '/.vscode';
    if (!fs.existsSync(settingsFile)) {
      return;
    }

    let settingsFileJson: WorkspaceSettings;
    try {
      settingsFileJson = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as WorkspaceSettings;
    } catch {
      return;
    }
    const cleaned = removeManagedColorCustomizations(settingsFileJson);
    if (JSON.stringify(cleaned) === JSON.stringify(settingsFileJson)) {
      return;
    }

    if (Object.keys(cleaned).length === 0) {
      fs.unlinkSync(settingsFile);
      try { fs.rmdirSync(vscodeDir); } catch { /* dir not empty, leave it */ }
    } else {
      fs.writeFileSync(settingsFile, JSON.stringify(cleaned, null, 2) + '\n');
    }
  }
}

async function applyWindowColors(
  workspaceRoot: string,
  preservedBackgrounds?: ColorCustomizations,
): Promise<void> {

  const neverColor = workspace.getConfiguration('windowColors').get<boolean>('neverColorThisWindow') ?? false;
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
    return;
  }

  const extensionTheme = resolveTheme(workspace.getConfiguration('windowColors').get<string>('theme'));
  let baseColor = workspace.getConfiguration('windowColors').get<string>('baseColor');
  if (baseColor) {
    baseColor = baseColor.toLowerCase().trim();
  }
  const colorTitleBar = workspace.getConfiguration('windowColors').get<boolean>('colorTitleBar') ?? true;
  const colorActivityBar = workspace.getConfiguration('windowColors').get<boolean>('colorActivityBar') ?? true;
  const colorStatusBar = workspace.getConfiguration('windowColors').get<boolean>('colorStatusBar') ?? true;

  // Retain initial unrelated colorCustomizations
  const configuredCc = JSON.parse(JSON.stringify(
    workspace.getConfiguration('workbench').get('colorCustomizations') || {}
  )) as ColorCustomizations;
  const cc = mergePreservedBackgrounds(configuredCc, preservedBackgrounds);

  let derived: DerivedColors;

  // An unusable baseColor must fall back to the generated color rather than
  // rejecting and leaving the window with no colors at all.
  const explicitBaseColor = baseColor ? parseBaseColor(baseColor) : undefined;
  if (baseColor && !explicitBaseColor) {
    window.showWarningMessage(
      `Window Colors: "${baseColor}" is not a valid color, so this window's generated color was used instead. ` +
      'Use "Window Colors: Set Base Color" to choose a different one.',
    );
  }

  if (explicitBaseColor) {
    derived = deriveThemedColors(explicitBaseColor, extensionTheme, true);
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

  const {
    sideBar: sideBarColor,
    titleBar: titleBarColor,
    inactiveTitleBar: inactiveTitleBarColor,
    statusBar: statusBarColor,
  } = derived;

  const doRemoveColors = extensionTheme === 'remove';

  // Existing backgrounds are authoritative, even if their old base color is no
  // longer in BASE_COLORS. Generated backgrounds fill missing roles only.
  const generatedBackgrounds: ColorCustomizations = {};
  if (!doRemoveColors && colorActivityBar) {
    generatedBackgrounds['activityBar.background'] = sideBarColor.hex();
  }
  if (!doRemoveColors && colorTitleBar) {
    generatedBackgrounds['titleBar.activeBackground'] = titleBarColor.hex();
    generatedBackgrounds['titleBar.inactiveBackground'] = inactiveTitleBarColor.hex();
  }
  if (!doRemoveColors && colorStatusBar) {
    generatedBackgrounds['statusBar.background'] = statusBarColor.hex();
    generatedBackgrounds['statusBar.debuggingBackground'] = statusBarColor.hex();
    generatedBackgrounds['statusBar.noFolderBackground'] = statusBarColor.hex();
  }
  const effectiveCc = reconcileColorCustomizations(
    configuredCc,
    preservedBackgrounds,
    generatedBackgrounds,
    {
      activityBar: colorActivityBar,
      titleBar: colorTitleBar,
      statusBar: colorStatusBar,
      removeAll: doRemoveColors,
    },
  );
  if (JSON.stringify(effectiveCc) !== JSON.stringify(configuredCc)) {
    await workspace.getConfiguration('workbench').update('colorCustomizations', effectiveCc, false);
  }
}

// Mapping from old emoji-prefixed setting keys to new camelCase keys.
// Used to migrate settings from versions <= 1.2.4.
const SETTINGS_MIGRATIONS: [string, string][] = [
  ['🌈 Theme', 'theme'],
  ['🌈 DeleteSettingsFileUponExit', 'deleteSettingsFileUponExit'],
  ['🌈 BaseColor', 'baseColor'],
  ['🌈 ColorTitleBar', 'colorTitleBar'],
  ['🌈 ColorActivityBar', 'colorActivityBar'],
  ['🌈 ColorStatusBar', 'colorStatusBar'],
  ['🌈 NeverColorThisWindow', 'neverColorThisWindow'],
];

const PRESERVED_BACKGROUNDS_STATE_PREFIX = 'preservedBackgroundsV1';

/**
 * Migrate old emoji-prefixed settings (e.g. "windowColors.🌈 Theme") to new
 * camelCase keys (e.g. "windowColors.theme").
 *
 * Workspace settings are migrated via direct file I/O (reliable regardless of
 * whether VS Code still recognises the old keys).  User/global settings are
 * migrated through the configuration API on a best-effort basis.
 */
async function migrateOldSettings(workspaceRoot: string): Promise<void> {
  // --- Workspace settings: direct file manipulation (most reliable) ---
  const settingsFile = workspaceRoot + '/.vscode/settings.json';
  if (fs.existsSync(settingsFile)) {
    try {
      const content: Record<string, unknown> = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      let changed = false;

      for (const [oldKey, newKey] of SETTINGS_MIGRATIONS) {
        const oldFull = `windowColors.${oldKey}`;
        const newFull = `windowColors.${newKey}`;

        if (oldFull in content) {
          // Only copy if the new key doesn't already have a value
          if (!(newFull in content)) {
            content[newFull] = content[oldFull];
          }
          delete content[oldFull];
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(settingsFile, JSON.stringify(content, null, 2) + '\n');
      }
    } catch { /* malformed JSON or permission error — skip */ }
  }

  // --- User (global) settings: best-effort via configuration API ---
  const cfg = workspace.getConfiguration('windowColors');
  for (const [oldKey, newKey] of SETTINGS_MIGRATIONS) {
    try {
      const old = cfg.inspect(oldKey);
      if (old?.globalValue !== undefined) {
        const cur = cfg.inspect(newKey);
        if (cur?.globalValue === undefined) {
          await cfg.update(newKey, old.globalValue, ConfigurationTarget.Global);
        }
        // Try to remove the old key (may silently fail for unregistered keys)
        try { await cfg.update(oldKey, undefined, ConfigurationTarget.Global); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
}

export function activate(context: ExtensionContext) {

  if (!workspace.workspaceFolders) {
    return;
  }

  const workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders);
  const workspaceIdentity = workspace.workspaceFolders[0].uri.toString();
  const preservedBackgroundsStateKey = `${PRESERVED_BACKGROUNDS_STATE_PREFIX}:${workspaceIdentity}`;

  const getRememberedBackgrounds = (): ColorCustomizations | undefined =>
    context.globalState.get<ColorCustomizations>(preservedBackgroundsStateKey);

  const rememberCurrentBackgrounds = async (): Promise<void> => {
    const current = workspace.getConfiguration('workbench')
      .get<ColorCustomizations>('colorCustomizations') || {};
    const backgrounds = extractBackgrounds(current);
    await context.globalState.update(
      preservedBackgroundsStateKey,
      Object.keys(backgrounds).length > 0 ? backgrounds : undefined,
    );
  };

  const forgetRememberedBackgrounds = (): Thenable<void> =>
    context.globalState.update(preservedBackgroundsStateKey, undefined);

  const applyAndRememberWindowColors = async (): Promise<void> => {
    await applyWindowColors(workspaceRoot, getRememberedBackgrounds());
    await rememberCurrentBackgrounds();
  };

  context.subscriptions.push(new SettingsFileDeleter(workspaceRoot));

  // Migrate old emoji-prefixed settings before applying colors
  migrateOldSettings(workspaceRoot).then(() => applyAndRememberWindowColors());

  // One-time update notice for users migrating from the old emoji-key versions
  const noticeKey = 'shownUpdateNotice__1_2_9_feb25_4';
  const paletteKey = process.platform === 'darwin' ? 'Cmd+Shift+P' : 'Ctrl+Shift+P';
  const showUpdateNotice = () => {
    window.showInformationMessage(
      `🌈 Window Colors was updated with settings changes. If your colors look wrong, use "Reset Colors" to fix them. You can also hand-pick a color with "Set Base Color". To run these anytime: ${paletteKey} → "Window Colors".`,
      'Reset Colors',
      'Set Base Color',
    ).then(async choice => {
      if (choice === 'Reset Colors') {
        await commands.executeCommand('windowColors.resetColors');
        showUpdateNotice();
      } else if (choice === 'Set Base Color') {
        await commands.executeCommand('windowColors.pickBaseColor');
        showUpdateNotice();
      }
    });
  };
  if (!context.globalState.get<boolean>(noticeKey)) {
    context.globalState.update(noticeKey, true);
    showUpdateNotice();
  }

  // Re-apply colors when VS Code's color theme changes (matters when Theme is "auto")
  context.subscriptions.push(
    window.onDidChangeActiveColorTheme(() => {
      const themeSetting = workspace.getConfiguration('windowColors').get<string>('theme');
      if (!themeSetting || themeSetting === 'auto') {
        applyAndRememberWindowColors();
      }
    })
  );

  const openSettingsDisposable = commands.registerCommand('windowColors.openSettings', async () => {

    const cfg = workspace.getConfiguration('windowColors');
    const curNeverColor = cfg.get<boolean>('neverColorThisWindow') ?? false;
    const curTitleBar = cfg.get<boolean>('colorTitleBar') ?? true;
    const curActivityBar = cfg.get<boolean>('colorActivityBar') ?? true;
    const curStatusBar = cfg.get<boolean>('colorStatusBar') ?? true;
    const curBaseColor = cfg.get<string>('baseColor') ?? null;
    const curTheme = cfg.get<string>('theme') ?? 'auto';

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
        label: `$(refresh)  Reset Colors in This Window`,
        description: '',
        detail: 'Clear base color override and reapply auto-generated colors from scratch',
        action: 'resetColors',
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
      await cfg.update('colorTitleBar', !curTitleBar, false);
      await applyAndRememberWindowColors();

    } else if (picked.action === 'toggleActivityBar') {
      await cfg.update('colorActivityBar', !curActivityBar, false);
      await applyAndRememberWindowColors();

    } else if (picked.action === 'toggleStatusBar') {
      await cfg.update('colorStatusBar', !curStatusBar, false);
      await applyAndRememberWindowColors();

    } else if (picked.action === 'toggleNeverColor') {
      await cfg.update('neverColorThisWindow', !curNeverColor, false);
      await applyAndRememberWindowColors();

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
      await cfg.update('theme', themePicked.value, false);
      await applyAndRememberWindowColors();

    } else if (picked.action === 'resetColors') {
      commands.executeCommand('windowColors.resetColors');

    } else if (picked.action === 'removeColors') {
      commands.executeCommand('windowColors.removeColors');
    }
  });

  context.subscriptions.push(openSettingsDisposable);

  const pickColorDisposable = commands.registerCommand('windowColors.pickBaseColor', () => new Promise<void>(resolve => {

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
    const currentTheme = resolveTheme(cfg.get<string>('theme'));
    const currentColorTitleBar = cfg.get<boolean>('colorTitleBar') ?? true;
    const currentColorActivityBar = cfg.get<boolean>('colorActivityBar') ?? true;
    const currentColorStatusBar = cfg.get<boolean>('colorStatusBar') ?? true;
    const originalCc = JSON.parse(JSON.stringify(
      workspace.getConfiguration('workbench').get('colorCustomizations') || {}
    ));

    const applyHex = async (hex: string) => {
      const { sideBar, titleBar, inactiveTitleBar, statusBar } =
        deriveThemedColors(Color(hex), currentTheme, true);

      const newCc = { ...originalCc };
      if (currentColorActivityBar) {
        newCc['activityBar.background'] = sideBar.hex();
      }
      if (currentColorTitleBar) {
        newCc['titleBar.activeBackground'] = titleBar.hex();
        newCc['titleBar.inactiveBackground'] = inactiveTitleBar.hex();
      }
      if (currentColorStatusBar) {
        newCc['statusBar.background'] = statusBar.hex();
        newCc['statusBar.debuggingBackground'] = statusBar.hex();
        newCc['statusBar.noFolderBackground'] = statusBar.hex();
      }
      await workspace.getConfiguration('workbench').update(
        'colorCustomizations',
        improveForegrounds(newCc),
        false,
      );
    };

    const qp = window.createQuickPick();
    qp.items = items;
    qp.placeholder = 'Select a base color for this window';
    let accepted = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    qp.onDidChangeActive((activeItems) => {
      if (debounceTimer) { clearTimeout(debounceTimer); }
      debounceTimer = setTimeout(async () => {
        if (!activeItems.length) { return; }
        const hex = colorMap.get(activeItems[0].label);
        try {
          if (typeof hex === 'string' && hex !== 'custom') {
            await applyHex(hex);
          } else {
            await workspace.getConfiguration('workbench').update('colorCustomizations', originalCc, false);
          }
        } catch { /* ignore preview errors */ }
      }, 50);
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

      await workspace.getConfiguration('windowColors').update('baseColor', hexValue === null ? undefined : hexValue, false);
      await rememberCurrentBackgrounds();
    });

    qp.onDidHide(() => {
      if (!accepted) {
        workspace.getConfiguration('workbench').update('colorCustomizations', originalCc, false);
      }
      qp.dispose();
      resolve();
    });

    qp.show();
  }));

  context.subscriptions.push(pickColorDisposable);

  const resetColorsDisposable = commands.registerCommand('windowColors.resetColors', async () => {
    const cfg = workspace.getConfiguration('windowColors');

    // If this window is set to never be colored, ask before proceeding
    const neverColor = cfg.get<boolean>('neverColorThisWindow') ?? false;
    if (neverColor) {
      const choice = await window.showWarningMessage(
        'This window is set to "Never Color This Window". Enable colors and reset?',
        'Enable & Reset',
        'Cancel',
      );
      if (choice !== 'Enable & Reset') { return; }
      await cfg.update('neverColorThisWindow', false, false);
    }

    // Clear base color so auto-generation kicks in
    const hasBaseColor = cfg.inspect('baseColor')?.workspaceValue !== undefined;
    if (hasBaseColor) {
      await cfg.update('baseColor', undefined, false);
    }

    // Strip all managed color keys so applyWindowColors writes fresh values
    const cc = { ...(workspace.getConfiguration('workbench').get('colorCustomizations') as Record<string, string> || {}) };
    for (const key of MANAGED_COLOR_KEYS) {
      delete cc[key];
    }
    await workspace.getConfiguration('workbench').update('colorCustomizations',
      Object.keys(cc).length > 0 ? cc : undefined, false);

    await forgetRememberedBackgrounds();
    await applyAndRememberWindowColors();
    const pk = process.platform === 'darwin' ? 'Cmd+Shift+P' : 'Ctrl+Shift+P';
    window.showInformationMessage(`Window colors reset. For more options: ${pk} → "Window Colors".`);
  });

  context.subscriptions.push(resetColorsDisposable);

  const removeColorsDisposable = commands.registerCommand('windowColors.removeColors', async () => {
    const settingsFile = workspaceRoot + '/.vscode/settings.json';
    const vscodeDir = workspaceRoot + '/.vscode';

    await forgetRememberedBackgrounds();

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
