
import * as Color from 'color';
import * as vscode from 'vscode';
import { ColorManip } from './colorManip';
import { DropdownArrays } from './colorPickerArrays';
import { C } from './Constants';
import { Tools } from './tools';
import { A, animate } from './animation';

export const parseHex = (selection: string) => '#' + selection.split('#')[1].split(' ')[0];

/**
 * 
 * @param s internalSettings object
 */
function getAdjustedForegroundBaseColor(s: any) {
  return s[C.UseCustomForegroundColor] ?
    ColorManip.adjustColor(s[C.ForegroundBaseColor], s[C.ForegroundSaturation], s[C.ForegroundLightness]) :
    Color('red');
}


export class Pickers {

  static async  backgroundColorPickerHueHandler() {

    const s = Tools.getInternalSettingsObject();
    let c = Tools.getExtensionSettings();

    const adjustedForegroundBaseColor = getAdjustedForegroundBaseColor(s);

    const options = {
      placeHolder: 'Select a color',
      onDidSelectItem: async (selection: string) => {

        if (s[C.animationDoAnimate]) {
          A.doAnimate = false;
        }
        const adjustedBackgroundBaseColor = ColorManip.adjustColor(parseHex(selection), s[C.BackgroundSaturation], s[C.BackgroundLightness]);
        await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
      }
    };


    // if (s[C.animationDoAnimate]) {
    //   A.doAnimate = false;
    // }


    let selection = await vscode.window.showQuickPick(DropdownArrays.color, options) as string;

    if (selection === undefined) {
      // const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], s[C.BackgroundSaturation], s[C.BackgroundLightness]);
      // await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);

      const cc = Tools.buildCcFromInternalSettings(s);
      await Tools.setColorCustomizations(cc);

      if (s[C.animationDoAnimate] && A.doAnimate === false) {
        await animate(s[C.animationGradientInputStr]);//Tools.setInternalSetting(C.animationDoAnimate, false);
      }
    }
    else {
      await Tools.setInternalSettings({
        [C.BaseColor]: parseHex(selection),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined,
        [C.animationDoAnimate]: false
      });
    }
  }

  static async  backgroundColorPickerSaturationHandler() {

    if (!Tools.getInternalSetting(C.BaseColor)) {
      Tools.showInformationMessage('Select a background color first via "Select background color"');
      return;
    }
    let c = Tools.getExtensionSettings();
    let s = Tools.getInternalSettingsObject();

    const adjustedForegroundBaseColor = getAdjustedForegroundBaseColor(s);

    const options = {
      placeHolder: 'Select a saturation',
      onDidSelectItem: async (selection: string) => {
        const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], parseFloat(selection), s[C.BackgroundLightness]);
        await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
      }
    };
    let selection = await vscode.window.showQuickPick(DropdownArrays.saturation, options) as string;

    if (selection === undefined) {
      const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], s[C.BackgroundSaturation], s[C.BackgroundLightness]);
      await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
    } else {
      await Tools.setInternalSetting(C.BackgroundSaturation, parseFloat(selection));
    }
  }

  static async backgroundColorPickerLightnessHandler() {
    if (!Tools.getInternalSetting(C.BaseColor)) {
      Tools.showInformationMessage('Select a background color first via "Select background color"');
      return;
    }
    let s = Tools.getInternalSettingsObject();
    let c = Tools.getExtensionSettings();

    const adjustedForegroundBaseColor = getAdjustedForegroundBaseColor(s);

    const options = {
      placeHolder: 'Select a lightness',
      onDidSelectItem: async (selection: string) => {
        const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], s[C.BackgroundSaturation], parseFloat(selection));
        await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
      }
    };
    let selection = await vscode.window.showQuickPick(DropdownArrays.lightness, options) as string;


    if (selection === undefined) {
      const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], s[C.BackgroundSaturation], s[C.BackgroundLightness]);
      await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
    } else {
      await Tools.setInternalSettings({
        [C.BackgroundLightness]: parseFloat(selection),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined
      });
    }
  }


  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ///// Foreground /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  static async  foregroundColorPickerHueHandler() {
    let s = Tools.getInternalSettingsObject();
    let c = Tools.getExtensionSettings();

    let cc = Tools.getColorCustomizations();
    const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], s[C.BackgroundSaturation], s[C.BackgroundLightness]);

    const options = {
      placeHolder: 'Select a foreground color',
      onDidSelectItem: async (selection: string) => {
        if (selection === C.auto) {
          await Tools.setSomeColors(c, false, adjustedBackgroundBaseColor, Color('red'));
        }
        else {
          const adjustedForegroundBaseColor = ColorManip.adjustColor(parseHex(selection), s[C.ForegroundSaturation], s[C.ForegroundLightness]);
          await Tools.setForegroundColors(cc, c, adjustedForegroundBaseColor);
        }
      }
    };
    let selection = await vscode.window.showQuickPick([C.auto, ...DropdownArrays.color], options) as string;

    if (selection === undefined) {
      const adjustedForegroundBaseColor = ColorManip.adjustColor(s[C.ForegroundBaseColor], s[C.ForegroundSaturation], s[C.ForegroundLightness]);
      await Tools.setSomeColors(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
    }
    else if (selection === C.auto) {
      await Tools.setInternalSetting(C.UseCustomForegroundColor, false);
    }
    else {
      await Tools.setInternalSettings({
        [C.UseCustomForegroundColor]: true,
        [C.ForegroundBaseColor]: parseHex(selection),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined
      });
    }
  }


  static async  foregroundColorPickerSaturationHandler() {
    if (!handleMissingForegroundColor()) {
      return;
    }
    let cc = Tools.getColorCustomizations();
    let s = Tools.getInternalSettingsObject();
    let c = Tools.getExtensionSettings();

    const options = {
      placeHolder: 'Select a foreground saturation',
      onDidSelectItem: async (selection: string) => {
        const adjustedForegroundBaseColor = ColorManip.adjustColor(s[C.ForegroundBaseColor], parseFloat(selection), s[C.ForegroundLightness]);
        await Tools.setForegroundColors(cc, c, adjustedForegroundBaseColor);
      }
    };
    let selection = await vscode.window.showQuickPick(DropdownArrays.saturation, options) as string;

    if (selection === undefined) {
      const adjustedForegroundBaseColor = ColorManip.adjustColor(s[C.ForegroundBaseColor], s[C.ForegroundSaturation], s[C.ForegroundLightness]);
      await Tools.setForegroundColors(cc, c, adjustedForegroundBaseColor);
    } else {
      await Tools.setInternalSettings({
        [C.ForegroundSaturation]: parseFloat(selection),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined
      });
    }
  }

  static async foregroundColorPickerLightnessHandler() {
    if (!handleMissingForegroundColor()) {
      return;
    }
    let cc = Tools.getColorCustomizations();
    let s = Tools.getInternalSettingsObject();
    let c = Tools.getExtensionSettings();

    const options = {
      placeHolder: 'Select a lightness',
      onDidSelectItem: async (selection: string) => {
        const adjustedForegroundBaseColor = ColorManip.adjustColor(s[C.ForegroundBaseColor], s[C.ForegroundSaturation], parseFloat(selection));
        await Tools.setForegroundColors(cc, c, adjustedForegroundBaseColor);
      }
    };
    let selection = await vscode.window.showQuickPick(DropdownArrays.lightness, options) as string;

    if (selection === undefined) {
      const adjustedForegroundBaseColor = ColorManip.adjustColor(s[C.ForegroundBaseColor], s[C.ForegroundSaturation], s[C.ForegroundLightness]);
      await Tools.setForegroundColors(cc, c, adjustedForegroundBaseColor);
    } else {
      await Tools.setInternalSettings({
        [C.ForegroundLightness]: parseFloat(selection),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined
      });
    }
  }
}

async function handleMissingForegroundColor(): Promise<boolean> {

  if (!Tools.getInternalSetting(C.ForegroundBaseColor)) {
    const activityBar_foreground = Tools.getColorCustomizations()[C.activityBar_foreground];
    if (activityBar_foreground) {
      await Tools.setInternalSetting(C.ForegroundBaseColor, activityBar_foreground);
      return true;
    }
    else {
      Tools.showInformationMessage('Select a foreground color first via "Select foreground color"');
      return false;
    }
  }
  return true;
}
