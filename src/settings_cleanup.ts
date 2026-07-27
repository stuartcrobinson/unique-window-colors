import { ColorCustomizations, extractBackgrounds, MANAGED_COLOR_KEYS } from './color_model';

export type WorkspaceSettings = Record<string, unknown>;

/**
 * Read managed backgrounds straight out of workspace settings text.
 *
 * The configuration API can report an empty `workbench.colorCustomizations`
 * during the first activation after an extension update, which would otherwise
 * look like a workspace that has no colors yet and invite regeneration. The
 * file on disk is what the user is actually looking at, so it wins.
 */
export function parseWorkspaceBackgrounds(rawSettings: string): ColorCustomizations {
  let parsed: WorkspaceSettings;
  try {
    parsed = JSON.parse(rawSettings) as WorkspaceSettings;
  } catch {
    // Comments or trailing commas are legal in settings.json but not in JSON.
    return {};
  }

  const colorCustomizations = parsed?.['workbench.colorCustomizations'];
  if (!colorCustomizations || typeof colorCustomizations !== 'object' || Array.isArray(colorCustomizations)) {
    return {};
  }
  return extractBackgrounds(colorCustomizations as ColorCustomizations);
}

/** Remove only extension-owned color keys, without mutating the input object. */
export function removeManagedColorCustomizations(settings: WorkspaceSettings): WorkspaceSettings {
  const cleaned = { ...settings };
  const colorCustomizations = cleaned['workbench.colorCustomizations'];
  if (!colorCustomizations || typeof colorCustomizations !== 'object' || Array.isArray(colorCustomizations)) {
    return cleaned;
  }

  const cleanedColors = { ...(colorCustomizations as Record<string, unknown>) };
  for (const key of MANAGED_COLOR_KEYS) {
    delete cleanedColors[key];
  }

  if (Object.keys(cleanedColors).length === 0) {
    delete cleaned['workbench.colorCustomizations'];
  } else {
    cleaned['workbench.colorCustomizations'] = cleanedColors;
  }
  return cleaned;
}
