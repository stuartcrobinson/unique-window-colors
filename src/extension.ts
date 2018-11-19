// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { window, workspace, ThemeColor, WorkspaceFolder, ExtensionContext } from 'vscode';

import * as vscode from 'vscode';

import * as Color from 'color';

// var Color = require('color');

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
  let workspaceRoot: string = getWorkspaceFolder(workspace.workspaceFolders);

  workspaceRoot = workspaceRoot;

  let sideBarColor: Color = Color('#' + stringToARGB(workspaceRoot));

  // color.red()
  console.log(`color.red():    ${sideBarColor.red()}`);

  //make it less red
  sideBarColor = sideBarColor.red(Math.max(sideBarColor.red(), 0));

  // sideBarColor = sideBarColor.desaturate(0.5);

  console.log(sideBarColor.luminosity());
  const theme = vscode.workspace.getConfiguration('uniqueWindowColors').get<string>('theme');

  let textColor: Color = Color('#ffffff');
  let titleBarColor: Color = Color('#ffffff');

  if (theme === 'dark') {

    while (sideBarColor.luminosity() > 0.027) {
      sideBarColor = sideBarColor.darken(0.01);
      // console.log(sideBarColor.luminosity());
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
      // console.log(sideBarColor.luminosity());
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

  console.log(`sidebar:       ${sideBarColor.luminosity()}`);
  console.log(`titleBarColor: ${titleBarColor.luminosity()}`);
  console.log(`textColor:     ${textColor.luminosity()}`);
  console.log(`theme:         ${theme}`);

  if (theme !== 'disable') {

    const doRevert = theme === 'revert';

    workspace
      .getConfiguration('workbench')
      .update('colorCustomizations', {
        "activityBar.background": doRevert ? undefined : sideBarColor.hex(),
        "titleBar.activeBackground": doRevert ? undefined : titleBarColor.hex(),
        "titleBar.activeForeground": doRevert ? undefined : textColor.hex(),
        // "sideBarSectionHeader.background": titleBarColor.hex(),
        // "sideBarSectionHeader.foreground": textColor.hex()
      }, false);
  }

}

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

// https://github.com/zenozeng/color-hash
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

function stringToARGB(str: string) {
  return intToARGB(hashCode(str));
}

/**
 * https://css-tricks.com/snippets/javascript/lighten-darken-color/
 * sucks - 
 * @param col 
 * @param amt 
 */
function LightenDarkenColor(col: string, amt: number) {

  var usePound = false;

  if (col[0] == "#") {
    col = col.slice(1);
    usePound = true;
  }

  var num = parseInt(col, 16);

  var r = (num >> 16) + amt;

  if (r > 255) r = 255;
  else if (r < 0) r = 0;

  var b = ((num >> 8) & 0x00FF) + amt;

  if (b > 255) b = 255;
  else if (b < 0) b = 0;

  var g = (num & 0x0000FF) + amt;

  if (g > 255) g = 255;
  else if (g < 0) g = 0;

  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16);

}

// https://www.sitepoint.com/javascript-generate-lighter-darker-color/
/**
 * doesn't work
 * @param hex 
 * @param lum 
 */
function ColorLuminance(hex: string, lum: number) {

  // validate hex string
  hex = String(hex).replace(/[^0-9a-f]/gi, '');
  if (hex.length < 6) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  lum = lum || 0;

  // convert to decimal and change luminosity
  var rgb = "#", c, i;
  for (i = 0; i < 3; i++) {
    c = parseInt(hex.substr(i * 2, 2), 16);
    c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
    rgb += ("00" + c).substr(c.length);
  }

  return rgb;
}

//  const initCol = workspace.getConfiguration('workbench').get('colorCustomizations');
// https://github.com/zenozeng/color-hash
// https://www.designedbyaturtle.co.uk/demos/hex-colour/
// https://github.com/jfsiii/chromath
// pick contrasting color:
// https://trendct.org/2016/01/22/how-to-choose-a-label-color-to-contrast-with-background/