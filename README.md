<div>
  <span>
    <img style="vertical-align: middle;" src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/icon_406.png" width="60" />
  </span>
  <span style="font-size:35px;vertical-align:middle;font-weight:bold;margin-left:10px">
    Window Colors
  </span>
</div>
<hr>


Uniquely and automatically colors each VSCode window.

<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/darkExample.png" alt="drawing" width="200"/> &nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/lightExample.png" alt="drawing" width="200"/>


See settings for `Window Colors: Theme` to match Dark vs Light themes.

<img src="https://github.com/stuartcrobinson/unique-window-colors/blob/master/img/settings.png?raw=true" alt="drawing" width="300"/>



## How it works

When you open a folder in a new VSCode window, this extension picks some colors based on a hash of that folder's name.

Those colors are then saved in `.vscode/settings.json`.  You might want to add .vscode to .gitignore.  

If you don't like the colors picked by this extension, you can change them in `.vscode/settings.json`.  They don't get overwritten, so you have to either manually delete them, or select `revert` in the extension `Window Colors: Theme` settings and reload first in order to switch between `light` and `dark`.

Workspaces containing multiple root folders are not currently supported by this extension.  The current behavior for multi-folder workspaces is that the workspace color settings will be set by the first window opened, and can be saved in the workspace's `<workspace-name>.code-workspace` configuration file.

When opening new VSCode windows, you might see the relevant theme colors change as they are updated to the new workspace.  This is normal:

<img src="https://github.com/stuartcrobinson/unique-window-colors/blob/master/img/colorflicker.gif?raw=true" alt="drawing" width="200"/>
<br><br>
<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/liveExample.png" alt="drawing" width="600"/>

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