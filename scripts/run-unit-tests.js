#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testRoot = path.resolve(__dirname, '..', '.test-out', 'test');

/** Collect compiled test files without relying on shell glob or find syntax. */
function discoverTests(directory) {
  const tests = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...discoverTests(candidate));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      tests.push(candidate);
    }
  }
  return tests.sort();
}

const tests = discoverTests(testRoot);
if (tests.length === 0) {
  console.error(`No compiled unit tests found below ${testRoot}`);
  process.exit(1);
}

// Let Node's test runner own output and exit semantics. Passing explicit paths
// works identically under cmd.exe, PowerShell, and POSIX shells.
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
