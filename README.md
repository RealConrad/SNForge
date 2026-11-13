# SNForge

SNForge is a Chrome Manifest V3 command palette for ServiceNow administrators.

## First-run slice

- On an HTTPS `*.service-now.com` tab, press **Ctrl+Shift+Space** to open or close the
  palette. The shortcut does nothing in other tabs and never opens a separate window.
- If the extension was installed or reloaded while a ServiceNow tab was already open,
  the shortcut injects its scripts into that matching tab when pressed.
- Rebind the shortcut at `chrome://extensions/shortcuts` if it conflicts with another
  shortcut.
- Choose Tokyo, Midnight, or Obsidian from the theme selector. The choice is saved
  locally and restored on page reload.
- The palette is gated to users with the ServiceNow `admin` role.

## Development

- `npm install` installs the small set of allowed development dependencies.
- `npm run typecheck` checks the TypeScript sources.
- `npm run build` creates the unpacked extension under `dist/`.

Load the `dist/` directory at `chrome://extensions` with Developer mode enabled.