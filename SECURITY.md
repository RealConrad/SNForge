# Security

SNForge is used by ServiceNow administrators, so it is built to hold as little power as
possible.

## What SNForge can do

- Run on the **current tab only, and only after you press the shortcut** (`activeTab`).
  It has no standing access to any website and does nothing on a page before that.
- Open the palette only on `https://<instance>.service-now.com` pages.
- Read the logged-in user's id, roles and CSRF token from the page, to decide whether to
  show the palette and to call the instance's own REST API as you.
- Navigate the current tab, or open a new tab, **on the same instance** (plus the
  documentation link).
- Change one field of the record you are viewing, only after you turned field edit on
  (`:edit`), triple-clicked the field and pressed Save in the editor. If you tick
  **Force update**, SNForge runs a `GlideRecord` update as a background script on your
  behalf — the same action as using the instance's Scripts - Background page, and
  possible only for users your instance already lets run background scripts.
- Store your theme choice locally, and the names of tables the sys_id search found
  records in (per instance), to make later searches faster.

## What SNForge cannot and does not do

- No access to pages you haven't pressed the shortcut on.
- No requests to any server other than the ServiceNow instance you are on.
- No telemetry, analytics or remote code. All code ships in the extension.
- No stored credentials or tokens. The CSRF token is held in memory only as long as a
  request needs it.
- It cannot do anything in ServiceNow that your own account cannot do. The admin check
  that hides the palette from non-admins is a convenience, not a security control;
  ServiceNow's ACLs are what protect your data.

## Design safeguards

- The palette and the field editor live in a closed Shadow DOM and ignore
  script-generated (untrusted) keyboard and mouse events, so a page cannot operate them
  for you.
- Nothing is written to a record without an explicit Save, and the editor shows which
  table and field it is about to change.
- The Force update option runs server-side script only on that Save press, never on its
  own. The script is assembled from a fixed template with the value inserted as a quoted
  string and the table and field name checked against a strict pattern, so a field's
  contents can't turn into extra code.
- Data read from the page is treated as untrusted and validated before use.
- Every URL SNForge builds is checked to stay on the instance's own origin; the
  background worker checks again before opening a tab.
- The popup runs under a strict Content Security Policy (`default-src 'none'`).
- No runtime dependencies. Build tools are pinned in `package-lock.json`.

## Known limits

- A script already running in the ServiceNow page can observe keys you press while the
  palette is open. Do not type passwords or other secrets into the palette.
- A page script can make the palette appear for a non-admin by faking the role
  information. This gains nothing: the palette only does what that user's account is
  already allowed to do.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on
[the repository](https://github.com/RealConrad/SNForge/security/advisories/new).
Include the steps to reproduce and the Chrome and SNForge versions.
