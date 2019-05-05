
`internalSettings` stores the instructions for how to generate the background and foreground colors for the title bar, activity bar, and status bar.

when `internalSettings` is changed, this triggers `onConfigChange()` which updates the `workbench.colorCustomizations`, a VSCode object in ./.vscode/settings.json

start with `activate(context)` in `extension.ts`

