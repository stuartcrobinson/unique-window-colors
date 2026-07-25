import { equal, ok } from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'node:test';

interface ExtensionManifest {
  name?: string;
  publisher?: string;
  license?: string;
  version?: string;
}

describe('registry publish contract', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as ExtensionManifest;
  const openVsxWorkflow = readFileSync('.github/workflows/publish_ovsx.yml', 'utf8');

  it('uses the canonical identity shared by both extension registries', () => {
    equal(manifest.publisher, 'stuart');
    equal(manifest.name, 'unique-window-colors');
  });

  it('declares the extension license required by Open VSX', () => {
    equal(manifest.license, 'MIT');
  });

  it('uses a publishable semantic version', () => {
    equal(/^\d+\.\d+\.\d+$/.test(manifest.version || ''), true);
  });

  it('publishes releases through the canonical pre-existing namespace', () => {
    ok(openVsxWorkflow.includes('release:'));
    ok(openVsxWorkflow.includes('OVSX_PAT: ${{ secrets.OVSX_TOKEN }}'));
    equal(openVsxWorkflow.includes('secrets.OVSX_PAT'), false);
    ok(openVsxWorkflow.includes('ovsx publish'));
    ok(openVsxWorkflow.includes('github.event.release.tag_name'));
    equal(openVsxWorkflow.includes('create-namespace'), false);
    equal(openVsxWorkflow.includes('stuartcrobinson'), false);
  });
});
