import * as vscode from 'vscode';
import { C } from './Constants';
import { Tools } from './tools';
import { Errors as Errors } from './messages';
import { animate } from './animation';


////////////////////////////////////////////////////////////////////////////////////////////////////////////
////  Library  /////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class Library {

  /** portfolio must exist.
   * 
   * "Colors" in this context is everything in internalSettings. including theme.  
   * 
   * NOT including ModifyBar flags.
   * 
   * include animation parameters - steps per transition and ms per step
   * 
   */
  static async saveColors(portfolioName: string, colorationName: string) {

    let c = Tools.getExtensionSettings();

    await Library.saveInputColors(
      portfolioName,
      colorationName,
      c[C.internalSettings]
    );
  }


  static async saveInputColors(portfolioName: string, colorationName: string, internalSettings: any) {

    const myGlobalData = Tools.getSetting(C.myGlobalData);

    if (!myGlobalData[C.portfolios] || !myGlobalData[C.portfolios][portfolioName]) {
      vscode.window.showErrorMessage(`Portfolio "${portfolioName}" not found.`);
      return;
    }

    if (myGlobalData[C.portfolios][portfolioName][colorationName]) {
      vscode.window.showErrorMessage(`Colors "${colorationName}" in portfolio "${portfolioName}" already exists.`);
      return;
    }

    let updatedIntSettings = { ...internalSettings };

    myGlobalData[C.portfolios][portfolioName][colorationName] = updatedIntSettings;

    await Tools.setGlobalSetting(C.myGlobalData, myGlobalData);
  }

  static async loadColoration(portfolioName: string, colorationName: string, wasSetAutomatically?: boolean) {
    const myGlobalData = Tools.getSetting(C.myGlobalData);

    if (!myGlobalData[C.portfolios]
      || !myGlobalData[C.portfolios][portfolioName]
      || !myGlobalData[C.portfolios][portfolioName][colorationName]) {

      Errors.colorationNotFound(portfolioName, colorationName);
      return;
    }

    let internalSettings = myGlobalData[C.portfolios][portfolioName][colorationName];

    internalSettings = Tools.deblack(internalSettings);

    internalSettings[C.portfolioAndColor] = { [C.portfolio]: portfolioName, [C.coloration]: colorationName };

    if (wasSetAutomatically) {
      internalSettings[C.useAutomatic] = true;
    }

    await Tools.setSetting(C.internalSettings, internalSettings);

    if (internalSettings[C.animationDoAnimate]) {
      await animate(internalSettings[C.animationGradientInputStr] as string);
    }
    
  }


  /** use this while scrolling.  demo custom theme bits too. */
  static async demoColoration(portfolioName: string, colorationName: string, wasSetAutomatically: boolean, myGlobalData: any) {

    //how to demo custom theme bits ... ?

    if (!myGlobalData[C.portfolios]
      || !myGlobalData[C.portfolios][portfolioName]
      || !myGlobalData[C.portfolios][portfolioName][colorationName]) {

      Errors.colorationNotFound(portfolioName, colorationName);
      return;
    }

    let internalSettings = myGlobalData[C.portfolios][portfolioName][colorationName];

    internalSettings = Tools.deblack(internalSettings);

    internalSettings[C.portfolioAndColor] = { [C.portfolio]: portfolioName, [C.coloration]: colorationName };

    if (wasSetAutomatically) {
      internalSettings[C.useAutomatic] = true;
    }

    //don't demo animations
    if (internalSettings[C.animationDoAnimate]) {
      return;
    }

    let cc = Tools.buildCcFromInternalSettings(internalSettings);

    cc = Tools.addCustomThemeColors(internalSettings, cc);

    await Tools.setColorCustomizations(cc);
  }

  static async deleteColors(portfolioName: string, colorationName: string) {

    const myGlobalData = Tools.getSetting(C.myGlobalData);

    if (!myGlobalData[C.portfolios]
      || !myGlobalData[C.portfolios][portfolioName]
      || !myGlobalData[C.portfolios][portfolioName][colorationName]) {

      vscode.window.showErrorMessage(`Colors "${colorationName} in portfolio "${portfolioName}" not found.`);
      return;
    }

    delete myGlobalData[C.portfolios][portfolioName][colorationName];
    await Tools.setGlobalSetting(C.myGlobalData, myGlobalData);
  }

  static async createNewPortfolio(portfolioName: string) {
    const myGlobalData = Tools.getSetting(C.myGlobalData);

    if (!myGlobalData[C.portfolios]) {
      myGlobalData[C.portfolios] = {};
    }

    if (myGlobalData[C.portfolios][portfolioName]) {
      vscode.window.showErrorMessage(`Portfolio "${portfolioName}" already exists.`);
      return;
    }

    myGlobalData[C.portfolios][portfolioName] = {};

    await Tools.setGlobalSetting(C.myGlobalData, myGlobalData);
  }

  static async deletePortfolio(portfolioName: string) {
    const myGlobalData = Tools.getSetting(C.myGlobalData);

    if (!myGlobalData[C.portfolios] || !myGlobalData[C.portfolios][portfolioName]) {
      vscode.window.showErrorMessage(`Portfolio "${portfolioName}" not found.`);
      return;
    }

    delete myGlobalData[C.portfolios][portfolioName];
    await Tools.setGlobalSetting(C.myGlobalData, myGlobalData);
  }

  static getPortfoliosNames(): string[] {
    const myGlobalData = Tools.getSetting(C.myGlobalData);
    return myGlobalData[C.portfolios] ? Object.keys(myGlobalData[C.portfolios]) || [] : [];
  }

  static getColorationNamesInPortfolio(portfolioName: string): string[] {
    const myGlobalData = Tools.getSetting(C.myGlobalData);

    if (!myGlobalData[C.portfolios] || !myGlobalData[C.portfolios][portfolioName]) {
      vscode.window.showErrorMessage(`Portfolio "${portfolioName}" not found.`);
      return [];
    }
    return Object.keys(myGlobalData[C.portfolios][portfolioName]) || [];
  }

  /** do NOT save theme here.  preset portfolios should not include theme either in the internalSettings object.
   * 
   * DO NOT save animation stuff.
   * 
   * use automatic font colors here
   * 
   * so, code (when loading) needs to check if internalSettings has theme key.  if so, use.  if not, use default
   */
  static async generateColorationsInPortfolio(colorsStr: string, portfolioName: string) {

    const colors = colorsStr.split(' ');

    const existingColorationNames = Library.getColorationNamesInPortfolio(portfolioName);

    for (let i = 0; i < colors.length; i++) {
      const basecolor = colors[i];
      if (!Tools.isValidColor(basecolor)) {
        vscode.window.showErrorMessage(`Aborting colors generation: "${basecolor}" is not a valid color.`);
        return;
      }
      if (basecolor in existingColorationNames) {
        vscode.window.showErrorMessage(`Aborting colors generation: "${basecolor}" is already in portfolio "${portfolioName}".`);
        return;
      }
    }

    for (let i = 0; i < colors.length; i++) {
      const basecolor = colors[i];

      await Library.saveInputColors(portfolioName, basecolor, { [C.BaseColor]: basecolor });
    }
  }
}