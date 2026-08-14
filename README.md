# Downly

Downly is a private, local-first Chrome download manager. It adds a side panel
for active and recent downloads, a full manager for history work, search,
filters, grouping, statistics, possible duplicate detection, and Smart Organizer
rules for routing new downloads into predictable folders.

## Repository layout

- `extension/chrome` - Chrome extension source, tests, build, and packaging.
- `docs` - static GitHub Pages site.
- `extension/inne-przegladarki` - notes for future browser ports.

## Requirements

- Node.js 24.
- npm.
- Chrome or Chromium 123 or newer for loading the built extension.
- `zip` and `unzip` for release packaging validation.

## Development

```bash
cd extension/chrome
npm ci
npm run dev
```

## Quality checks

```bash
cd extension/chrome
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The E2E suite launches Chromium with the built extension. On Linux CI it runs
under Xvfb because the extension tests use headed Chromium.

## Build and install locally

```bash
cd extension/chrome
npm ci
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose Load unpacked,
and select `extension/chrome/dist`.

## Package a release zip

```bash
cd extension/chrome
npm run build
npm run package
```

The package script writes `extension/chrome/artifacts/downly-chrome-<version>.zip`.
The zip is created from the contents of `extension/chrome/dist`, so its root
contains `manifest.json` directly rather than an extra `dist/` directory.

## Chrome permissions

Downly currently requests only these permissions:

- `downloads` to read and manage Chrome download records.
- `downloads.open` to open a completed download after a user action.
- `downloads.ui` to optionally replace Chrome's native downloads UI.
- `storage` to keep settings and Smart Organizer rules in local Chrome storage.
- `sidePanel` to show the side panel.

There are no host permissions, no browsing-history permission, no backend calls,
and no analytics calls.
