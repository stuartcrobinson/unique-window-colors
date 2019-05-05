import * as Color from 'Color';
import * as fs from 'fs';
import * as path from 'path';
import getPath from 'platform-folders';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { animate } from './animation';
import { ColorManip } from './colorManip';
import { C } from './Constants';
import { Errors } from './messages';
import { Library } from './library';
import presets1 from './portfoliosPresets';

function getValues(obj: any) {
  let ar = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      var val = obj[key];
      ar.push(val);
    }
  }
  return ar;
}

export class Tools {


  static async attemptToSetBackgroundBaseColor(inputColor: string) {

    if (!Tools.isValidColor(inputColor)) {
      vscode.window.showErrorMessage(`"${inputColor}" is not a valid color.`);
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


  static async installAutomaticColor_ifRequested(myGlobalData: any): Promise<boolean> {

    const root = Tools.getWorkspaceRoot();

    let globalDataObj = myGlobalData[root];


    // if overwriteAllWorkspaceColorsWithAutomaticPortfolio === true AND portfolioAndColor's portfolio is different from windowColors.AutomaticColorsPortfolio, then install an automatic color. 
    const c = Tools.getExtensionSettings();

    try {
      const doOverwrite = c[C.overwriteAllWorkspaceColorsWithAutomaticPortfolio];
      const AutomaticColorsPortfolio = c[C.AutomaticColorsPortfolio];
      const internalSettings = globalDataObj[C.internalSettings]
      const portfolioAndColor = internalSettings[C.portfolioAndColor];
      const currPortfolio = portfolioAndColor[C.portfolio];

      if (doOverwrite && (AutomaticColorsPortfolio !== currPortfolio)) {
        await Tools.installAutomaticColoration();
        return true;
      }
      else {
        return false;
      }
    } catch (err) {
      return false;
    }
  }


  static trim(str: any) {
    return (str as string).trim().replace(/\s\s+/g, ' ');
  }

  static async installAutomaticColoration() {

    let portfolio = Tools.getSetting(C.AutomaticColorsPortfolio);

    if (portfolio === undefined) {
      Errors.automaticPortfolioNotSet();
      return;
    }

    if (portfolio === C.Automatic) {

      const theme = Tools.getTheme();
      if (theme.toLowerCase().includes('light')) {
        portfolio = 'Light';
      }
      else {
        portfolio = 'Dusty';
      }
    }

    // "internalSettings": {
    //   "BaseColor": "hsl(285,100%,         16%)",
    //   "portfolioAndColor": {
    //     "portfolio": "Very Dark",
    //     "coloration": "hsl(285,100%,16%)"


    const shuffledPortfolioColorations = shuffle(Library.getColorationNamesInPortfolio(portfolio));

    if (shuffledPortfolioColorations.length < 2) {
      Errors.notEnoughPortfolioColors(portfolio, shuffledPortfolioColorations);
      return;
    }

    const usedColorationsCounts = Tools.getCurrentlyUsedColorationsCountsInPortfolio(portfolio);
    // console.log('usedColorationsCounts', JSON.stringify(usedColorationsCounts));

    const minCount = Math.min(...getValues(usedColorationsCounts));
    // console.log('minCount', JSON.stringify(minCount));
    // console.log('maxCount', JSON.stringify(Math.max(...getValues(usedColorationsCounts))));

    let coloration;

    for (let i = 0; i < shuffledPortfolioColorations.length; i++) {
      coloration = shuffledPortfolioColorations[i];
      if (usedColorationsCounts[coloration] === minCount) {
        break;
      }
    }
    // console.log('coloration', coloration);

    //ok we have the coloration to use.  now load it.

    await Library.loadColoration(portfolio, coloration, true);
  }



  static async  installPortfolioPresets_ifMissing() {

    const presets = presets1 as any;

    const portfolioNames = Object.keys(presets);

    let myGlobalData = Tools.getSetting(C.myGlobalData);

    if (myGlobalData === undefined) {
      myGlobalData = {};
    }
    if (myGlobalData[C.portfolios] === undefined) {
      myGlobalData[C.portfolios] = {};
    }

    let portfoliosToAdd = {} as any;

    portfolioNames.forEach(p => {
      if (!(p in myGlobalData[C.portfolios])) {
        portfoliosToAdd[p] = presets[p];
      }
    });

    if (JSON.stringify(portfoliosToAdd) !== "{}") {

      myGlobalData[C.portfolios] = { ...myGlobalData[C.portfolios], ...portfoliosToAdd };

      await Tools.setGlobalSetting(C.myGlobalData, myGlobalData);
    }
    return myGlobalData;
  }
  static getRandomElement(ar: any[]) {
    const i = Math.floor(Math.random() * ar.length);
    return ar[i];
  }

  /** return map.  key: coloration. value: num occurrences */
  static getCurrentlyUsedColorationsCountsInPortfolio(portfolio: string) {



    // "internalSettings": {
    //   "BaseColor": "hsl(285,100%,         16%)",
    //   "portfolioAndColor": {
    //     "portfolio": "Very Dark",
    //     "coloration": "hsl(285,100%,16%)"



    const myGlobalData = Tools.getSetting(C.myGlobalData);

    const colorations = Library.getColorationNamesInPortfolio(portfolio);

    const colorationsCounts = {} as any;

    colorations.forEach(c => { colorationsCounts[c] = 0; });

    for (let key in myGlobalData) {

      let obj = myGlobalData[key] as any;

      // // const obj = myGlobalData[key] as any;
      // console.log('key', key)
      // console.log('obj', JSON.stringify(obj))

      if (obj && obj[C.internalSettings] &&
        obj[C.internalSettings][C.portfolioAndColor] &&
        obj[C.internalSettings][C.portfolioAndColor][C.portfolio] === portfolio) {

        const coloration = obj[C.internalSettings][C.portfolioAndColor][C.coloration];

        colorationsCounts[coloration] += 1; //works
      }
    }
    return colorationsCounts;
  }

  static checkElement(initSelected: any | undefined, ar: string[]): string[] {
    if (initSelected) {
      for (let i = 0; i < ar.length; i++) {
        if (ar[i] === initSelected) {
          ar[i] += '  ✅';
          return ar;
        }
      }
    }
    return ar;
  }


  static isValidColor(cololStr: string) {

    try {
      Color(cololStr); //to check if valid color name or not
    }
    catch (error) {
      return false;
    }
    return true;;
  }

  static colorationIsTriggered(prevConfig: any, currConfig: any): boolean {

    if (!prevConfig) {
      return true;
    }

    const prevTrigStr = JSON.stringify(this.getColorationRelevantObjFromWorkspaceSettings(prevConfig));
    const currTrigStr = JSON.stringify(this.getColorationRelevantObjFromWorkspaceSettings(currConfig));

    return prevTrigStr !== currTrigStr;
  }


  /** also look directly in internalSettings */
  static getColorationRelevantObjFromWorkspaceSettings(c: any) {
    let internalSettings = c[C.internalSettings];

    let obj1 = Tools.getELementsInNewJson(c, C.colorationTriggers);
    let obj2 = Tools.getELementsInNewJson(internalSettings, C.colorationTriggers);

    return { ...obj1, ...obj2 };
  }



  /** internal settings object merged with Modify...Bar settings */
  static getLifecycleTriggerJson() {

    let result = Tools.getInternalSettingsObject();

    let c = Tools.getExtensionSettings();

    result[C.ModifyTitleBar] = c[C.ModifyTitleBar];
    result[C.ModifyActivityBar] = c[C.ModifyActivityBar];
    result[C.ModifyStatusBar] = c[C.ModifyStatusBar];

    return c; //was results
  }

  static getELementsInNewJson(obj: any, keys: string[]) {

    let out = {} as any;

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      out[key] = obj[key];
    }
    return obj;
  }

  static getExtensionSettings() {
    let config = Tools.getConfig();
    let obj = {} as any;

    for (let i = 0; i < C.extensionSettings.length; i++) {
      let settingName = C.extensionSettings[i];
      obj[settingName] = config.get(settingName);
    }

    return obj;
  }

  /**TODO - open vscode bug - when a value is changed to '#000000' - then vscode.ConfigurationChangeEvent doesn't trigger */
  static deblack(x: any) {
    if (x === undefined) {
      return x;
    }
    if (typeof x === 'string') {
      x = x.replace(/#000000/g, '#010101');
    }
    if (typeof x === 'object') {
      if (x[C.BaseColor] === 'black') {
        x[C.BaseColor] = '#010101';
      }
    }
    return x;
  }


  static getColorCustomizations() {
    return JSON.parse(JSON.stringify(workspace.getConfiguration('workbench').get('colorCustomizations')));
  }

  static async setColorCustomizations(cc: JSON) {
    return await workspace.getConfiguration('workbench').update('colorCustomizations', cc, false);
  }


  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  ////// custom theme ////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  /** also sets color in cc.  bad idea? side effect? */
  static async setCustomThemeItem(themeItem: string, obj: any) {

    let customThemeMap = Tools.getInternalSetting(C.customThemeMap) || {};


    customThemeMap[themeItem] = obj;

    await Tools.setInternalSettings({
      [C.customThemeMap]: customThemeMap,
      [C.portfolioAndColor]: undefined,
      [C.useAutomatic]: undefined
    });
  }

  static getCustomThemeItemSaturationFromMap(customThemeMap: any, item: string) {

    let themeObject = customThemeMap[item];

    if (themeObject) {
      if (C.customThemeSaturation in themeObject) {
        return themeObject[C.customThemeSaturation]
      }
    }
    return C.defaultSaturation;
  }

  static getCustomThemeItemLightnessFromMap(customThemeMap: any, item: string) {

    let themeObject = customThemeMap[item];

    if (themeObject) {
      if (C.customThemeLightness in themeObject) {
        return themeObject[C.customThemeLightness]
      }
    }
    return C.defaultLightness;
  }

  static async removeCustomThemeItem(item: string) {

    let customThemeMap = Tools.getInternalSetting(C.customThemeMap);

    delete customThemeMap[item];

    await Tools.setInternalSetting(C.customThemeMap, customThemeMap);
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // end custom theme ////////////////////////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  static getTheme(): string {
    try {
      let json = Tools.getLocalSettingsJsonFromDisk();

      if ("workbench.colorTheme" in json) {
        // console.log('theme from local settings: ' + json["workbench.colorTheme"]);
        return json["workbench.colorTheme"];
      }

      //now look in global settings file

      json = Tools.getGlobalSettingsJsonFromDisk();

      if ("workbench.colorTheme" in json) {
        return json["workbench.colorTheme"];
      }
    } catch (error) {
      //do nothing
      console.log('caught an error: getTheme: ' + error);
    }
    return "Default Dark+";
  }

  static async setTheme(themeName: string | undefined) {
    let json = Tools.getLocalSettingsJsonFromDisk();
    if (json['folders'] && json['settings']) {
      json['settings']["workbench.colorTheme"] = themeName;
    }
    else {
      json["workbench.colorTheme"] = themeName;
    }

    //check if no settings file exists. if so, save an empty cc
    const settingsFilePath = Tools.getLocalSettingsPath();
    if (settingsFilePath === undefined || !fs.existsSync(settingsFilePath)) {
      await Tools.setColorCustomizations(JSON.parse('{}'));
    }

    Tools.writeLocalSettingsJsonToDisk(json);
    // vscode.window.showInformationMessage('before save settings')
    await Tools.saveSettings();
    // vscode.window.showInformationMessage('after save settings')
  }

  static writeLocalSettingsJsonToDisk(json: any) {
    fs.writeFileSync(Tools.getLocalSettingsPath() as string, JSON.stringify(json, null, 4));
  }

  static showInformationMessage(message: any) {
    vscode.window.showInformationMessage(message);
  }

  static getConfig(): vscode.WorkspaceConfiguration {
    return workspace.getConfiguration('windowColors');
  }


  static getSetting(name: string) {
    return JSON.parse(JSON.stringify(
      workspace.getConfiguration('windowColors').get<string>(name)
    ));
  }

  static async setSetting(name: string, value: any) {
    value = Tools.deblack(value);
    await workspace.getConfiguration('windowColors').update(name, value);
  }

  /** stuff we don't want user to be able to access. */
  static getInternalSettingsObject() {
    return Tools.getSetting(C.internalSettings);
  }

  /** stuff we don't want user to be able to access. */
  static getInternalSetting(name: string) {
    let s = Tools.getSetting(C.internalSettings);

    return s === undefined ? undefined : s[name];
  }

  /** stuff we don't want user to be able to access. */
  static async setInternalSetting(name: string, value: any) {
    value = Tools.deblack(value);
    let obj = Tools.getSetting(C.internalSettings);
    obj[name] = value;
    return await Tools.setSetting(C.internalSettings, obj);
  }

  /** stuff we don't want user to be able to access. */
  static async setInternalSettings(inputObj: any) {

    for (var key in inputObj) {
      if (inputObj.hasOwnProperty(key)) {
        inputObj[key] = Tools.deblack(inputObj[key])
      }
    }

    let obj = Tools.getSetting(C.internalSettings) || {};

    const newInternalSettingsToSet = { ...obj, ...inputObj };

    await Tools.setSetting(C.internalSettings, newInternalSettingsToSet);
  }

  static async setGlobalSetting(name: string, value: any) {
    // console.log('setGlobalSetting ' + name + ', value: ');
    // console.log(value);
    let config = vscode.workspace.getConfiguration();
    return await config.update('windowColors.' + name, value, vscode.ConfigurationTarget.Global);
  }


  static getWorkspaceRoot() {
    return getWorkspaceFolder(workspace.workspaceFolders);
  }

  static getLocalDotVscodeDirPath() {
    return path.resolve(this.getWorkspaceRoot(), '.vscode');
  }

  static getLocalDotVscodeDirPathForWorkspace(root: string) {
    return path.resolve(root, '.vscode');
  }

  //cd "/Users/stuartrobinson/Library/Application Support/Code/Workspaces/1556590758890"^
  //TODO - move this out - just search once for global workspace dir
  static getLocalSettingsPath() {
    const root = Tools.getWorkspaceRoot();

    return Tools.getLocalSettingsPathForWorkspace(root);
  }

  static getLocalSettingsPathForWorkspace(root: string) {

    const localDirPotentialLocation = path.resolve(Tools.getLocalDotVscodeDirPathForWorkspace(root), 'settings.json');

    if (fs.existsSync(localDirPotentialLocation)) {
      return localDirPotentialLocation;
    }

    const workspacesDir = path.resolve(getPath('appData') as string, 'Code', 'Workspaces');

    const workspaceDirs = fs.readdirSync(workspacesDir);

    for (let i = 0; i < workspaceDirs.length; i++) {
      const workspaceDir = workspaceDirs[i];

      let settingsFilePath = path.resolve(getPath('appData') as string, 'Code', 'Workspaces', workspaceDir, 'workspace.json');

      let settingsStr = fs.readFileSync(settingsFilePath).toString();
      let settingsJson = JSON.parse(settingsStr);
      if (settingsJson['folders'] === undefined) {
        return undefined;
      }
      let theListedRootPath = settingsJson['folders'][0]['path'];

      if (theListedRootPath === root) {
        return settingsFilePath;
      }
    }
    // throw Error('settings file not found!!!! D:');
    return undefined;
  }

  static getGlobalSettingsPath() {
    const result = path.resolve(getPath('appData') as string, 'Code', 'User', 'settings.json');
    // console.log('getGlobalSettingsPath: ' + result);
    return result;
  }

  static getLocalSettingsJsonFromDisk() {
    const root = Tools.getWorkspaceRoot();
    return Tools.getLocalSettingsJsonFromDiskForWorkspace(root);
  }


  static getLocalSettingsJsonFromDiskForWorkspace(root: string) {
    let settingsContentsStr = 'init';
    try {
      const settingsPath = Tools.getLocalSettingsPathForWorkspace(root);
      if (settingsPath === undefined) {
        return {};
      }
      settingsContentsStr = fs.readFileSync(settingsPath).toString();
      settingsContentsStr = settingsContentsStr.replace(/\n/g, " ");
      settingsContentsStr = settingsContentsStr.replace(/ +/g, " ");
      settingsContentsStr = settingsContentsStr.replace(/, }/g, "}");
      settingsContentsStr = settingsContentsStr.replace(/,}/g, "}");

      return JSON.parse(settingsContentsStr);
    } catch (error) {
      console.log('settingsContentsStr,', settingsContentsStr);

      console.log('caught an error: getLocalSettingsJsonFromDiskForWorkspace: ' + error);
      return {};
    }
  }

  static getGlobalSettingsJsonFromDisk() {
    try {

      let settingsContentsStr = fs.readFileSync(Tools.getGlobalSettingsPath()).toString();
      settingsContentsStr = settingsContentsStr.replace(/\n/g, " ");
      settingsContentsStr = settingsContentsStr.replace(/ +/g, " ");
      settingsContentsStr = settingsContentsStr.replace(/, }/g, "}");
      settingsContentsStr = settingsContentsStr.replace(/,}/g, "}");
      return JSON.parse(settingsContentsStr);
    } catch (error) {
      console.log('caught an error:  getGlobalSettingsJsonFromDisk: ' + error);

      return {};
    }
  }

  static deleteLocalSettingsFileIfSafeToDo(): boolean {
    let json = Tools.getLocalSettingsJsonFromDisk();
    for (var prop in json) {
      if (json.hasOwnProperty(prop)) {
        // do stuff
        if (!(prop === "workbench.colorCustomizations" || prop === "workbench.colorTheme" || prop.includes("windowColors"))) {
          return false;
        }
      }
    }

    const settingsPath = Tools.getLocalSettingsPath();
    if (settingsPath && fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }

    if (fs.readdirSync(Tools.getLocalDotVscodeDirPath()).length === 0) {
      fs.rmdirSync(Tools.getLocalDotVscodeDirPath());
    }
    return true;
  }


  static async removeWorkspaceFromGlobalData() {

    const root = Tools.getWorkspaceRoot();

    let data = Tools.getSetting(C.myGlobalData);

    delete data[root];

    await Tools.setGlobalSetting(C.myGlobalData, data);
  }


  static async removeAllWorkspacesFromGlobalData() {

    let data = Tools.getSetting(C.myGlobalData);

    for (var key in data) {
      if (data.hasOwnProperty(key) && key != C.portfolios) {
        delete data[key];
      }
    }

    await Tools.setGlobalSetting(C.myGlobalData, data);
  }


  static async removeModificationsToLocalSettingsFile() {

    const actualTheme = Tools.getTheme();
    const internalSettingsTheme = Tools.getInternalSetting(C.theme);
    // console.log('actualTheme')
    // console.log(actualTheme)
    // console.log("internalSettingsTheme")
    // console.log(internalSettingsTheme)

    await Tools.setSetting(C.internalSettings, undefined); //TODO open vscode bug, it fails when using undefined to remove setting (no error thrown)

    await Tools.setColorCustomizations({} as any);
    await Tools.setSetting(C.ModifyTitleBar, undefined);
    await Tools.setSetting(C.ModifyActivityBar, undefined);
    await Tools.setSetting(C.ModifyStatusBar, undefined);

    // remove theme if vscode workspace theme equals windowcolors internalsettings theme
    //has to go at the end here.  otherwise get weird file errors from messing w/ actual disk maybe?
    if (actualTheme === internalSettingsTheme) {
      await Tools.setTheme(undefined);
    }
  }

  /** don't delete settings.json cos that screws stuff up. */
  static async clearWorkspaceSettings() {
    await Tools.removeModificationsToLocalSettingsFile();
    await Tools.removeWorkspaceFromGlobalData();
  }

  static clearExternalWorkspaceSettings(root: string) {
    //   {
    //     "folders": [
    //         {
    //             "path": "/Users/stuartrobinson/repos/vscodeplugtest/windowcolorsapril2019/unique-window-colors/img"
    //         }
    //     ],
    //     "settings": {
    //         "windowColors.internalSettings": {
    //             "BaseColor": "hsl(100,100%,               8%)",
    //             "portfolioAndColor": {
    //                 "portfolio": "Very Dark",
    //                 "coloration": "hsl(100,100%,8%)"
    //             },
    //             "useAutomatic": true
    //         },
    //         "workbench.colorCustomizations": {
    //             "titleBar.activeBackground": "#1B5200",
    //             "titleBar.inactiveBackground": "#0E2900",
    //             "titleBar.activeForeground": "#EFFFE8",
    //             "titleBar.inactiveForeground": "#A5BB99",
    //             "activityBar.background": "#0E2900",
    //             "activityBar.foreground": "#EEFFE5"
    //         }
    //     }
    // }

    //   {
    //     "windowColors.internalSettings": {
    //         "BaseColor": "hsl(225,25%, 25%)",
    //         "portfolioAndColor": {
    //             "portfolio": "Very Dark",
    //             "coloration": "hsl(225,25%,25%)"
    //         },
    //         "useAutomatic": true,
    //         "theme": "Visual Studio Dark"
    //     },
    //     "workbench.colorCustomizations": {
    //         "titleBar.activeBackground": "#2A3F7E",
    //         "titleBar.inactiveBackground": "#203060",
    //         "titleBar.activeForeground": "#F9FAFD",
    //         "titleBar.inactiveForeground": "#A8ACB8",
    //         "activityBar.background": "#203060",
    //         "activityBar.foreground": "#FBFCFE"
    //     },
    //     "workbench.colorTheme": "Visual Studio Dark"
    // }


    let json = Tools.getLocalSettingsJsonFromDiskForWorkspace(root);

    let obj = json;

    if (json['folders'] && json['settings']) {
      obj = json['settings'];
    }

    let key;
    for (key in obj) {
      if (key.includes('windowColors')) {
        delete obj[key];
      }
    }

    delete obj["workbench.colorTheme"];
    delete obj["workbench.colorCustomizations"];

    const settingsPath = Tools.getLocalSettingsPathForWorkspace(root);

    try {
      fs.writeFileSync(settingsPath as string, JSON.stringify(json));
    } catch (err) {
      console.log('caught exception in clearExternalWorkspaceSettings', err)
    }
  }
  static deleteExternalWorkspaceSettingsMaybe(root: string) {
    let json = Tools.getLocalSettingsJsonFromDiskForWorkspace(root);

    let obj = json;

    if (json['folders'] && json['settings']) {
      obj = json['settings'];
    }

    if (JSON.stringify(obj) === "{}") {
      // Tools.showInformationMessage(`going to delete ${root} cos obj: ${JSON.stringify(obj)}`)
      Tools.deleteSettingsFileAndParentIfEmpty(root);
    }
  }

  // deleteExternalWorkspaceSettingsMaybe

  static deleteSettingsFileAndParentIfEmpty(root: string) {

    const settingsFilePath = Tools.getLocalSettingsPathForWorkspace(root);

    if (settingsFilePath !== undefined) {

      const settingsDir = path.dirname(settingsFilePath);
      //delete the local settings.json file
      fs.unlinkSync(settingsFilePath);
      try {
        fs.rmdirSync(settingsDir);  //only deletes empty folders
      } catch (err) {
        console.log('caught expected exception: deleteSettingsFileAndParentIfEmpty: ', err);
      }
    }
  }

  static clearAllWorkspacesLocalSettings() {

    const myGlobalData = Tools.getSetting(C.myGlobalData);

    // if (myGlobalData === undefined) {
    //   return;
    // }
    for (let key in myGlobalData) {

      let obj = myGlobalData[key] as any;

      if (obj && obj[C.internalSettings]) {
        //key is a root, not a profile name

        //so now clear out window colors settings in the settings file.  
        // return;
        Tools.clearExternalWorkspaceSettings(key);
      }
    }
  }
  static deleteAllWorkspacesLocalSettingsMaybe() {
    const myGlobalData = Tools.getSetting(C.myGlobalData);


    for (let key in myGlobalData) {

      let obj = myGlobalData[key] as any;

      if (obj && obj[C.internalSettings]) {
        //key is a root, not a profile name

        //so now clear out window colors settings in the settings file.  
        // return;
        Tools.deleteExternalWorkspaceSettingsMaybe(key);
      }
    }
  }


  /** don't delete settings.json cos that screws stuff up. */
  static async clearExtensionSettings() {

    for (let i = 0; i < C.extensionSettings.length; i++) {
      let setting = C.extensionSettings[i];
      await Tools.setSetting(setting, undefined);
      await Tools.setGlobalSetting(setting, undefined);
    }

    await Tools.setSetting(C.RecentGradientColors, undefined);
    await Tools.setGlobalSetting(C.RecentGradientColors, undefined);
    await Tools.setSetting(C.myGlobalData, undefined);
    await Tools.setGlobalSetting(C.myGlobalData, undefined);

  }

  static async deleteWorkspaceGlobalSettingsValue() {

    const root = Tools.getWorkspaceRoot();

    let data = Tools.getSetting(C.myGlobalData);

    delete data[root];

    await Tools.setGlobalSetting(C.myGlobalData, data);
  }


  static async deleteAllGlobalData() {
    await Tools.setGlobalSetting(C.myGlobalData, undefined);
    await Tools.setGlobalSetting(C.RecentGradientColors, undefined);
    await Tools.setGlobalSetting(C.ModifyTitleBar, undefined);
    await Tools.setGlobalSetting(C.ModifyActivityBar, undefined);
    await Tools.setGlobalSetting(C.ModifyStatusBar, undefined);
    await Tools.setGlobalSetting(C.animationStepsPerTransition, undefined);
    await Tools.setGlobalSetting(C.animationMillisecondsPerStep, undefined);
    await Tools.setGlobalSetting(C.AutomaticColorsPortfolio, undefined);
  }


  static slightlyLighter(color: Color): Color {
    const lightness = color.lightness();

    let x = 6;
    if (lightness < 30 && color.saturationl() > 10) {
      x = 3;
    }
    else if (lightness > 35 && lightness < 65) {
      x = 10;
    }
    let newColor = color.lightness(Math.min(lightness + x, 97));

    return newColor;
  }

  static makeLighter(color: Color, x: number): Color {
    const lightness = color.lightness();

    let newColor = color.lightness(Math.min(lightness + x, 97));

    return newColor;
  }


  static slightlyDarker(color: Color): Color {
    const lightness = color.lightness();

    let x = 5;
    if (lightness < 30 && color.saturationl() > 10) {
      x = 3;
    }
    let newColor = color.lightness(Math.max(lightness - x, 0));

    return newColor;
  }

  static buildNonCustomCc_helper(
    c: any,
    useCustomForegroundColor: boolean,
    adjustedBackgroundBaseColor: Color, adjustedForegroundBaseColor: Color) {

    let cc = {} as any;

    if (c[C.ModifyTitleBar]) {
      let c = Tools.slightlyLighter(adjustedBackgroundBaseColor);
      cc[C.titleBar_activeBackground] = c.hex();
      cc[C.titleBar_inactiveBackground] = adjustedBackgroundBaseColor.hex();
      if (useCustomForegroundColor) {
        const foregroundColor = adjustedForegroundBaseColor.lighten(0.3);
        cc[C.titleBar_activeForeground] = foregroundColor.hex();
        let inactiveColor =
          foregroundColor.lightness() > adjustedBackgroundBaseColor.lightness() ?  //same  v
            foregroundColor.darken(0.3) :
            Tools.makeLighter(foregroundColor, 35);
        inactiveColor = inactiveColor.saturate(-.8);
        cc[C.titleBar_inactiveForeground] = inactiveColor.hex();
      }
      else {
        const foregroundColor = ColorManip.getHighContrast(c);
        cc[C.titleBar_activeForeground] = foregroundColor.hex();
        let inactiveColor =
          foregroundColor.lightness() > adjustedBackgroundBaseColor.lightness() ?   //same  ^
            foregroundColor.darken(0.3) :
            Tools.makeLighter(foregroundColor, 35);
        inactiveColor = inactiveColor.saturate(-.8);
        cc[C.titleBar_inactiveForeground] = inactiveColor.hex();
      }
    }
    else {
      delete cc[C.titleBar_activeBackground];
      delete cc[C.titleBar_activeForeground];
    }
    if (c[C.ModifyActivityBar]) {
      cc[C.activityBar_background] = adjustedBackgroundBaseColor.hex();
      if (useCustomForegroundColor) {
        cc[C.activityBar_foreground] = adjustedForegroundBaseColor.hex();
      }
      else {
        cc[C.activityBar_foreground] = ColorManip.getHighContrast(adjustedBackgroundBaseColor).hex();
      }
    }
    else {
      delete cc[C.activityBar_background];
      delete cc[C.activityBar_foreground];
    }
    if (c[C.ModifyStatusBar]) {
      let c = Tools.slightlyDarker(adjustedBackgroundBaseColor);
      cc[C.statusBar_background] = c.hex();
      if (useCustomForegroundColor) {
        cc[C.statusBar_foreground] = ColorManip.getHighContrastWith(adjustedForegroundBaseColor, Color(cc[C.statusBar_background])).hex();
      }
      else {
        cc[C.statusBar_foreground] = ColorManip.getMaxContrastStr(c);
      }
    }
    else {
      delete cc[C.statusBar_background];
      delete cc[C.statusBar_foreground];
    }
    return cc;
  }



  static async  setSomeColors(
    c: any,
    useCustomForegroundColor: boolean,
    adjustedBackgroundBaseColor: Color, adjustedForegroundBaseColor: Color) {


    let s = Tools.getInternalSettingsObject();

    let cc = Tools.buildNonCustomCc_helper(c, useCustomForegroundColor, adjustedBackgroundBaseColor, adjustedForegroundBaseColor);

    cc = Tools.addCustomThemeColors(s, cc);

    await Tools.setColorCustomizations(cc);
  }

  static addCustomThemeColors(s: any, cc: any): any {

    //custom theme colors
    const map = s[C.customThemeMap];  //awefawef

    for (var key in map) {
      if (map.hasOwnProperty(key)) {
        const obj = map[key];
        const themeItem = key;

        const hex = ColorManip.adjustColor(obj[C.customThemeBaseColor], obj[C.customThemeSaturation], obj[C.customThemeLightness]).hex();
        cc[themeItem] = hex;
      }
    }
    return cc;
  }

  /**
   * 
   * @param cc 
   * @param c workspaceSettings - object must contain ModifyStatuBar, title, activity
   * @param adjustedForegroundBaseColor 
   */
  static async  setForegroundColors(cc: any, c: any, adjustedForegroundBaseColor: Color) {

    if (c[C.ModifyTitleBar]) {
      cc[C.titleBar_activeForeground] = adjustedForegroundBaseColor.lighten(0.3).hex();
    }
    if (c[C.ModifyActivityBar]) {
      cc[C.activityBar_foreground] = adjustedForegroundBaseColor.hex();
    }
    if (c[C.ModifyStatusBar]) {
      cc[C.statusBar_foreground] = ColorManip.getHighContrastWith(adjustedForegroundBaseColor, Color(cc[C.statusBar_background])).hex();
    }
    await Tools.setColorCustomizations(cc);
  }

  static async fillCc() {

    let s = Tools.getInternalSettingsObject();

    let cc = Tools.buildNonCustomCc(s) as any;

    cc = Tools.addCustomThemeColors(s, cc);

    await Tools.setColorCustomizations(cc);
  }



  static buildCcFromInternalSettings(s: any) {
    let cc = Tools.buildNonCustomCc(s);
    return Tools.addCustomThemeColors(s, cc);
  }


  static buildNonCustomCc(s: any) {


    let c = Tools.getExtensionSettings();

    const adjustedBackgroundBaseColor = ColorManip.adjustColor(s[C.BaseColor], s[C.BackgroundSaturation], s[C.BackgroundLightness]);

    const adjustedForegroundBaseColor = s[C.UseCustomForegroundColor] ?
      ColorManip.adjustColor(s[C.ForegroundBaseColor], s[C.ForegroundSaturation], s[C.ForegroundLightness]) :
      Color('red');

    return Tools.buildNonCustomCc_helper(c, s[C.UseCustomForegroundColor], adjustedBackgroundBaseColor, adjustedForegroundBaseColor);
  }



  static async  loadSavedSettings(): Promise<boolean> {
    //note - this gets all settings - even defaults that aren't written to settings.json
    //so, not all settings from globalData will b written to settings.json cos not all necessary to save there (cos defualt)

    let c = Tools.getExtensionSettings();
    const root = Tools.getWorkspaceRoot();
    let data = Tools.getSetting(C.myGlobalData);
    let globDataObj = data[root];
    if (globDataObj) {

      //load all C.workspaceSettings elements from globDataObj that aren't already loaded
      for (let i = 0; i < C.extensionSettings.length; i++) {
        await setSettingMaybe(globDataObj, c, C.extensionSettings[i]);
      }

      await Tools.setColorCustomizations(globDataObj[C.colorCustomizations]);

      let internalSettings = globDataObj[C.internalSettings];

      if (internalSettings) {

        const theme = internalSettings[C.theme];
        if (theme) {
          await Tools.setTheme(theme);
        }

        if (internalSettings[C.animationDoAnimate] && internalSettings[C.animationGradientInputStr]) {
          animate(internalSettings[C.animationGradientInputStr]); //this runs forever.  dont put code after
        }
      }

      return true;
    }
    return false;
  }

  static async  saveSettings() {
    let obj = {} as any;

    let c = Tools.getExtensionSettings();

    for (let i = 0; i < C.extensionSettings.length; i++) {
      let setting = C.extensionSettings[i];
      obj[setting] = c[setting];
    }

    obj[C.internalSettings]['theme'] = Tools.getTheme();  //just in case the user added a theme to the workspace w/out using WC commands

    obj[C.colorCustomizations] = Tools.getColorCustomizations();

    const root = Tools.getWorkspaceRoot();

    let myGlobalData = Tools.getSetting(C.myGlobalData);

    myGlobalData[root] = obj;

    await Tools.setGlobalSetting(C.myGlobalData, myGlobalData);
  }

}

async function setSettingMaybe(globDataObj: any, c: any, settingName: string) {
  if (globDataObj[settingName] !== undefined && c[settingName] !== undefined && globDataObj[settingName] !== c[settingName]) {
    await Tools.setSetting(settingName, globDataObj[settingName]);
  }
}

//https://itnext.io/how-to-make-a-visual-studio-code-extension-77085dce7d82
// takes an array of workspace folder objects and return
// workspace root, assumed to be the first item in the array
const getWorkspaceFolder = (folders: vscode.WorkspaceFolder[] | undefined): string => {
  if (!folders) {
    return '';
  }

  const folder = folders[0] || {};
  const uri = folder.uri;

  return uri.fsPath;
};

function shuffle(array: any[]) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}