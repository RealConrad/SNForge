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

## Finding a record by sys_id

Paste a sys_id into the palette and press Enter; SNForge finds which table it belongs to
and opens the record.

- It first asks the base tables that cover most records (configuration, tasks, CIs,
  users, groups, update sets and a few more), all at once. This normally answers in
  well under a second.
- If the record isn't there, it searches every other base table on the instance. This
  can take from a few seconds to a minute; the palette shows the progress, and `Esc`
  cancels.

When the slower search finds a record, SNForge remembers that table for the instance,
so the next sys_id from the same table is found straight away.

Tables that don't allow web service access can't be searched.

## Commands

Commands start with `:`.

| Command | Description |
|---|---|
| `:help` (`:docs`) | Open this page |
| `:nav` (`:navbar`, `:shell`, `:polaris`) | Reload the current classic page inside the Next Experience navigation |
| `:fd` (`:flow`, `:flowdesigner`) | Open Flow Designer in a new tab |
| `:st` (`:studio`) | Open ServiceNow Studio in a new tab |
| `:br [table]` (`:rules`, `:businessrules`) | Open the business rules of a table in a new tab. Without a table: the classic form or list you are on |
| `:cs [table]` (`:clientscripts`) | Open the client scripts of a table in a new tab. Without a table: the classic form or list you are on |
| `:log` (`:logs`, `:syslog`) | Open today's system log in a new tab |
| `:edit` (`:fieldedit`, `:unlock`) | Turn field edit on: triple-click a read-only field on a classic form to change its value. Run again to turn it off |
| `:find <sys_id>` (`:sysid`, `:id`) | Open the record with that sys_id. Pasting a sys_id on its own does the same |
| `:lang <code>` (`:language`, `:locale`) | Change your session language, e.g. `:lang de` for German or `:lang fr` for French. The code must be a language installed on the instance; a wrong code shows the available ones |
| `:names` (`:fields`, `:tn`, `:technical`) | Show the technical name of every field under its label on a classic form or list; run again to hide |

## Editing a read-only field

Sometimes an admin needs to correct a field the form won't let them change.

1. Open the record in a classic form and run `:edit`. A notice confirms field edit is on.
2. Triple-click the read-only field (or its label). A small editor opens with the stored
   value: plain text, a sys_id for reference fields, the value (not the label) for choices.
3. Change it and press **Save** (`Ctrl+Enter`). `Esc` cancels. Nothing is written before
   you save.

The form reloads with the new value, which also turns field edit off again. Only that
one field is saved; other unsaved changes on the form are lost by the reload.

By default the value is written through ServiceNow's Table API as you: UI policies and
client scripts that lock the field don't apply, but **ACLs and business rules do**. Many
"read-only" fields are protected by an ACL, so a plain save won't change them — the
editor will tell you to use Force.

### Force update

The editor has three checkboxes for when a plain save won't do it:

- **Force update** — runs the save as a background script (as you, an admin), which
  ignores ACLs and read-only. This is the same power as pasting a `GlideRecord` update
  into **Scripts - Background**; it needs the role that lets you run background scripts.
- **…and skip business rules** — adds `setWorkflow(false)`: no business rules, flows or
  notifications fire for the change.
- **…and keep Updated / Updated by** — adds `autoSysFields(false)`.

The last two only take effect when Force is ticked. Use Force deliberately: it writes
straight to the record and skips the checks that normally protect it.

New records must be saved once first, and workspace forms are not supported.

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
