import * as vscode from 'vscode';
import { C } from './Constants';
import { Errors } from './messages';
import { Library } from './library';
import { Tools } from './tools';



/**
 * display portfolios.  set selection to automaticColorsPortfolio
 * put checkmark by the name of the selected portfolio (use )
 */
export async function automaticColorsHandler() {

  const initPortfolio = Tools.getSetting(C.AutomaticColorsPortfolio);

  const initSelected = Tools.getInternalSetting(C.useAutomatic) && initPortfolio;

  const doOverwriteInit = Tools.getSetting(C.overwriteAllWorkspaceColorsWithAutomaticPortfolio);

  const PORTFOLIOS = 'Portfolios - Select the automatic colors source and randomly color this workspace.';
  const OVERWRITE_WORKSPACES = 'Overwrite all workspace colors? ' + (doOverwriteInit ? `(yes, portfolio: ${initPortfolio})` : `(no)`);


  let selection = await vscode.window.showQuickPick([PORTFOLIOS, OVERWRITE_WORKSPACES],
    { placeHolder: 'Automatic Colors Menu' }
  ) as string;
  if (selection === undefined) {
    return;
  }

  switch (selection) {
    case PORTFOLIOS:


      let portfolioOptions = [C.Automatic, ...await Library.getPortfoliosNames()];

      let portfolioNames = Tools.checkElement(initSelected, portfolioOptions);

      portfolioOptions[0] += ' ("Light" or "Dusty" depending on theme)';

      if (portfolioNames.length === 0) {
        Errors.noPortfoliosFound();
        return;
      }
      let portfolioName = await vscode.window.showQuickPick(portfolioNames,
        { placeHolder: PORTFOLIOS }
      ) as string;
      if (portfolioName === undefined) {
        return;
      }
      portfolioName = Tools.trim(portfolioName.replace('✅', ''));
      if (portfolioName.includes(C.Automatic)) {
        await Tools.setGlobalSetting(C.AutomaticColorsPortfolio, C.Automatic);
        await Tools.installAutomaticColoration();
        return;
      }
      const colorations = Library.getColorationNamesInPortfolio(portfolioName);
      if (colorations.length < 2) {
        Errors.notEnoughPortfolioColors(portfolioName, colorations);
        return;
      }
      await Tools.setGlobalSetting(C.AutomaticColorsPortfolio, portfolioName);
      await Tools.installAutomaticColoration();
      break;

    case OVERWRITE_WORKSPACES:

      let selection = await vscode.window.showQuickPick([`Current value (${doOverwriteInit === true ? 'yes' : 'no'})`, 'yes', 'no'],
        { placeHolder: OVERWRITE_WORKSPACES + '(requires reload)' }
      ) as string;
      if (selection === undefined) {
        return;
      }
      await Tools.setGlobalSetting(C.overwriteAllWorkspaceColorsWithAutomaticPortfolio, selection.includes('yes'));
      break;
  }
}