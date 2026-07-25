import { MANAGED_COLOR_KEYS } from './color_model';

export type WorkspaceSettings = Record<string, unknown>;

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
