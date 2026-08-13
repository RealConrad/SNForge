// The data-only shape of a command that's safe to share across realms via
// messaging - see SHARED_COMMANDS in src/background/background.ts, the
// single source of truth both palette.ts and popup.ts read from live
// (nothing persisted to storage for this - see command.d.ts's neighbor,
// theme.d.ts, for why storage was the right call there but not here).
//
// "open-path" is fully self-describing: any consumer can build a working
// run() from just the path. "custom" is metadata only, deliberately with no
// run() field - closures can't survive chrome.runtime messaging. Its actual
// behavior is defined locally in src/content/palette.ts's
// CUSTOM_COMMAND_RUNNERS, since that's the only context with the page
// access to run arbitrary logic. Keep that map's keys in sync with every
// "custom" id declared here.
type SharedCommandDef = { id: string; subtitle?: string } & ({ kind: "open-path"; path: string } | { kind: "custom" });
