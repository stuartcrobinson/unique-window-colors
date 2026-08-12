# Change Log
All notable changes to the "unique-window-colors" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.11] - 2026-08-08

- Keep the window title readable while a window is unfocused. VS Code draws it
  inside the command center, which paints its text with `commandCenter.foreground`
  whether or not the window has focus, so the title kept its active colour after
  the bar turned dark and became unreadable. The command center is now given its
  own background and matching foregrounds, which stay legible in both states.
- Compensate for the opacity VS Code forces on inactive title bars. Its
  stylesheet dims their contents to 60%, so a foreground written to match the
  other bars rendered at roughly half their strength — on a dark blue bar,
  10.1:1 landed as 4.5:1 and read as unlit. The value written for
  `titleBar.inactiveForeground` is now raised so that what reaches the screen
  sits as close to the neighbouring bars as the sRGB range allows.
- Even out bar contrast within a window. Foregrounds previously used pure white
  or pure black, leaving contrast at the mercy of the background: a dark
  activity bar could glare while a lighter title bar looked washed out. Colors
  generated for the presets now range from 7.0:1 to 10.1:1 rather than 4.9:1 to
  16.7:1. Mid-luminance hues, where neither black nor white has much room, trade
  a little vividness for legibility. Existing custom backgrounds remain
  unchanged, while their foregrounds refresh on activation.
- Quiet inactive windows by giving the inactive title, activity, and status bars
  identical generated backgrounds and foregrounds. Existing opaque workspaces
  migrate their saved inactive-title and status roles automatically; no Reset
  command is required. Activity and active-title backgrounds remain unchanged.
- Read `.vscode/settings.json` as JSONC, which is what VS Code accepts there.
  Comments and trailing commas no longer stop the extension from reading a
  workspace's existing colors, cleaning them up when a window closes, or running
  **Remove Colors from This Window**. Reported in issue #75.
- Keep existing colors stable for workspaces whose settings file has comments.
  Reading those files failed silently, defeating the safeguard that prevents a
  window's color changing on upgrade. Related to issue #71.
- Edit the settings file in place, so comments, indentation, and line endings
  survive any change the extension makes.
- Leave a damaged settings file untouched, and never delete one that still holds
  a comment.
- Handle settings files saved with a byte order mark, written when
  `files.encoding` is `utf8bom`, and preserve the mark on write.
- Raise the minimum supported VS Code version to 1.56 (May 2021), the first
  release bundling Node.js 14, which the new JSONC parser requires. The
  Marketplace continues to offer 1.2.10 to anyone on an earlier VS Code.
- Document the VS Code modern UI regression that makes the title bar, activity
  bar, and status bar ignore color customizations, along with the
  `workbench.experimental.modernUI` workaround. Reported in issue #74.

## [1.2.10] - 2026-07-27

- Preserve existing workspace background colors across extension updates, even
  when their original base color is no longer in the preset palette.
- Recompute title-bar, activity-bar, and status-bar foregrounds against the
  exact opaque background where each foreground is rendered; translucent
  backgrounds retain their current foreground because their final composited
  color is theme-dependent.
- Add activity-bar foreground colors and WCAG AA regression coverage.
- Remove managed color keys safely without deleting unrelated workspace settings.
- Stop deleting `.vscode/settings.json` when a window closes. Earlier versions
  removed the file whenever it held nothing but generated colors, even with
  **Delete Settings File Upon Exit** turned off, which discarded each window's
  colors on every close. Removal now happens only when that setting is enabled.
- Recover existing backgrounds from the workspace settings file when the
  configuration API reports none, which can happen on the first activation
  after an update.
- Ignore an unusable `windowColors.baseColor` and fall back to the window's
  generated color, instead of leaving the window with no colors at all.
- Make `windowColors.deleteSettingsFileUponExit` machine-scoped so it can only be
  enabled from User Settings; a workspace can no longer switch on removal of its
  own settings file.
- Declare the MIT license required by Open VSX and add release-triggered Open
  VSX publishing for the canonical `stuart` namespace.
