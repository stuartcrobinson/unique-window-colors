import * as vscode from 'vscode';
import { C } from './Constants';
import { Errors } from './messages';
import { Library } from './library';
import { Tools } from './tools';
import { animate, A } from './animation';

/*
Library 
- load colors
- save colors
- delete colors 
- new portfolio
- delete portfolio
- add base colors to portfolio (accept list of colors)
--- portfolio dropdown 
--- colors input 
*/


/**  show portfolios dropdown then colors dropdown */
async function loadColors() {

  const isInit = Tools.getSetting(C.internalSettings);

  const portfolioNames = await Library.getPortfoliosNames();

  if (portfolioNames.length === 0) {
    Errors.noPortfoliosFound();
  }

  const portfolioName = await vscode.window.showQuickPick(portfolioNames, { placeHolder: 'Select portfolio' }) as string;
  if (portfolioName === undefined) {
    return;
  }

  const myGlobalData = Tools.getSetting(C.myGlobalData);

  let colorationNames = await Library.getColorationNamesInPortfolio(portfolioName);

  for (let i = 0; i < colorationNames.length; i++) {
    if (myGlobalData[C.portfolios][portfolioName][colorationNames[i]][C.animationDoAnimate]) {
      colorationNames[i] += '  ' + C.projectorEmoji;
    }
  }

  const options = {
    placeHolder: 'Select a coloration',
    onDidSelectItem: async (coloration: string) => {

      if (isInit[C.animationDoAnimate]) {
        A.doAnimate = false;
      }
      coloration = coloration.replace(C.projectorEmoji, '').trim();
      await Library.demoColoration(portfolioName, coloration, true, myGlobalData);
    }
  };


  let coloration = await vscode.window.showQuickPick(colorationNames, options) as string;

  if (coloration === undefined) {
    const cc = Tools.buildCcFromInternalSettings(isInit);
    await Tools.setColorCustomizations(cc);
    if (isInit[C.animationDoAnimate] && A.doAnimate === false) {
      await animate(isInit[C.animationGradientInputStr]);//Tools.setInternalSetting(C.animationDoAnimate, false);
    }
  }
  else {
    coloration = coloration.replace(C.projectorEmoji, '').trim();

    await Library.loadColoration(portfolioName, coloration);
  }
}

/**  show portfolios dropdown then new colors input box */
async function saveColoration() {

  //TODO - show message if there are no portfolios colors to load

  const portfolioName = await vscode.window.showQuickPick(await Library.getPortfoliosNames(), { placeHolder: 'Select portfolio' }) as string;
  if (portfolioName === undefined) {
    return;
  }

  const options: vscode.InputBoxOptions = {
    placeHolder: 'Save Coloration',
    prompt: 'Enter new coloration name.'
  };
  const colorationName = await vscode.window.showInputBox(options) as string;
  if (colorationName === undefined) {
    return;
  }

  await Library.saveColors(portfolioName, colorationName);
}


/**  show portfolios dropdown then colors dropdown */
async function deleteColors() {

  //TODO - show message if there are no portfolios colors to load


  const currInternalSettings = Tools.getInternalSettingsObject();

  const portfolioName = await vscode.window.showQuickPick(await Library.getPortfoliosNames(), { placeHolder: 'Select portfolio' }) as string;
  if (portfolioName === undefined) {
    return;
  }

  const options = {
    placeHolder: 'Select a coloration',
    onDidSelectItem: async (coloration: string) => {
      Library.loadColoration(portfolioName, coloration);
    }
  };
  const colorationName = await vscode.window.showQuickPick(await Library.getColorationNamesInPortfolio(portfolioName), options) as string;

  if (colorationName !== undefined) {
    await Library.deleteColors(portfolioName, colorationName);
  }

  await Tools.setSetting(C.internalSettings, currInternalSettings);
}


/** // single input box */
async function newPortfolio() {

  const options: vscode.InputBoxOptions = {
    placeHolder: 'New Portfolio',
    prompt: 'Enter new portfolio name.'
  };
  const portfolioName = await vscode.window.showInputBox(options) as string;
  if (portfolioName === undefined) {
    return;
  }
  if (portfolioName.toLocaleLowerCase().includes(C.Automatic.toLowerCase())) {
    vscode.window.showErrorMessage("Portfolio names can't contain the reserved word 'automatic'.");
    return;
  }
  await Library.createNewPortfolio(portfolioName);
}

/**  show portfolios dropdown then new colors input box */
async function deletePortfolio() {

  const portfolioName = await vscode.window.showQuickPick(await Library.getPortfoliosNames(), { placeHolder: 'Select portfolio' }) as string;
  if (portfolioName === undefined) {
    return;
  }

  await Library.deletePortfolio(portfolioName);
}


/**  show portfolios dropdown then new colors input box */
async function addMultipleColorsToPortfolio() {

  let portfolioName = await vscode.window.showQuickPick(await Library.getPortfoliosNames(), { placeHolder: 'Select portfolio' });
  if (portfolioName === undefined) {
    return;
  }
  portfolioName = Tools.trim(portfolioName);

  const options: vscode.InputBoxOptions = {
    placeHolder: 'Html color names or hex values.',
    prompt: 'Enter base colors separated by spaces.'
  };
  let colorsStr = await vscode.window.showInputBox(options) as string;
  if (colorsStr === undefined) {
    return;
  }
  colorsStr = Tools.trim(colorsStr);

  await Library.generateColorationsInPortfolio(colorsStr, portfolioName);
}


//TODO rewrite from portfolio handler
export async function libraryHandler() {
  const LOAD_COLORS = "Load Colors";
  const SAVE_COLORATION = "Save Colors";
  const DELETE_COLORS = "Delete Colors";
  const NEW_PORTFOLIO = "New Portfolio";
  const DELETE_PORTFOLIO = "Delete Portfolio";
  const ADD_MULTIPLE_COLORS_TO_PORTFOLIO = "Add Multiple Colors To Portfolio";

  const selection = await vscode.window.showQuickPick(
    [LOAD_COLORS, SAVE_COLORATION, DELETE_COLORS, NEW_PORTFOLIO, DELETE_PORTFOLIO, ADD_MULTIPLE_COLORS_TO_PORTFOLIO],
    { placeHolder: 'Colors Library' }
  );

  switch (selection) {
    case LOAD_COLORS:
      loadColors();   // show portfolios dropdown then colors dropdown
      break;
    case SAVE_COLORATION:
      saveColoration();    // show portfolios dropdown then new colors input box
      break;
    case DELETE_COLORS:
      deleteColors();  // show portfolios dropdown then colors dropdown
      break;
    case NEW_PORTFOLIO:
      newPortfolio();   // single input box
      break;
    case DELETE_PORTFOLIO:
      deletePortfolio();  // show portfolios dropdown 
      break;
    case ADD_MULTIPLE_COLORS_TO_PORTFOLIO:
      addMultipleColorsToPortfolio();  // show portfolios dropdown then input box
      break;
  }
}
