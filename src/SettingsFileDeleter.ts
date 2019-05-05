import { Tools } from './tools';

export class SettingsFileDeleter {
  /** 
   * Deletes .vscode/settings.json if colors all the settings are WC stuff or colorCustomizations or theme
   * 
   * Deletes .vscode if no other files exist.
   */
  public dispose() {

    const doDeleteLocalSettingsOnClose = true; //Tools.getSetting(C.DeleteLocalSettingsOnClose)

    if (doDeleteLocalSettingsOnClose) {
      Tools.deleteSettingsFileAndParentIfEmpty(Tools.getWorkspaceRoot());
    }
  } 
}
