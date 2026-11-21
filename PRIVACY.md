# Privacy

SNForge does not collect, transmit or sell any data.

- **No data leaves your browser.** SNForge makes no requests to its author or to any
  third party. There is no telemetry, analytics or crash reporting.
- **The only network requests** go to the ServiceNow instance in the tab where you
  opened the palette, using your existing session, for example to check your roles.
- **Stored locally in Chrome** (`chrome.storage.local`, not synced):
  - your theme choice;
  - for the sys_id search, the names of tables where a record was found, per instance
    address, so later searches are faster. Only table names such as
    `sys_translated_text` are kept, never sys_ids or record contents. Removing the
    extension deletes them.
- **Page data** (your user id, roles and session token) is read in memory to decide
  whether to show the palette and to call your instance's API. It is never saved.

Opening the documentation (`:help` or the popup link) opens a GitHub page in a new tab;
GitHub's own privacy policy applies there.
