import * as Color from 'color';
import * as vscode from 'vscode';
import { C } from './Constants';
import { Tools } from './tools';


export class Prompts {


  static async  enterBackgroundColorHandler() {

    const options: vscode.InputBoxOptions = {
      placeHolder: 'hex code or html name (eg "#abcd00" or "whitesmoke")',
      prompt:
        'Enter a background color',
      value: ''
    };
    const inputColor = await vscode.window.showInputBox(options) as string;
    if (inputColor === undefined){
      return;
    }

    if (!Tools.isValidColor(inputColor)) {
      vscode.window.showErrorMessage(`${inputColor}" is not a valid color.`);
    } else {
      await Tools.setInternalSettings({
        [C.BackgroundLightness]: C.defaultLightness,
        [C.BackgroundSaturation]: C.defaultSaturation,
        [C.BaseColor]: Color(inputColor).hex(),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined,
        [C.animationDoAnimate]: false
      });

    }
  }


  static async  enterForegroundColorHandler() {
    const options: vscode.InputBoxOptions = {
      placeHolder: 'hex code or html name (eg "#abcd00" or "whitesmoke")',
      prompt:
        'Enter a foreground (text etc) color',
      value: ''
    };
    const inputColor = await vscode.window.showInputBox(options) as string;
    if (inputColor === undefined){
      return;
    }

    if (!Tools.isValidColor(inputColor)) {
      vscode.window.showErrorMessage(`${inputColor}" is not a valid color.`);
    } else {
      await Tools.setInternalSettings({
        [C.UseCustomForegroundColor]: true,
        [C.ForegroundLightness]: C.defaultLightness,
        [C.ForegroundSaturation]: C.defaultSaturation,
        [C.ForegroundBaseColor]: Color(inputColor).hex(),
        [C.portfolioAndColor]: undefined,
        [C.useAutomatic]: undefined
      });
    }
  }
}