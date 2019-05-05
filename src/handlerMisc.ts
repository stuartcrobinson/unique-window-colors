import * as vscode from 'vscode';
import { DropdownArrays } from './colorPickerArrays';
import { C } from './Constants';
import { Tools } from './tools';
import { Editors } from './handlersEditors';
import { themeEditorHandler } from './handlerThemeEditor';
import { Errors } from './messages';

export async function setThemeHandler() {

  let initTheme = Tools.getTheme();

  const options = {
    placeHolder: 'Select a theme',
    onDidSelectItem: async (selection: string) => {
      await Tools.setTheme(selection);
    }
  };
  let selection = await vscode.window.showQuickPick(DropdownArrays.themes, options) as string;

  if (selection === undefined) {
    await Tools.setTheme(initTheme);
  } else {
    await Tools.setInternalSetting(C.theme, selection);
  }

  //otherwise it crashes quietly sometimes, like alternating between resetting and changing theme (stuff that interacts w/ the disk)
  await vscode.window.showInformationMessage('Please reload the window now (Command Palette → "Reload Window")');
}


/** TODO - replace this with: clear colors for all workspaces vs just this one. */
export async function resetHandler() {

  try {
    const REMOVE_COLORS_FOR_THIS_WORKSPACE = "Remove colors for this workspace.";
    const REMOVE_COLORS_FOR_ALL_WORKSPACES = "Remove colors for ALL WORKSPACES.";
    const REMOVE_ALL_EXTENSION_DATA = "Remove ALL WINDOW COLORS DATA.";

    let selection = await vscode.window.showQuickPick([REMOVE_COLORS_FOR_THIS_WORKSPACE, REMOVE_COLORS_FOR_ALL_WORKSPACES, REMOVE_ALL_EXTENSION_DATA],
      { placeHolder: 'Reload the window if this crashes the command palette.  ⌘+R (Mac) or Ctrl+R (Win)', }
    ) as string;

    switch (selection) {
      case REMOVE_COLORS_FOR_THIS_WORKSPACE:
        await Tools.clearWorkspaceSettings();
        await Tools.clearExternalWorkspaceSettings(Tools.getWorkspaceRoot());
        Tools.deleteExternalWorkspaceSettingsMaybe(Tools.getWorkspaceRoot());
        Errors.pleaseReload();
        break;
      case REMOVE_COLORS_FOR_ALL_WORKSPACES:
        await Tools.clearWorkspaceSettings();
        Tools.clearAllWorkspacesLocalSettings();
        await Tools.removeAllWorkspacesFromGlobalData();
        await Tools.clearExternalWorkspaceSettings(Tools.getWorkspaceRoot()); //ensure local .vscode/settings deleted
        Tools.deleteExternalWorkspaceSettingsMaybe(Tools.getWorkspaceRoot());
        Errors.pleaseReload();
        break;
      case REMOVE_ALL_EXTENSION_DATA:
        await Tools.clearWorkspaceSettings();
        Tools.clearAllWorkspacesLocalSettings();
        await Tools.deleteWorkspaceGlobalSettingsValue();
        // Tools.deleteLocalSettingsFileIfSafeToDo();
        await Tools.clearExtensionSettings();
        await Tools.clearExternalWorkspaceSettings(Tools.getWorkspaceRoot()); //ensure local .vscode/settings deleted
        Tools.deleteExternalWorkspaceSettingsMaybe(Tools.getWorkspaceRoot());
        Errors.pleaseReload();
        Tools.deleteAllWorkspacesLocalSettingsMaybe();
        break;
    }
  } catch (err) {
    console.log('caught an exception: resetHandler', err);
  }
}


export async function setColorsHandler() {
  const BASE_COLOR = "Base Color";
  const FONT_COLOR = "Font Color";
  const CUSTOM_COLOR = "Custom Element Color";

  const selection = await vscode.window.showQuickPick(
    [BASE_COLOR, FONT_COLOR, CUSTOM_COLOR],
    { placeHolder: 'Select the color to set:' }
  );

  switch (selection) {
    case BASE_COLOR:
      await Editors.backgroundEditorHandler();
      break;
    case FONT_COLOR:
      await Editors.foregroundEditorHandler();
      break;
    case CUSTOM_COLOR:
      await themeEditorHandler();
      break;
  }
}
