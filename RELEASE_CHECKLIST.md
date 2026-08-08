# Release checklist

## Purpose

Publish the foreground-contrast fix without changing existing workspace
backgrounds. This checklist owns release mechanics only; color behavior is owned
by `src/color_model.ts` and its tests.

## Release invariants

- Existing background strings remain byte-for-byte unchanged during upgrade.
- Every foreground generated for an opaque background clears WCAG AA (4.5:1)
  against that exact background; translucent backgrounds retain their existing
  foreground.
- No vividness setting, OKLCH/APCA runtime, or parallel palette implementation.
- Publishing credentials stay outside the repository and its history.

## Before packaging

- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm audit` and resolve runtime or release-tooling vulnerabilities.
- [ ] Confirm the GitHub `CI` workflow is green on the release commit.
- [ ] Review `git diff` and update the version and changelog.

## Package and registry dry runs

- [ ] Re-check the current official VS Code Marketplace and Open VSX publishing
      documentation; authentication requirements can change:
      [VS Code Marketplace](https://code.visualstudio.com/api/working-with-extensions/publishing-extension),
      [Open VSX](https://github.com/EclipseFdn/open-vsx.org/wiki/Publishing-Extensions).
- [ ] Run `npm run package:vsix -- --out <path>` without publishing and inspect
      its file list.
- [ ] Install the VSIX into an isolated VS Code profile and run an automated
      extension-host migration test before any registry write:
      `scripts/smoke_extension_host.sh [path/to/extension.vsix]`. It opens a real
      window against a deliberately awkward settings.json, then closes it
      cleanly to exercise shutdown cleanup. Unit tests stub the `vscode` module
      and cannot cover either path.
- [ ] Confirm the canonical publisher/namespace is `stuart` in both registries.
- [ ] Keep the duplicate `stuartcrobinson` Open VSX namespace cleanup separate
      from the release itself.
- [x] Operator confirmed the Open VSX account is linked to the matching Eclipse
      account and the Open VSX Publisher Agreement is signed.
- [x] Reuse the existing repository Actions secret named `OVSX_TOKEN`. The
      workflow maps it to the CLI's supported `OVSX_PAT` environment variable and
      never places the token on the command line. GitHub does not expose secret
      values, so the next publish remains the definitive token-validity check.

## Publish

- [ ] Supply Marketplace and Open VSX credentials through the local environment
      or the registry's supported federated workflow; never write tokens to a
      tracked file.
- [ ] Use Microsoft Entra workload identity federation for automated Marketplace
      publishing; Azure DevOps global PATs retire on December 1, 2026.
- [ ] Publish a GitHub release whose tag exactly matches `v<package version>`;
      `.github/workflows/publish_ovsx.yml` will test, package, retain, and publish
      that exact VSIX to Open VSX.
- [ ] Publish that same retained VSIX to the VS Code Marketplace.
- [ ] Verify the version and extension identity from both public registry pages.
- [ ] Tag the exact published commit and record the registry URLs in the release.
