## Validation commands (run after edits)

You MUST run the relevant checks below after every code change, even for seemingly simple edits:

```bash
# Type check
npx tsc --noEmit
```

## Permissions
Allowed without asking: read files, tsc --noEmit
Ask first: npm install, vsce package, git push, deleting files

## Colour model work

`HANDOFF_color_v2.md` is the entry point for the contrast/palette work
(issues #58, #69, #70, #71, #73). Read it before touching `deriveThemedColors`
or `BASE_COLORS` in `src/extension.ts`.

Design instruments (not shipped — excluded via `.vscodeignore`):

```bash
python3 tools/audit_contrast.py      # audits the CURRENT v1.2.9 algorithm
python3 tools/palette_lab.py         # audits the PROPOSED v2 model
python3 tools/palette_lab.py --frontier   # contrast-vs-bar-lightness curve
python3 tools/build_preview.py       # regenerates palette_preview.html
```

Both audit scripts exit non-zero on failure, so they can gate CI.
