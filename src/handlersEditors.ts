import * as vscode from 'vscode';
import { C } from './Constants';
import { Pickers } from './handlersPickers';
import { Prompts } from './handlersPrompts';

export class Editors {


  static async  backgroundEditorHandler() {

    let selection = await vscode.window.showQuickPick([C.ENTER_COLOR, C.SELECT_COLOR, C.SELECT_SAT, C.SELECT_LIGHTNESS],
      { placeHolder: 'Background Color Editor', }
    ) as string;

    if (selection === 'Enter color') {

      await Prompts.enterBackgroundColorHandler();

    } else {
      if (selection === C.SELECT_COLOR) {
        await Pickers.backgroundColorPickerHueHandler();
      }
      else if (selection === C.SELECT_SAT) {
        await Pickers.backgroundColorPickerSaturationHandler();
      }
      else if (selection === C.SELECT_LIGHTNESS) {
        await Pickers.backgroundColorPickerLightnessHandler();
      }
    }
  }

  static async  foregroundEditorHandler() {
    let selection = await vscode.window.showQuickPick([C.ENTER_COLOR, C.SELECT_COLOR, C.SELECT_SAT, C.SELECT_LIGHTNESS],
      { placeHolder: 'Foreground Color Editor', }
    ) as string;

    if (selection === C.ENTER_COLOR) {

      await Prompts.enterForegroundColorHandler();

    } else {
      if (selection === C.SELECT_COLOR) {
        await Pickers.foregroundColorPickerHueHandler();
      }
      else if (selection === C.SELECT_SAT) {
        await Pickers.foregroundColorPickerSaturationHandler();
      }
      else if (selection === C.SELECT_LIGHTNESS) {
        await Pickers.foregroundColorPickerLightnessHandler();
      }
    }
  }

}