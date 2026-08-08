# Window Colors

Uniquely and automatically colors each VSCode window.

<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/live_dark_screenshot.png" alt="drawing" width="330"/> &nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/live_light_screenshot.png" alt="drawing" width="330"/>

## What it does

This extension gives each new VS Code window a unique color based on a hash of the root directory name when it is opened.  It does this by immediately writing three colors to the following settings in `.vscode/settings.json`:

```javascript
  "workbench.colorCustomizations": {
    "activityBar.background": "#13332E",
    "activityBar.foreground": "#F6FBFB",
    "titleBar.activeBackground": "#19423B",
    "titleBar.activeForeground": "#F6FBFB"
  }
```

By default, the generated settings remain in the workspace so its background
colors stay stable across extension updates. If you enable **Delete Settings
File Upon Exit**, only Window Colors-managed color keys are removed when the
window closes; unrelated workspace settings are preserved.

You can optionally set a single Base Color (see Window Colors settings) by hex code or css color name.  

## Usage with Git

To avoid checking `.vscode/settings.json` in to your remote repository without modifying `.gitignore`, you can either:

1. **locally:** add `.vscode/settings.json` to your project's `.git/info/exclude` file

    _or_

2.  **globally:** create and use a global `.gitignore_global` file like so:

    ```git config --global core.excludesfile ~/.gitignore_global```

## Usage

Background colors do not get overwritten during routine activation. This allows
you to keep custom colors or select a Base Color with the command palette. To
regenerate backgrounds, use **Window Colors: Reset Colors in This Window**.

On extension updates, existing background colors remain unchanged even if their
old base color is no longer offered in the preset picker. Foreground colors are
automatically refreshed for readable contrast against opaque backgrounds.
Foregrounds on translucent backgrounds are left unchanged because their final
composited color depends on the active VS Code theme.

<!-- <img src="https://github.com/stuartcrobinson/unique-window-colors/blob/master/img/settings.png?raw=true" alt="drawing" width="500"/> -->

## Troubleshooting

### Colors are not visible on VS Code 1.131+

If every window suddenly renders with the default theme chrome, check whether
the new modern UI is switched on:

```javascript
  "workbench.experimental.modernUI": false
```

Reload the window after changing it.

VS Code's modern UI draws the title bar, activity bar, and status bar as
transparent surfaces, so `titleBar.activeBackground`, `activityBar.background`,
and `statusBar.background` have no visible effect — the editor background shows
through instead. This extension still writes the correct values to
`.vscode/settings.json`; VS Code just does not paint them.

This is easy to miss because the setting's default is `false`, yet it can be
switched on for you as part of a VS Code experiment. Nothing appears in your own
settings to explain the change.

Turning it off reverts the whole modern look, so it is a trade-off rather than a
fix. Upstream this is
[microsoft/vscode#326126](https://github.com/microsoft/vscode/issues/326126),
"Some color theme settings and color customizations are ignored in modern UI
mode", which is open and labelled a regression.

## Notes

Workspaces containing multiple root folders are not currently supported by this extension.  The current behavior for multi-folder workspaces is that the workspace color settings will be set by the first window opened, and can be saved in the workspace's `<workspace-name>.code-workspace` configuration file.

When opening new VSCode windows, you might see the relevant theme colors change as they are updated to the new workspace.  This is normal:

<img src="https://github.com/stuartcrobinson/unique-window-colors/blob/master/img/colorflicker.gif?raw=true" alt="drawing" width="200"/>

## Credits

Hashing and color generation functions adapted from https://www.designedbyaturtle.co.uk/convert-string-to-hexidecimal-colour-with-javascript-vanilla/ by Edd Turtle.

Workspace root folder detection function adapted from https://itnext.io/how-to-make-a-visual-studio-code-extension-77085dce7d82 by Van Huynh.



<br><br>
<img style="vertical-align: middle;" src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/icon_602.png" width="60" />
