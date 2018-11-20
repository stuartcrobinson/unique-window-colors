// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import * as Color from 'color';
import * as vscode from 'vscode';
import { ExtensionContext, workspace, WorkspaceFolder } from 'vscode';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
  let workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders);

  workspaceRoot = workspaceRoot;

  let sideBarColor: Color = Color('#' + stringToARGB(workspaceRoot));
  const theme = vscode.workspace.getConfiguration('windowColors').get<string>('theme');

  let textColor: Color = Color('#ffffff');
  let titleBarColor: Color = Color('#ffffff');

  if (theme === 'dark') {

    while (sideBarColor.luminosity() > 0.027) {
      sideBarColor = sideBarColor.darken(0.01);
    }
    while (sideBarColor.luminosity() < 0.02) {
      sideBarColor = sideBarColor.lighten(0.01);
    }
    textColor = Color(sideBarColor.hex());
    while (textColor.luminosity() < 0.95) {
      textColor = textColor.lighten(0.01);
    }
    titleBarColor = sideBarColor.lighten(0.3);
  }
  else if (theme === 'light') {

    while (sideBarColor.luminosity() < 0.55) {
      sideBarColor = sideBarColor.lighten(0.01);
    }
    while (sideBarColor.luminosity() > 0.45) {
      sideBarColor = sideBarColor.darken(0.01);
    }
    textColor = Color(sideBarColor.hex());
    while (textColor.luminosity() > 0.01) {
      textColor = textColor.darken(0.01);
    }
    titleBarColor = sideBarColor.lighten(0.1);
  }

  if (theme !== 'disable') {

    const doRevert = theme === 'revert';

    workspace
      .getConfiguration('workbench')
      .update('colorCustomizations', {
        "activityBar.background": doRevert ? undefined : sideBarColor.hex(),
        "titleBar.activeBackground": doRevert ? undefined : titleBarColor.hex(),
        "titleBar.activeForeground": doRevert ? undefined : textColor.hex(),
        //these lines are for demoing since the extension demo doesn't show the formatted title bar
        // "sideBarSectionHeader.background": titleBarColor.hex(),
        // "sideBarSectionHeader.foreground": textColor.hex()
      }, false);
  }

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
