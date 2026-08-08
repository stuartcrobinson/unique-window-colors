import { ColorCustomizations, extractBackgrounds, MANAGED_COLOR_KEYS } from './color_model';
import {
  deletePropertyAtPath,
  isDisposableDocument,
  parseSettingsDocument,
  renameTopLevelKey,
  WorkspaceSettings,
} from './settings_document';

export { WorkspaceSettings };

const COLOR_CUSTOMIZATIONS_KEY = 'workbench.colorCustomizations';
const WINDOW_COLORS_PREFIX = 'windowColors.';

/**
 * Emoji-prefixed setting names written by versions <= 1.2.4, paired with the
 * camelCase names used since, without the shared `windowColors.` prefix.
 *
 * The single source of truth for this mapping: the workspace file is migrated
 * by renaming text, while user settings go through the configuration API, and
 * both read this table.
 */
export const LEGACY_SETTING_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ['🌈 Theme', 'theme'],
  ['🌈 DeleteSettingsFileUponExit', 'deleteSettingsFileUponExit'],
  ['🌈 BaseColor', 'baseColor'],
  ['🌈 ColorTitleBar', 'colorTitleBar'],
  ['🌈 ColorActivityBar', 'colorActivityBar'],
  ['🌈 ColorStatusBar', 'colorStatusBar'],
  ['🌈 NeverColorThisWindow', 'neverColorThisWindow'],
];

/**
 * Rename this extension's legacy setting keys in workspace settings text.
 *
 * VS Code no longer recognises the emoji-prefixed names, so the configuration
 * API cannot rewrite them and the file has to be edited directly. Renaming in
 * place keeps the user's comments and formatting.
 *
 * Returns undefined when the file cannot be parsed, meaning it must be left
 * untouched rather than overwritten.
 */
export function migrateLegacySettingKeys(rawSettings: string): string | undefined {
  const parsed = parseSettingsDocument(rawSettings);
  if (!parsed) {
    return undefined;
  }

  let text = rawSettings;
  // Tracks modern keys created earlier in this same pass. `parsed` is a
  // snapshot of the original text and cannot see them, so without this a
  // second legacy key mapping to the same name would produce a duplicate.
  const claimed = new Set<string>();

  for (const [legacy, modern] of LEGACY_SETTING_MIGRATIONS) {
    const legacyKey = WINDOW_COLORS_PREFIX + legacy;
    const modernKey = WINDOW_COLORS_PREFIX + modern;
    if (!(legacyKey in parsed)) {
      continue;
    }

    // A value already stored under the modern key is the user's current
    // intent, so a stale legacy value must not overwrite it. The legacy key is
    // dropped either way so it cannot be migrated again on the next start.
    if (modernKey in parsed || claimed.has(modernKey)) {
      text = deletePropertyAtPath(text, [legacyKey]);
    } else {
      text = renameTopLevelKey(text, legacyKey, modernKey);
      claimed.add(modernKey);
    }
  }
  return text;
}

/**
 * Read managed backgrounds straight out of workspace settings text.
 *
 * The configuration API can report an empty `workbench.colorCustomizations`
 * during the first activation after an extension update, which would otherwise
 * look like a workspace that has no colors yet and invite regeneration. The
 * file on disk is what the user is actually looking at, so it wins.
 */
export function parseWorkspaceBackgrounds(rawSettings: string): ColorCustomizations {
  const parsed = parseSettingsDocument(rawSettings);
  if (!parsed) {
    return {};
  }

  const colorCustomizations = parsed[COLOR_CUSTOMIZATIONS_KEY];
  if (!colorCustomizations || typeof colorCustomizations !== 'object' || Array.isArray(colorCustomizations)) {
    return {};
  }
  return extractBackgrounds(colorCustomizations as ColorCustomizations);
}

export interface ManagedSettingsRemoval {
  /** Settings text after removal; identical to the input when nothing matched. */
  text: string;
  /** Whether any managed key was actually removed. */
  changed: boolean;
  /** True when no settings and no comments remain, so the file can be deleted. */
  disposable: boolean;
}

export interface RemovalOptions {
  /** Also strip this extension's own `windowColors.*` settings. */
  includeWindowColorsSettings?: boolean;
}

/**
 * Remove only extension-owned keys from workspace settings text.
 *
 * Operates on text rather than a parsed object so that comments, indentation,
 * and line endings survive: `.vscode/settings.json` is JSONC, and rewriting it
 * with `JSON.stringify` would silently discard everything the user wrote around
 * their settings.
 *
 * Returns undefined when the file cannot be parsed, meaning it must be left
 * untouched rather than overwritten.
 */
export function removeManagedSettings(
  rawSettings: string,
  options: RemovalOptions = {},
): ManagedSettingsRemoval | undefined {
  const parsed = parseSettingsDocument(rawSettings);
  if (!parsed) {
    return undefined;
  }

  let text = rawSettings;
  const colorCustomizations = parsed[COLOR_CUSTOMIZATIONS_KEY];
  const hasColorObject = Boolean(colorCustomizations)
    && typeof colorCustomizations === 'object'
    && !Array.isArray(colorCustomizations);

  if (hasColorObject) {
    const colors = colorCustomizations as Record<string, unknown>;
    const survivors = Object.keys(colors).filter(key => !MANAGED_COLOR_KEYS.includes(key));
    if (survivors.length === 0) {
      // Drop the whole block rather than leaving an empty object behind.
      text = deletePropertyAtPath(text, [COLOR_CUSTOMIZATIONS_KEY]);
    } else {
      for (const key of MANAGED_COLOR_KEYS) {
        if (key in colors) {
          text = deletePropertyAtPath(text, [COLOR_CUSTOMIZATIONS_KEY, key]);
        }
      }
    }
  }

  if (options.includeWindowColorsSettings) {
    for (const key of Object.keys(parsed)) {
      if (key.startsWith(WINDOW_COLORS_PREFIX)) {
        text = deletePropertyAtPath(text, [key]);
      }
    }
  }

  return {
    text,
    changed: text !== rawSettings,
    disposable: isDisposableDocument(text),
  };
}
