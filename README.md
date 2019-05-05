# Window Colors


![Window Colors Icon](img/icon_50_short.png 'Window Colors') &nbsp;&nbsp;Uniquely color each VSCode workspace window with automatic selections or customized colors and themes.




&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/live_dark_screenshot.png" alt="drawing" width="330"/> &nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/live_light_screenshot.png" alt="drawing" width="330"/>

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/scrollHueFast.gif?" alt="drawing" width="330"/>&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/setTheme.gif?" alt="drawing" width="330"/>

## Use the **Command Palette** to interact with Window Colors:
* Mac: Cmd+Shift+P
* Win: Ctrl+Shift+P
* Menu: View ⟶ Command Palette

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/commandPalette.png?" alt="drawing" width="330"/>

# Usage

## **Outline**

* Automatic Colors
  - Let Window Colors pick a coloration to match your current theme
  - Set a portfolio of colorations to be randomly selected from
* Manual Colors
  - Select a coloration from a portfolio
  - Set your own colors
    - Enter hex or html name
    - Scroll through hues, saturations, and lightnesses
* Set Modified Areas (title bar, activity bar, status bar)
  - User/global settings only
* Set Theme
* Edit Any Theme Element Color
* Animated Colors (experimental)
* Save Colorations to Portfolios
* What if I'm colorblind?
* Uninstall

Note:
 - This extension saves workspace colors globally to avoid cluttering the filesystem with color settings files.
 - You don't need to "save your workspace configuration as a file".
 - This extension expects workspaces to have a single root folder only.  Some features might still work with multiple folders.


## **AUTOMATIC COLORS**

### ~ **Let Window Colors pick a coloration to match your current theme** ~

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/dark.png?" alt="drawing" width="330"/>&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/newLight.png?" alt="drawing" width="330"/>

### ~ **Set a portfolio of colors to be randomly selected from** ~

_Command Palette:_ 🌈 Window Colors: Automatic Colors ⟶ Portfolios ⟶ &lt;select a portfolio&gt;

This will color the current and all future workspaces with a random portfolio coloration.

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/automatic.gif?" alt="drawing" width="330"/>


## **MANUAL COLORS**

###  ~ **Select a coloration from a portfolio** ~ 

_Command Palette:_ 🌈 Window Colors: Library ⟶ Load Colors ⟶ &lt;select a portfolio&gt; ⟶ &lt;use keyboard arrows to select a coloration&gt;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/loadColorsScroll.gif?" alt="drawing" width="330"/>

###  ~ **Set your own colors** ~ 

**Enter hex or html name**

_Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Base Color ⟶ Enter color

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/enterColor.gif?" alt="drawing" width="330"/>

**Scroll through hues, saturations, and lightnesses**

_Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Base Color ⟶ Select **color**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/scrollHueFast.gif?" alt="drawing" width="330"/>

_Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Base Color ⟶ Select **saturation**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/saturationScroll.gif?" alt="drawing" width="330"/>

_Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Base Color ⟶ Select **lightness**

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/scollLightness.gif?" alt="drawing" width="330"/>


## **SET MODIFIED AREAS**

Toggle these settings via Menu Bar ⟶ Code ⟶ Preferences ⟶ Settings.

    windowColors.ModifyTitleBar
    windowColors.ModifyActivityBar
    windowColors.ModifyStatusBar

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/modifyGlobal.gif" alt="drawing" width="330"/>


## **SET THEME**

_Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Set Theme

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/setTheme.gif?" alt="drawing" width="330"/>


## **EDIT THEME COLORS**

_Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Custom Element Color ⟶ &lt;use keyboard arrow keys to scroll&gt;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/customColors.gif?" alt="drawing" width="330"/>


## **ANIMATED COLORS**

_Command Palette:_ 🌈 Window Colors: Animate 📽 (Beta) ⟶ Enter gradient colors

Entering "blue red" will animate the Window Colors base color to shift between blue and red over `windowColors.animationStepsPerTransition` steps that change every `windowColors.animationMillisecondsPerStep` milliseconds.  (Those are settings you can edit via Code⟶Preferences⟶Settings)

Colors will probably flicker as the animation begins.  Increase `animationMillisecondsPerStep` if flickering continues.

Notes: 
- Colors change pretty slowly.  You can watch them changing in `.vscode/settings.json` to confirm animation is active.
- Font/foreground colors don't change with animations.  So you will want to animate between colors with a similar darkness, and possibly set your own foreground color for it.

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/animateFast.gif?" alt="drawing" width="330"/>


&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/animations_on_white_compressed.gif" alt="drawing" width="230"/>



## **SAVE COLORATIONS TO PORTFOLIOS**

_Command Palette:_ 🌈 Window Colors: Library ⟶ Save Colors ⟶ &lt;select a portfolio&gt; ⟶ &lt;enter new coloration name&gt;

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/saveAndLoad.gif?" alt="drawing" width="330"/>


## **PORTFOLIO PRESETS**

Some of the provided portfolio colors:

<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/dusty.png" alt="drawing" width="330"/>&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/dark.png" alt="drawing" width="330"/>

<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/sk8r-on-white.png" alt="drawing" width="330"/>&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/black_on_white.png" alt="drawing" width="330"/>

<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/light.png" alt="drawing" width="330"/>&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/pastel.png" alt="drawing" width="330"/>


## **What if I'm colorblind?**

- Scroll through the colorations in the **"Grayscale"** portfolio:

  -  _Command Palette:_ 🌈 Window Colors: Library ⟶ Load Colors ⟶ Grayscale

- or install it as the default automatic coloration portfolio:

  - _Command Palette:_ 🌈 Window Colors: Automatic Colors ⟶ Portfolios ⟶ Grayscale

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/grayscale.png?" alt="drawing" width="330"/>

Alternatively, **create your own portfolio and add custom colors to it:**

1. Create portfolio:
    -  _Command Palette:_ 🌈 Window Colors: Library ⟶ New Portfolio

2.  Add color by html name or hex value:
    -  _Command Palette:_ 🌈 Window Colors: Set Colors ⟶ Base Color ⟶ Enter color

3. Save the current color:
    -  _Command Palette:_ 🌈 Window Colors: Library ⟶ Save Colors ⟶ &lt;select a portfolio&gt; ⟶  &lt;enter new color name&gt;

4. Set your new portfolio as the source for automatic workspace colors:
    - _Command Palette:_ 🌈 Window Colors: Automatic Colors ⟶ Portfolios ⟶ &lt;your new portfolio&gt;


Feel free to [open an issue](https://github.com/stuartcrobinson/unique-window-colors/issues) to suggest a portfolio of colors that works better for you!



## **UNINSTALL**

To uninstall Window Colors, first delete all the stored colors and settings.  If you uninstall the application while workspaces are colored, those colors will stick around.

_Command Palette:_ 🌈 Window Colors: Remove Colors ⟶ Portfolios ⟶ Remove ALL WINDOWS COLORS DATA


&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<img src="https://raw.githubusercontent.com/stuartcrobinson/windowsColorsImages/master/img/uninstall2.gif?" alt="drawing" width="330"/>




# Roadmap

Check out the [open issues](https://github.com/stuartcrobinson/unique-window-colors/issues) on GitHub and feel free to jump in! 🌊

# Feedback

Is encouraged!  [Open an issue](https://github.com/stuartcrobinson/unique-window-colors/issues) or [leave a review](https://marketplace.visualstudio.com/items?itemName=stuart.unique-window-colors&ssr=false#review-details). 🙏


# Credits

### ✨ **Special thanks to:** ✨
- **Edd Turtle:** [hashing and color generation functions](https://www.designedbyaturtle.co.uk/convert-string-to-hexidecimal-colour-with-javascript-vanilla/) used in earlier Window Colors versions.
- **Van Huynh:** [workspace root folder detection](https://itnext.io/how-to-make-a-visual-studio-code-extension-77085dce7d82).
- Invaluable feedback and support from Zach Bradshaw, Ross Jernigan, Cody Braun, [Pascal Mathys](https://github.com/rootix), [John Rodler](https://github.com/jrodl3r), [Pedro Gomes](https://github.com/azynheira), [Jason Swearingen](https://github.com/jasonswearingen), [Nicolas Delsaux](https://github.com/Riduidel), [Nigel G.](https://github.com/nigelgilbert), [Lenin Zapata](https://github.com/LeninZapata), [kaanuki](https://github.com/kaanuki), [Vilem](https://github.com/buggymcbugfix), [Werner Hahn](https://github.com/musiKk), [Lizz](https://github.com/innerlee), [Nils Borgböhmer](https://github.com/nilsborg), [Derek Petersen](https://github.com/tuxracer), [Álvaro González](https://github.com/kAlvaro), [Joshua Cruz](https://github.com/Josh-Cruz), [Gaspar Sabater](https://github.com/gsabater), and [Kenneth Auchenberg](https://github.com/auchenberg).


<img style="vertical-align: middle;" src="https://raw.githubusercontent.com/stuartcrobinson/unique-window-colors/master/img/icon_602.png" width="60" />