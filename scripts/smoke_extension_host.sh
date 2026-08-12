#!/usr/bin/env bash
#
# End-to-end smoke test in a real VS Code extension host.
#
# Unit tests stub the `vscode` module, so they cannot prove that activation
# runs, that settings survive a real window, or that cleanup happens on
# shutdown. This installs the packaged VSIX into a throwaway profile, opens a
# workspace whose settings.json is deliberately awkward, and checks the file
# before and after a clean window close.
#
# Usage:  scripts/smoke_extension_host.sh [path/to/extension.vsix]
# With no argument it packages the current working tree first.
#
# Three environment gotchas make this fail in confusing ways, all handled below:
#
#  1. ELECTRON_RUN_AS_NODE=1 is set inside VS Code's own integrated terminal.
#     It makes the Electron binary behave as plain Node, so the app never
#     starts and `--extensions-dir` is reported as a bad option.
#  2. VSCODE_IPC_HOOK_CLI is also set there. The `code` wrapper script uses it
#     to forward commands to the ALREADY RUNNING VS Code, so a launch silently
#     opens a window in the developer's own instance instead of the isolated
#     profile, and the test appears to do nothing.
#  3. --user-data-dir must be short. VS Code opens a Unix domain socket inside
#     it, and those are capped near 103 characters; a long path fails with
#     "listen EINVAL". This is why the profile lives at /tmp/<short>.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VSCODE_APP="${VSCODE_APP:-/Applications/Visual Studio Code.app}"
ELECTRON="$VSCODE_APP/Contents/MacOS/Electron"
CODE_CLI="$VSCODE_APP/Contents/Resources/app/bin/code"

# Deliberately short: see gotcha 3.
BASE="${SMOKE_DIR:-/tmp/uwc-smoke}"
WS="$BASE/ws"
SETTINGS="$WS/.vscode/settings.json"

# Strip the variables that would silently redirect this run: see gotchas 1 and 2.
run_vscode() { env -u ELECTRON_RUN_AS_NODE -u VSCODE_IPC_HOOK_CLI -u VSCODE_GIT_IPC_HANDLE "$@"; }

failures=0
check() { # check <description> <regex> <"present"|"absent">
  local description="$1" pattern="$2" expectation="$3" found="absent"
  grep -qE "$pattern" "$SETTINGS" && found="present"
  if [ "$found" = "$expectation" ]; then
    printf '  ok    %s\n' "$description"
  else
    printf '  FAIL  %s (expected %s, was %s)\n' "$description" "$expectation" "$found"
    failures=$((failures + 1))
  fi
}

check_equal_colors() { # check_equal_colors <description> <key> <key> [...]
  local description="$1"
  shift
  if node - "$REPO_ROOT" "$SETTINGS" "$@" <<'NODE'
const fs = require('node:fs');
const { parse } = require(process.argv[2] + '/node_modules/jsonc-parser');
const settings = parse(fs.readFileSync(process.argv[3], 'utf8'));
const colors = settings['workbench.colorCustomizations'] || {};
const keys = process.argv.slice(4);
const values = keys.map(key => colors[key]);
process.exit(values[0] && values.every(value => value === values[0]) ? 0 : 1);
NODE
  then
    printf '  ok    %s\n' "$description"
  else
    printf '  FAIL  %s\n' "$description"
    failures=$((failures + 1))
  fi
}

if [ ! -x "$ELECTRON" ]; then
  echo "VS Code not found at $VSCODE_APP (override with VSCODE_APP=...)" >&2
  exit 1
fi

VSIX="${1:-}"
if [ -z "$VSIX" ]; then
  VSIX="$BASE/extension.vsix"
  mkdir -p "$BASE"
  echo "==> packaging current working tree"
  ( cd "$REPO_ROOT" && npm run package:vsix -- --out "$VSIX" >/dev/null ) || {
    echo "packaging failed" >&2; exit 1; }
fi

echo "==> preparing throwaway profile at $BASE"
rm -rf "$BASE/ext" "$BASE/data" "$WS"
mkdir -p "$BASE/ext" "$BASE/data/User" "$WS/.vscode"

# deleteSettingsFileUponExit is machine-scoped, so it only takes effect from
# User settings. Without it the shutdown half of this test would be a no-op.
printf '{\n  "windowColors.deleteSettingsFileUponExit": true\n}\n' > "$BASE/data/User/settings.json"

# One workspace exercising every awkward case at once: a comment, tab indents,
# a trailing comma, a legacy emoji key needing migration, and a complete 1.2.10
# light-mode palette. Activation must preserve the activity/active-title anchors
# while automatically migrating the old inactive-title and status layout.
cat > "$SETTINGS" <<'JSON'
{
	// Team note: this comment must survive.
	"editor.insertSpaces": false,
	"windowColors.🌈 Theme": "light",
	"workbench.colorCustomizations": {
		"activityBar.background": "#610606",
		"activityBar.foreground": "#E7DADA",
		"activityBar.inactiveForeground": "#E7DADA",
		"titleBar.activeBackground": "#F89C9C",
		"titleBar.activeForeground": "#000000",
		"titleBar.inactiveBackground": "#F56767",
		"titleBar.inactiveForeground": "#000000",
		"statusBar.background": "#740808",
		"statusBar.foreground": "#F3EBEB",
		"statusBar.debuggingBackground": "#740808",
		"statusBar.debuggingForeground": "#F3EBEB",
		"statusBar.noFolderBackground": "#740808",
		"statusBar.noFolderForeground": "#F3EBEB",
	},
}
JSON

echo "==> installing $VSIX"
run_vscode "$CODE_CLI" --extensions-dir "$BASE/ext" --user-data-dir "$BASE/data" \
  --install-extension "$VSIX" 2>&1 | grep -iE "successfully|error" || true

echo "==> opening a window"
run_vscode "$ELECTRON" --extensions-dir "$BASE/ext" --user-data-dir "$BASE/data" \
  --disable-workspace-trust --skip-welcome --skip-release-notes --disable-updates \
  --new-window "$WS" >"$BASE/launch.log" 2>&1 &

# Poll rather than sleep a fixed time: activation speed varies by machine. The
# fixture already contains every color key, so color presence cannot prove that
# activation ran; disappearance of the legacy setting can.
for _ in $(seq 1 60); do
  ! grep -q "windowColors.🌈 Theme" "$SETTINGS" 2>/dev/null && break
  sleep 1
done

echo "==> after activation"
check "comment preserved"                 '// Team note' present
check "tab indentation preserved"         $'\t"editor.insertSpaces"' present
check "unrelated setting preserved"       '"editor.insertSpaces": false' present
check "legacy emoji key migrated away"    'windowColors.🌈 Theme' absent
check "migrated to modern key"            '"windowColors.theme": "light"' present
check "existing colour preserved exactly" '"activityBar.background": "#610606"' present
check "active title preserved exactly"    '"titleBar.activeBackground": "#F89C9C"' present
check "foregrounds generated"             '"activityBar.foreground"' present
check_equal_colors "inactive bar backgrounds exactly match" \
  activityBar.background titleBar.inactiveBackground statusBar.background \
  statusBar.debuggingBackground statusBar.noFolderBackground
# The undimmed bars share one foreground outright.
check_equal_colors "undimmed inactive bar foregrounds exactly match" \
  activityBar.foreground activityBar.inactiveForeground \
  statusBar.foreground statusBar.debuggingForeground statusBar.noFolderForeground
# The title bar must NOT match them. VS Code applies
# `.part.titlebar.inactive > * { opacity: .6 }`, so an identical hex renders
# about half as strong as its neighbours; it carries a brighter value that
# lands in the same place only after that dimming.
check "inactive title foreground compensated for VS Code dimming" \
  '"titleBar.inactiveForeground": "#FFFFFF"' present

echo "==> closing the window cleanly (triggers dispose)"
MAIN=$(ps -eo pid,command | grep -F "$BASE/data" | grep -v grep \
       | grep "MacOS/Electron" | grep -v "Helper" | awk '{print $1}' | head -1)
if [ -n "$MAIN" ]; then
  kill -TERM "$MAIN"
  for _ in $(seq 1 30); do
    ps -p "$MAIN" >/dev/null 2>&1 || break
    sleep 1
  done
else
  echo "  FAIL  could not find the isolated instance to close"
  failures=$((failures + 1))
fi

echo "==> after clean close"
if [ ! -f "$SETTINGS" ]; then
  echo "  FAIL  settings file was deleted despite still holding user content"
  failures=$((failures + 1))
else
  check "comment still preserved"        '// Team note' present
  check "unrelated setting preserved"    '"editor.insertSpaces": false' present
  check "extension setting preserved"    '"windowColors.theme": "light"' present
  check "managed colours removed"        '"activityBar.background"' absent
  check "emptied colour block removed"   'workbench.colorCustomizations' absent
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "extension-host smoke test PASSED"
  rm -rf "$BASE"
  exit 0
fi
echo "extension-host smoke test FAILED ($failures check(s)); profile kept at $BASE"
exit 1
