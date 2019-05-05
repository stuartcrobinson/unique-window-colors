import * as vscode from 'vscode';
import { commands, ExtensionContext, workspace } from 'vscode';
import { A, animateHandler } from './animation';
import { C } from './Constants';
import { automaticColorsHandler } from './handlerAutomaticColors';
import { libraryHandler } from './handlerLibrary';
import { resetHandler, setColorsHandler, setThemeHandler } from './handlerMisc';
import { SettingsFileDeleter } from './SettingsFileDeleter';
import { Tools } from './tools';

let prevConfig: any;

function onConfigChange(): (e: vscode.ConfigurationChangeEvent) => any {
  return async e => {

    const internalSettingsObject = Tools.getInternalSettingsObject();
    let currConfig = Tools.getExtensionSettings();

    // console.log('??????change??????');
    // console.log('prevConfig:');
    // console.log(JSON.stringify(prevConfig));
    // console.log('currConfig:');
    // console.log(JSON.stringify(currConfig));

    let currThemeMap = currConfig && currConfig[C.internalSettings] ? currConfig[C.internalSettings][C.customThemeMap] : undefined;
    let prevThemeMap = prevConfig && prevConfig[C.internalSettings] ? prevConfig[C.internalSettings][C.customThemeMap] : undefined;

    let customThemeMapExistsAndChanged = currThemeMap && currThemeMap !== prevThemeMap;

    if (!prevConfig || JSON.stringify(prevConfig) !== JSON.stringify(currConfig)) {
      if (internalSettingsObject[C.BaseColor] || customThemeMapExistsAndChanged) {

        if (prevConfig && currConfig) {
          if (prevConfig[C.BaseColor] !== currConfig[C.BaseColor]) {
            A.doAnimate = false;  //shut down animation if base color changes. (leave it running if font color change)
          }
        }

        // console.log('~~~~~~~change~~~~~~~');

        // changed = true;
        if (Tools.colorationIsTriggered(prevConfig, currConfig)) {
          // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~change triggered~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
          // console.log('prevConfig:');
          // console.log(JSON.stringify(prevConfig));
          // console.log('currConfig:');
          // console.log(JSON.stringify(currConfig));
          await Tools.fillCc();
        }
        // }

        await Tools.saveSettings();
      }
    }
    prevConfig = currConfig;
    // if (!changed) {
    //   console.log('XXXXXXXXX no change XXXXXXXXX');
    // }
  };
}



function registerCommands() {

  commands.registerCommand(
    'extension.library',
    libraryHandler
  );

  commands.registerCommand(
    'extension.setColors',
    setColorsHandler
  );

  commands.registerCommand(
    'extension.automaticColors',
    automaticColorsHandler
  );

  commands.registerCommand(
    'extension.setTheme',
    setThemeHandler
  );

  commands.registerCommand(
    'extension.reset',
    resetHandler
  );

  commands.registerCommand(
    'extension.animate',
    animateHandler
  );
}


export async function activate(context: ExtensionContext) {

  registerCommands();
  context.subscriptions.push(workspace.onDidChangeConfiguration(onConfigChange()));
  context.subscriptions.push(new SettingsFileDeleter());

  if (Tools.getWorkspaceRoot() === '') {
    return;
  }

  //ensure  portfolio presets are installed
  let myGlobalData = await Tools.installPortfolioPresets_ifMissing();

  const installedAutomaticColors = await Tools.installAutomaticColor_ifRequested(myGlobalData);

  if (!installedAutomaticColors) {

    //this runs forever if animating.  dont put code after
    const loadedSavedSettings = await Tools.loadSavedSettings();

    if (!loadedSavedSettings) {
      await Tools.installAutomaticColoration();
    }
  }
}