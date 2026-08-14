# Downly in other browsers

Downly is implemented first for Chrome Manifest V3. This directory tracks future
portability constraints for other Chromium and WebExtension browsers.

| Browser | Expected status | Key constraints |
|---|---|---|
| Microsoft Edge | Likely portable after Chrome hardening | Edge supports MV3 and `chrome.downloads`, but native downloads UI replacement and side panel behavior must be verified separately. |
| Brave | Likely portable after manual QA | Brave is Chromium-based, but privacy features and download UI changes can alter extension behavior. |
| Opera | Needs investigation | Chromium APIs may exist, but sidebar conventions and extension store requirements differ. |
| Firefox | Not directly portable | Firefox WebExtensions differ from Chrome MV3 service workers, `downloads.ui`, and Chrome side panel APIs. A Firefox port needs adapter work and feature fallbacks. |
| Safari | Not directly portable | Safari Web Extensions require a different packaging and distribution flow, and Chrome-specific side panel/download UI APIs need replacements. |

## API portability notes

- `downloads` is the core capability and must be adapted per browser.
- `downloads.open` may need user-gesture and platform-specific verification.
- `downloads.ui` is Chrome-specific and should be optional or replaced.
- `sidePanel` is Chrome-specific and requires a browser-specific panel or popup fallback.
- `storage.local` is broadly portable, but migrations must be verified per target.
- Smart Organizer depends on deterministic filename suggestion hooks; every target
  browser needs E2E validation before release.

## Porting approach

Keep browser-specific code behind platform adapters. Preserve local-first
privacy behavior, avoid host permissions unless a target browser absolutely
requires them, and document any feature that becomes unavailable outside Chrome.
