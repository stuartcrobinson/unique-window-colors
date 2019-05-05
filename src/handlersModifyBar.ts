import * as vscode from 'vscode';
import { Tools } from './tools';
import { C } from './Constants';

const getSettingNameFromBarName = (barName: string) => 'Modify' + barName.charAt(0).toUpperCase() + barName.slice(1) + 'Bar';

export async function modifyBarHandler(barName: string) {
  // let s = Tools.getInternalSettingsObject();

  let c = Tools.getExtensionSettings();

  const settingName = getSettingNameFromBarName(barName);

  const dropdownValues = [`Current value (${c[settingName] === true ? 'yes' : 'no'})`, 'yes', 'no'];

  const options = {
    placeHolder: 'Modify the ' + barName + ' bar color?',
    onDidSelectItem: async (selection: string) => {
      await Tools.setGlobalSetting(settingName, selection.includes('yes'));
    }
  };
  const selection = await vscode.window.showQuickPick(dropdownValues, options) as string;

  if (selection === undefined) {
    await Tools.setGlobalSetting(settingName, c[settingName]);
    return;
  }
  await Tools.setGlobalSetting(settingName, selection.includes('yes'));
}

export async function setModifiedAreasHandler() {

  const c = Tools.getExtensionSettings();

  if (!c[C.internalSettings] || !c[C.internalSettings][C.BaseColor]) {
    vscode.window.showWarningMessage("You don't have any colors set so changing modified areas won't have any visible effect.")
  }

  const TITLE_BAR_OPTION = C.TITLE_BAR + (c[C.ModifyTitleBar] ? '  ✅' : '');
  const ACTIVITY_BAR_OPTION = C.ACTIVITY_BAR + (c[C.ModifyActivityBar] ? '  ✅' : '');
  const STATUS_BAR_OPTION = C.STATUS_BAR + (c[C.ModifyStatusBar] ? '  ✅' : '');

  let selection = await vscode.window.showQuickPick([TITLE_BAR_OPTION, ACTIVITY_BAR_OPTION, STATUS_BAR_OPTION],
    { placeHolder: 'Toggle modification for:', }
  ) as string;

  switch (selection) {
    case TITLE_BAR_OPTION:
      await modifyBarHandler('title');
      break;
    case ACTIVITY_BAR_OPTION:
      await modifyBarHandler('activity');
      break;
    case STATUS_BAR_OPTION:
      await modifyBarHandler('status');
      break;
  }
}