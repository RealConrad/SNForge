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

SNForge is for ServiceNow admins. If you press the shortcut without the `admin` role, a
short message tells you so and the palette stays closed.

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

## Commands

Commands start with `:`.

| Command | Description |
|---|---|
| `:help` (`:docs`) | Open this page |
| `:nav` (`:navbar`, `:shell`, `:polaris`) | Reload the current classic page inside the Next Experience navigation |
| `:fd` (`:flow`, `:flowdesigner`) | Open Flow Designer in a new tab |
| `:st` (`:studio`) | Open ServiceNow Studio in a new tab |
| `:lang <code>` (`:language`, `:locale`) | Change your session language, e.g. `:lang de` for German or `:lang fr` for French. The code must be a language installed on the instance; a wrong code shows the available ones |
| `:names` (`:fields`, `:tn`, `:technical`) | Show the technical name of every field under its label on a classic form or list; run again to hide |

## Themes

Click the SNForge icon in the Chrome toolbar to choose a theme (Tokyo, Midnight,
Obsidian). Open palettes update immediately.

## Permissions and privacy

SNForge asks for three permissions and no access to any website in advance:

| Permission | Why |
|---|---|
| `activeTab` | Lets SNForge work on the current tab only after you press the shortcut. Nothing runs on a page before that. |
| `scripting` | Adds the palette to that tab when you press the shortcut. |
| `storage` | Remembers your theme. |

It collects nothing and sends nothing anywhere; see [PRIVACY.md](PRIVACY.md). The
security model and how to report a vulnerability are in [SECURITY.md](SECURITY.md).

## Development

```
npm install
npm run build      # → dist/
npm run watch      # rebuild on change
npm run typecheck
```

Load `dist/` at `chrome://extensions` with Developer mode on ("Load unpacked").

## Release

```
npm ci             # exact versions from package-lock.json
npm run typecheck
npm run build      # clean build → dist/
```

Zip the contents of `dist/` for the Chrome Web Store. Never zip a `npm run watch` build:
it contains sourcemaps.
