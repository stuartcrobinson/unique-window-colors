# Change Log
All notable changes to the "unique-window-colors" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.11] - 2026-08-08

- Aim generated foregrounds at a consistent contrast ratio instead of always
  using pure white or pure black. Contrast used to be whatever the background
  happened to give, ranging from 4.9:1 to 16.7:1, so bars within one window did
  not match: a very dark activity bar glared under pure white while a lighter
  title bar looked washed out. Across the presets the range is now 4.9:1 to
  10.1:1, and the gap between bars in the same window fell from as much as
  4.0 to 0.4 in the worst reported case. Every foreground still clears WCAG AA.
- Keep generated bar backgrounds out of the low-contrast dead zone. Mid-luminance
  hues — the yellows, olives, oranges, rusts and browns — sit where neither black
  nor white has much contrast, so a bar could land at 4.9:1: legal, but visibly
  dim beside the other bars in the same window. Those backgrounds now move far
  enough from the middle for a 7:1 foreground, which costs a little vividness and
  buys legibility. Generated colors only; a workspace's existing colors are
  untouched. Across the presets contrast now spans 7.0:1 to 10.1:1.

- Treat `.vscode/settings.json` as JSONC, which is what VS Code accepts there.
  Comments and trailing commas no longer stop the extension from reading a
  workspace's existing colors, from cleaning them up when a window closes, or
  from running **Remove Colors from This Window**. Reported in issue #75.
- Recover existing backgrounds from settings files that use comments. Reading
  them previously failed silently, which defeated the safeguard that keeps a
  workspace's colors stable across updates and could let a window's color
  change on upgrade. Related to issue #71.
- Edit the settings file in place instead of rewriting it, so comments,
  indentation style, and line endings survive any change the extension makes.
- Never delete a settings file that still holds a comment, and never write to
  one that cannot be parsed; a damaged file is now left exactly as it is.
- Handle settings files saved with a byte order mark, which VS Code writes
  whenever `files.encoding` is `utf8bom`. These were unreadable for the same
  reason commented files were, and the mark is preserved when the file is
  edited so the file's encoding does not change underneath the user.
- Run the test suite on Windows, macOS, and Linux, and verify that every
  shipped file parses on the oldest supported VS Code runtime.
- Raise the minimum supported VS Code version to 1.56 (May 2021), the first
  release bundling Node.js 14. The JSONC parser this version depends on uses
  syntax that older releases cannot load. The Marketplace continues to offer
  1.2.10 to anyone on an earlier VS Code.
- Assert the settings-file editing rules against thousands of generated
  documents covering mixed indentation, CRLF, comment placement, trailing
  commas, and truncation at every byte offset.
- Document the VS Code 1.131 modern UI regression that makes the title bar,
  activity bar, and status bar ignore color customizations, along with the
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
