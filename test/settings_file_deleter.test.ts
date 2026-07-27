import { equal, ok } from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

interface NodeModuleLoader {
  _load(
    request: string,
    parent: NodeModuleLoader | undefined,
    isMain: boolean,
  ): unknown;
}

let deleteSettingsFileUponExit = false;

// Minimal host stub: the deleter only reads this one setting.
const vscodeStub = {
  workspace: {
    getConfiguration: () => ({
      get: (key: string) =>
        key === 'deleteSettingsFileUponExit' ? deleteSettingsFileUponExit : undefined,
    }),
  },
};

const nodeModule = require('node:module') as NodeModuleLoader;
const originalLoad = nodeModule._load;
let extension: typeof import('../src/extension');
try {
  nodeModule._load = function loadWithVscodeHost(request, parent, isMain) {
    if (request === 'vscode') {
      return vscodeStub;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  extension = require('../src/extension') as typeof import('../src/extension');
} finally {
  nodeModule._load = originalLoad;
}

const { SettingsFileDeleter } = extension;

const MANAGED_ONLY = {
  'workbench.colorCustomizations': {
    'activityBar.background': '#032F03',
    'activityBar.foreground': '#FFFFFF',
    'titleBar.activeBackground': '#044104',
    'titleBar.activeForeground': '#FFFFFF',
  },
};

function makeWorkspace(settings: unknown): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'window-colors-'));
  fs.mkdirSync(path.join(root, '.vscode'));
  fs.writeFileSync(
    path.join(root, '.vscode', 'settings.json'),
    JSON.stringify(settings, null, 4) + '\n',
  );
  return root;
}

describe('SettingsFileDeleter', () => {
  it('leaves workspace settings untouched when the setting is off', () => {
    deleteSettingsFileUponExit = false;
    const root = makeWorkspace(MANAGED_ONLY);
    const settingsFile = path.join(root, '.vscode', 'settings.json');
    const before = fs.readFileSync(settingsFile, 'utf8');

    new SettingsFileDeleter(root).dispose();

    ok(fs.existsSync(settingsFile), 'closing a window must not delete workspace settings');
    equal(fs.readFileSync(settingsFile, 'utf8'), before, 'file must be byte-for-byte unchanged');
  });

  it('removes the file and its directory when enabled and nothing else remains', () => {
    deleteSettingsFileUponExit = true;
    const root = makeWorkspace(MANAGED_ONLY);

    new SettingsFileDeleter(root).dispose();

    ok(!fs.existsSync(path.join(root, '.vscode', 'settings.json')));
    ok(!fs.existsSync(path.join(root, '.vscode')));
  });

  it('preserves unrelated settings when enabled', () => {
    deleteSettingsFileUponExit = true;
    const root = makeWorkspace({ ...MANAGED_ONLY, 'editor.fontSize': 19 });
    const settingsFile = path.join(root, '.vscode', 'settings.json');

    new SettingsFileDeleter(root).dispose();

    const remaining = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    equal(remaining['editor.fontSize'], 19);
    equal(remaining['workbench.colorCustomizations'], undefined);
  });
});
