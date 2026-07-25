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
- Every generated foreground must clear WCAG AA contrast (4.5:1).
- Keep validation in TypeScript against the shipping implementation; do not add
  a parallel palette engine in another language.

See `RELEASE_CHECKLIST.md` for the remaining marketplace work.
