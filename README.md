# SNForge

A keyboard command palette for ServiceNow admins. Press a hotkey on any ServiceNow
page, type a table name or command, press Enter.

## Opening the palette

| Key | Action |
|---|---|
| **Ctrl+Shift+Space** | Open / close (rebind at `chrome://extensions/shortcuts`) |
| **Enter** | Run the highlighted suggestion |
| **↑ / ↓** | Move between suggestions |
| **Tab** | Complete a command name |
| **Esc** | Close |

The palette only appears for users with the `admin` role, on `https://*.service-now.com`.

## Opening tables

Type a table name. **Lowercase opens in the current tab; any uppercase letter opens a
new tab.**

| Input | Opens |
|---|---|
| `incident` | Incident list |
| `INCIDENT` | Incident list in a new tab |
| `incident.list` | Incident list (explicit) |
| `incident active=true^priority=1` | List filtered by an encoded query |
| `incident.filter` | List with the filter builder open, no records loaded |
| `incident.filter active=true` | Filter builder pre-filled with a query |
| `incident.new` (or `incident.do`) | New incident form |
| `incident.new short_description=Printer^urgency=1` | New form with fields pre-filled |

The suffix and the new-tab rule combine: `incident.NEW` opens a new form in a new tab.

Tip: copy an encoded query from any list's breadcrumb (right-click → *Copy query*).

## Commands

Commands start with `:`.

| Command | Description |
|---|---|
| `:help` (`:docs`) | Open this page |

## Themes

Click the SNForge icon in the Chrome toolbar to choose a theme (Tokyo, Midnight,
Obsidian). Open palettes update immediately.

## Development

```
npm install
npm run build      # → dist/
npm run watch      # rebuild on change
npm run typecheck
```

Load `dist/` at `chrome://extensions` with Developer mode on ("Load unpacked").
See [CLAUDE.md](CLAUDE.md) for architecture rules and [CODE-GUIDE.md](CODE-GUIDE.md)
for a walkthrough of the code.
