# Change Log

## [1.2.0] - 2026-02-22
### Added
- "Remove Colors from This Window" command (`Window Colors: Remove Colors from This Window`) — removes all extension-managed color settings from `.vscode/settings.json` and deletes the file (and `.vscode/` dir) if they become empty
- Same option available in the Window Colors Settings quick pick menu

## [1.1.0] - 2026-02-22
### Fixed
- Inactive title bars now show the window's unique color instead of the default VSCode color

### Added
- Status bar (bottom bar) coloring — enable via `ColorStatusBar` and `ColorStatusBarAllStates` settings
- Color picker command (`Window Colors: Set Base Color`) for interactively choosing a window color
