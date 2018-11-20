# Window Colors

Uniquely and automatically colors each VSCode window.

See settings for "Unique Window Colors: Theme" to match Dark vs Light themes.

<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/darkExample.png" alt="drawing" width="200"/> &nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/lightExample.png" alt="drawing" width="200"/>


## How it works

When you open a folder in a new VSCode window, this extension picks some colors based on a hash of that folder's name.

Those colors are then saved in .vscode/settings.json.  You might want to add .vscode to .gitignore.  These settings get overwritten per VSCode window load.

Workspaces containing multiple root folders are not currently supported by this extension.  The current behavior for multi-folder workspaces is that the workspace color settings will be set by the first window opened, and can be saved in the workspace's .code-workspace configuration file.

When opening new VSCode windows, you might see the relevant theme colors change as they are updated to the new workspace.  This is normal:

<img src="https://github.com/stuartcrobinson/unique-window-colors/blob/master/colorflicker.gif?raw=true" alt="drawing" width="200"/>
<br><br>
<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/liveExample.png" alt="drawing" width="600"/>

## Removal

After disabling or uninstalling this extension, removing these settings will return your window to the default theme:

`.vscode/settings.json:`
```javascript
 "workbench.colorCustomizations": {
      "activityBar.background": "#...",
      "titleBar.activeBackground": "#...",
      "titleBar.activeForeground": "#..."
    }
```


## Credits

Hashing and color generation functions adapted from https://www.designedbyaturtle.co.uk/convert-string-to-hexidecimal-colour-with-javascript-vanilla/ by Edd Turtle.

Workspace root folder detection function adapted from https://itnext.io/how-to-make-a-visual-studio-code-extension-77085dce7d82 by Van Huynh.