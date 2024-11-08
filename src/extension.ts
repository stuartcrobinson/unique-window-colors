import * as Color from 'color';
import * as fs from 'fs';
import { ExtensionContext, workspace, WorkspaceFolder } from 'vscode';

interface ColorsInterface {
  sideBarColor_dark: Color;
  titleBarTextColor_dark: Color;
  titleBarColor_dark: Color;
  sideBarColor_light: Color;
  titleBarTextColor_light: Color;
  titleBarColor_light: Color;
}

export class SettingsFileDeleter {
  constructor(
    private workspaceRoot: string,
    private colors: ColorsInterface) { }

  /** 
   * Deletes .vscode/settings.json if colors all match either the default light or dark Windows Colors and if no other settings exist.
   * 
   * Deletes .vscode if no other files exist.
   */
  public dispose() {

    const settingsfile = this.workspaceRoot + '/.vscode/settings.json';
    const vscodeSettingsDir = this.workspaceRoot + '/.vscode';
    const settingsFileJson = JSON.parse((fs.readFileSync(settingsfile, "utf8")));
    const cc = JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations')));

    const deleteSettingsFileUponExit = JSON.parse(JSON.stringify(workspace.getConfiguration('windowColors').get<string>('🌈 DeleteSettingsFileUponExit')));

    if (deleteSettingsFileUponExit) {
      fs.unlinkSync(settingsfile);
      fs.rmdirSync(vscodeSettingsDir);  //only deletes empty folders
    }
    else if (Object.keys(settingsFileJson).length === 1 && Object.keys(cc).length === 3) {

      const aColorWasModified =
        (cc['activityBar.background'] !== this.colors.sideBarColor_dark.hex() && cc['activityBar.background'] !== this.colors.sideBarColor_light.hex()) ||
        (cc['titleBar.activeBackground'] !== this.colors.titleBarColor_dark.hex() && cc['titleBar.activeBackground'] !== this.colors.titleBarColor_light.hex()) ||
        (cc['titleBar.activeForeground'] !== this.colors.titleBarTextColor_dark.hex() && cc['titleBar.activeForeground'] !== this.colors.titleBarTextColor_light.hex()) ||
        (cc['statusBar.background'] !== this.colors.titleBarColor_dark.hex() && cc['statusBar.background'] !== this.colors.titleBarColor_light.hex()) ||
        (cc['statusBar.foreground'] !== this.colors.titleBarTextColor_dark.hex() && cc['statusBar.foreground'] !== this.colors.titleBarTextColor_light.hex());

      if (!aColorWasModified) {
        fs.unlinkSync(settingsfile);
        fs.rmdirSync(vscodeSettingsDir);  //only deletes empty folders
      }
    }
  }
}

export function activate(context: ExtensionContext) {

  // https://code.visualstudio.com/api/references/vscode-api
  // const config = workspace.getConfiguration('launch', vscode.window.activeTextEditor.document.uri);
  // console.log("JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations'), null, 4)");
  // console.log(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations'), null, 4));

  if (!workspace.workspaceFolders) {
    return;
  }

  let workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders);

  const extensionTheme = workspace.getConfiguration('windowColors').get<string>('🌈 Theme');
  let baseColor = workspace.getConfiguration('windowColors').get<string>('🌈 BaseColor');
  if (baseColor) {
    baseColor = baseColor.toLowerCase().trim();
  }

  /** retain initial unrelated colorCustomizations*/
  const cc = JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations')));

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

    sideBarColor = Color(baseColor);
    titleBarColor = sideBarColor.lighten(0.3);

    if (titleBarColor.luminosity() > 0.5) { //a light color https://www.npmjs.com/package/color#luminosity
      titleBarTextColor = getColorWithLuminosity(sideBarColor, 0, 0.01);
    }
    else {
      titleBarTextColor = getColorWithLuminosity(sideBarColor, 0.95, 1);
    }
  }

  const doRemoveColors = extensionTheme === 'remove';

  let doUpdateColors = true;

  if (cc && (cc['activityBar.background'] || cc['titleBar.activeBackground'] || cc['titleBar.activeForeground'] || cc['statusBar.foreground'] || cc['statusBar.foreground'])) {
    //don't overwrite
    doUpdateColors = false;
  }

  if (baseColor) {
    doUpdateColors = true;
  }

  if (doUpdateColors || doRemoveColors) {

    const newColors = {
      "activityBar.background": doRemoveColors ? undefined : sideBarColor.hex(),
      "titleBar.activeBackground": doRemoveColors ? undefined : titleBarColor.hex(),
      "titleBar.activeForeground": doRemoveColors ? undefined : titleBarTextColor.hex(),
      "statusBar.background": doRemoveColors ? undefined : titleBarColor.hex(),
      "statusBar.foreground": doRemoveColors ? undefined : titleBarTextColor.hex(),
      //these lines are for development since the extension demo doesn't show the formatted title bar
      // "sideBarSectionHeader.background": titleBarColor.hex(),
      // "sideBarSectionHeader.foreground": titleBarTextColor.hex()
    };
    workspace.getConfiguration('workbench').update('colorCustomizations', { ...cc, ...newColors }, false);
  }

  const settingsFileDeleter =
    new SettingsFileDeleter(
      workspaceRoot,
      { sideBarColor_dark, titleBarTextColor_dark, titleBarColor_dark, sideBarColor_light, titleBarTextColor_light, titleBarColor_light });

  context.subscriptions.push(settingsFileDeleter);

  // for testing
  // setTimeout(() => {
  //   console.log("JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations'), null, 4)");
  //   console.log(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations'), null, 4));
  // }, 2000);

  // console.log("JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations'), null, 4)");
  // console.log(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations'), null, 4));
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
export const getWorkspaceFolder = (folders: WorkspaceFolder[] |
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
