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
  return makeWorkspaceFromText(JSON.stringify(settings, null, 4) + '\n');
}

function makeWorkspaceFromText(text: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'window-colors-'));
  fs.mkdirSync(path.join(root, '.vscode'));
  fs.writeFileSync(path.join(root, '.vscode', 'settings.json'), text);
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

  // Issue #75: settings.json is JSONC. Cleanup used to throw on these files,
  // then to skip them silently once the throw was caught.
  it('cleans up a settings file that contains comments', () => {
    deleteSettingsFileUponExit = true;
    const root = makeWorkspaceFromText(`{
	// Comments are legal in settings.json.
	"editor.fontSize": 19,
	"workbench.colorCustomizations": {
		"activityBar.background": "#032F03",
		"titleBar.activeBackground": "#044104",
	}
}
`);
    const settingsFile = path.join(root, '.vscode', 'settings.json');

    new SettingsFileDeleter(root).dispose();

    equal(fs.readFileSync(settingsFile, 'utf8'), `{
	// Comments are legal in settings.json.
	"editor.fontSize": 19
}
`);
  });

  it('keeps a file whose only remaining content is a comment', () => {
    deleteSettingsFileUponExit = true;
    const root = makeWorkspaceFromText(`{
	// Keep this note even after the colors go.
	"workbench.colorCustomizations": {
		"activityBar.background": "#032F03"
	}
}
`);
    const settingsFile = path.join(root, '.vscode', 'settings.json');

    new SettingsFileDeleter(root).dispose();

    ok(fs.existsSync(settingsFile), 'a file still holding a user comment must survive');
    ok(fs.readFileSync(settingsFile, 'utf8').includes('Keep this note'));
  });

  it('leaves a damaged settings file untouched', () => {
    deleteSettingsFileUponExit = true;
    const damaged = '{\n  "workbench.colorCustomizations": {\n';
    const root = makeWorkspaceFromText(damaged);
    const settingsFile = path.join(root, '.vscode', 'settings.json');

    new SettingsFileDeleter(root).dispose();

    ok(fs.existsSync(settingsFile), 'an unparseable file must never be deleted');
    equal(fs.readFileSync(settingsFile, 'utf8'), damaged);
  });
});
