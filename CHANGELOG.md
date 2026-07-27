# Change Log
All notable changes to the "unique-window-colors" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.2.10] - 2026-07-27

- Preserve existing workspace background colors across extension updates, even
  when their original base color is no longer in the preset palette.
- Recompute title-bar, activity-bar, and status-bar foregrounds against the
  exact opaque background where each foreground is rendered; translucent
  backgrounds retain their current foreground because their final composited
  color is theme-dependent.
- Add activity-bar foreground colors and WCAG AA regression coverage.
- Remove managed color keys safely without deleting unrelated workspace settings.
- Ignore an unusable `windowColors.baseColor` and fall back to the window's
  generated color, instead of leaving the window with no colors at all.
- Make `windowColors.deleteSettingsFileUponExit` machine-scoped so it can only be
  enabled from User Settings; a workspace can no longer switch on removal of its
  own settings file.
- Declare the MIT license required by Open VSX and add release-triggered Open
  VSX publishing for the canonical `stuart` namespace.
