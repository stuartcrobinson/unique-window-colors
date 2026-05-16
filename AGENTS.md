## Validation commands (run after edits)

You MUST run the relevant checks below after every code change, even for seemingly simple edits:

```bash
# Type check
npx tsc --noEmit
```

## Permissions
Allowed without asking: read files, tsc --noEmit
Ask first: npm install, vsce package, git push, deleting files
