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

`src/settings_cleanup.ts` is the single owner for removing managed color keys
from workspace settings. It must preserve unrelated settings.

Preserve these invariants:

- Existing background strings are authoritative and must not be replaced on
  activation or upgrade, even when they are absent from `BASE_COLORS`.
- Foregrounds are derived from the exact background role where they are used.
- Every foreground generated for an opaque background must clear WCAG AA
  contrast (4.5:1). Preserve the current foreground for translucent backgrounds.
- Keep validation in TypeScript against the shipping implementation; do not add
  a parallel palette engine in another language.

See `RELEASE_CHECKLIST.md` for the remaining marketplace work.
Use `npm run package:vsix -- --out <path>` for package dry runs. Open VSX
publishing is owned by `.github/workflows/publish_ovsx.yml`; the canonical
namespace is `stuart`, and the workflow must never recreate a namespace.
