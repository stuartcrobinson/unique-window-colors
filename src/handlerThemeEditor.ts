import * as Color from 'color';
import * as vscode from 'vscode';
import { ColorManip } from './colorManip';
import { DropdownArrays } from './colorPickerArrays';
import { C } from './Constants';
import { parseHex } from './handlersPickers';
import { Tools } from './tools';
import { Errors } from './messages';


async function setColorFromPrompt(themeItem: string) {

  let inputColor = await vscode.window.showInputBox({
    placeHolder: 'hex code or html name (eg "#abcd00" or "whitesmoke")',
    prompt: `Enter a color for ${themeItem}`
  }) as string;
  if (inputColor === undefined) {
    return;
  }
  inputColor = Tools.trim(inputColor);
  if (!Tools.isValidColor(inputColor)) {
    vscode.window.showErrorMessage(`"${inputColor}" is not a valid color.`);
    Errors.invalidColor(inputColor);
    return;
  }

  const hex = Color(inputColor).hex();

  await Tools.setCustomThemeItem(
    themeItem,
    { [C.customThemeBaseColor]: hex, [C.customThemeSaturation]: C.defaultSaturation, [C.customThemeLightness]: C.defaultLightness }
  );

}


async function selectColor(themeItem: string, basecolor: string, saturation: number, lightness: number, cc: any, ccDefault: any, ccInit: any) {

  const options = {
    placeHolder: 'Select a color for ' + themeItem,
    onDidSelectItem: async (item: string) => {
      if (item === C.default) {
        await Tools.setColorCustomizations(ccDefault);
      }
      else {
        await Tools.setColorCustomizations(
          { ...cc, [themeItem]: ColorManip.adjustColor(parseHex(item), saturation, lightness).hex() }
        );
      }
    }
  };
  let selection = await vscode.window.showQuickPick([C.default, ...DropdownArrays.color], options) as string;

  if (selection === undefined) {
    await Tools.setColorCustomizations(ccInit);
  }
  if (selection === C.default) {
    await Tools.removeCustomThemeItem(themeItem);
  }
  else {
    await Tools.setCustomThemeItem(
      themeItem,
      { [C.customThemeBaseColor]: parseHex(selection), [C.customThemeSaturation]: saturation, [C.customThemeLightness]: lightness }
    );
  }

}


async function selectSaturation(themeItem: string, basecolor: string, saturation: number, lightness: number, cc: any, ccInit: any) {
  if (basecolor === undefined) {
    Errors.customEditorUndefinedBasecolor(themeItem);
    return;
  }

  const options = {
    placeHolder: 'Select saturation level for ' + themeItem,
    onDidSelectItem: async (selection: string) => {
      await Tools.setColorCustomizations(
        { ...cc, [themeItem]: ColorManip.adjustColor(basecolor, parseFloat(selection), lightness).hex() }
      );
    }
  };
  let selection = await vscode.window.showQuickPick(DropdownArrays.saturation, options) as string;
  if (selection === undefined) {
    await Tools.setColorCustomizations(ccInit);
    return;
  }
  await Tools.setCustomThemeItem(
    themeItem, { [C.customThemeBaseColor]: basecolor, [C.customThemeSaturation]: parseFloat(selection), [C.customThemeLightness]: lightness }
  );
}

async function selectLightness(themeItem: string, basecolor: string, saturation: number, lightness: number, cc: any, ccInit: any) {
  if (basecolor === undefined) {
    Errors.customEditorUndefinedBasecolor(themeItem);
    return;
  }

  const options = {
    placeHolder: 'Select lightness level for ' + themeItem,
    onDidSelectItem: async (selection: string) => {
      await Tools.setColorCustomizations(
        { ...cc, [themeItem]: ColorManip.adjustColor(basecolor, saturation, parseFloat(selection)).hex() }
      );
    }
  };
  let selection = await vscode.window.showQuickPick(DropdownArrays.lightness, options) as string;
  if (selection === undefined) {
    await Tools.setColorCustomizations(ccInit);
    return;
  }

  await Tools.setCustomThemeItem(
    themeItem, { [C.customThemeBaseColor]: basecolor, [C.customThemeSaturation]: saturation, [C.customThemeLightness]: parseFloat(selection) }
  );
}

export async function themeEditorHandler() {

  let ccInit = Tools.getColorCustomizations();

  let s = Tools.getInternalSettingsObject();
  let ccDefault = s[C.BaseColor] ? Tools.buildNonCustomCc(s) : {};
  const highlightColor = getHighlightColor();

  const options = {
    placeHolder: 'Select a theme item to color',
    onDidSelectItem: async (themeItem: string) => {
      await Tools.setColorCustomizations({ ...ccInit, [themeItem]: highlightColor });
    }
  };

  let themeItem = await vscode.window.showQuickPick([C.REMOVE_ALL_CUST_THEME_MODS, ...DropdownArrays.themeItems], options) as string;
  if (themeItem === undefined) {
    await Tools.setColorCustomizations(ccInit);
    return;
  }
  if (themeItem === C.REMOVE_ALL_CUST_THEME_MODS) {
    await Tools.setInternalSetting(C.customThemeMap, {});
    return;
  }


  let selection = await vscode.window.showQuickPick([C.ENTER_COLOR, C.SELECT_COLOR, C.SELECT_SAT, C.SELECT_LIGHTNESS, C.REMOVE_COLOR],
    {
      placeHolder: themeItem + ' color editor',
      onDidSelectItem: async (selection: string) => {
        if (selection === C.REMOVE_COLOR) {
          await Tools.setColorCustomizations(ccDefault); //remove the highlighting
        }
        else {
          await Tools.setColorCustomizations({ ...ccInit, [themeItem]: highlightColor });
        }
      }
    }
  ) as string;
  if (selection === undefined) {
    await Tools.setColorCustomizations(ccInit); //remove the highlighting
    return;
  }
  await Tools.setColorCustomizations(ccInit); //remove the highlighting


  if (selection === C.ENTER_COLOR) {
    await setColorFromPrompt(themeItem);
  } else {

    let customThemeMap = Tools.getInternalSetting(C.customThemeMap);

    let lightness = Tools.getCustomThemeItemLightnessFromMap(customThemeMap, themeItem);
    let saturation = Tools.getCustomThemeItemSaturationFromMap(customThemeMap, themeItem);
    let basecolor = themeItem in customThemeMap && C.customThemeBaseColor in customThemeMap[themeItem] ?
      customThemeMap[themeItem][C.customThemeBaseColor] :
      undefined;

    const cc = Tools.getColorCustomizations();

    switch (selection) {
      case C.SELECT_COLOR:
        await selectColor(themeItem, basecolor, saturation, lightness, cc, ccDefault, ccInit);
        break;
      case C.SELECT_SAT:
        await selectSaturation(themeItem, basecolor, saturation, lightness, cc, ccInit);
        break;
      case C.SELECT_LIGHTNESS:
        await selectLightness(themeItem, basecolor, saturation, lightness, cc, ccInit);
        break;
      case C.REMOVE_COLOR:
        await Tools.removeCustomThemeItem(themeItem);
        break;
    }
  }

  function getHighlightColor() {
    let highlightColor = '#ff0000';
    if (Tools.getTheme().toLowerCase().includes('red')) {
      highlightColor = '#00ff00';
    }
    return highlightColor;
  }
}
