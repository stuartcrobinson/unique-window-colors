## Validation commands (run after edits)

You MUST run the relevant checks below after every code change, even for seemingly simple edits:

```bash
# Unit tests for color behavior and persistence
npm test

# Type check
npx tsc --noEmit
```

## Permissions
Allowed without asking: read files, tsc --noEmit
Ask first: npm install, vsce package, git push, deleting files

## Colour model work

`src/color_model.ts` is the single owner for foreground derivation, contrast,
and background snapshot/restore behavior. `src/extension.ts` continues to own
background generation for new workspaces.

Preserve these invariants:

- Existing background strings are authoritative and must not be replaced on
  activation or upgrade, even when they are absent from `BASE_COLORS`.
- Foregrounds are derived from the exact background role where they are used.
- Every foreground generated for an opaque background must clear WCAG AA
  contrast (4.5:1). Preserve the current foreground for translucent backgrounds.
- Foregrounds target a fixed contrast rather than the strongest available, and
  generated backgrounds keep enough headroom to reach it. Always using pure
  black or white left contrast at the mercy of the background, so bars in one
  window ranged from 4.9:1 to 16.7:1 and looked mismatched.
- Keep validation in TypeScript against the shipping implementation; do not add
  a parallel palette engine in another language.

## Workspace settings files

`src/settings_cleanup.ts` is the single owner for this extension's own keys in
workspace settings: which colours are managed, their removal, and legacy key
migration. It must preserve unrelated settings.

`src/settings_document.ts` is the single owner for reading and editing
`.vscode/settings.json`. That file is JSONC, not JSON: comments and trailing
commas are legal and common. Preserve these invariants:

- Never parse the settings file with `JSON.parse`, and never write it back with
  `JSON.stringify`; both discard the user's comments and formatting.
- Edits splice an exact source range. `jsonc-parser` supplies the scanner and
  AST, but its `modify`/`applyEdits` are deliberately unused: with formatting
  they reflow untouched siblings, and without it they collapse the newline
  after the opening brace.
- A file that fails to parse is left untouched. The tolerant parser still
  returns a value for a truncated file, so the parse-error list decides.
- A file is only deleted when no settings *and* no comments remain.
- A byte order mark is split off before parsing and restored on write.
- Finding the comma that separates two properties must step over comments as
  well as whitespace, or the comma is left behind and the file no longer parses.

Tests for this module are property-based (`test/settings_document_fuzz.test.ts`)
and assert coverage minimums, because the comma bug above survived an earlier
fuzz suite whose generator never produced that layout. If a change makes those
minimums fail, fix the generator rather than lowering the threshold.

## Runtime floor

`engines.vscode` is `^1.56.0` because that is the first VS Code whose extension
host runs Node 14, which the bundled JSONC parser requires. Before adding or
upgrading a runtime dependency, check the syntax level of the code it actually
loads: an entry point may eagerly require modules you never call, and a syntax
error there takes down the whole extension rather than one feature. The
`engine-floor` CI job enforces this by parsing every shipped file on Node 14.

## Extension-host smoke test

`scripts/smoke_extension_host.sh` is the only check that runs the extension in a
real VS Code; unit tests stub the `vscode` module, so activation and shutdown
cleanup are invisible to them. Run it before any release.

Three environment variables and one path-length limit make it fail in ways that
look like the extension is broken. The script header documents each one and the
script works around all of them; do not "simplify" those away.

## Releasing

See `RELEASE_CHECKLIST.md` for the remaining marketplace work.
Use `npm run package:vsix -- --out <path>` for package dry runs. Open VSX
publishing is owned by `.github/workflows/publish_ovsx.yml`; the canonical
namespace is `stuart`, and the workflow must never recreate a namespace.
