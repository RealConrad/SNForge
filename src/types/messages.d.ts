// The SNForge internal messaging protocol: what the palette content script,
// the popup, and the background worker send each other. Ambient/global (no
// import/export), so these types are visible everywhere in src/ without an
// import - required for palette.ts, which can't be an ES module.
//
// Background never inspects *what* is being opened, just opens it - the
// palette is responsible for deciding what URL a command maps to.

interface SNForgeOpenTabMessage {
  type: "SNFORGE_OPEN_TAB";
  url: string;
}

// Sent by both palette.ts and popup.ts. Answered with a SharedCommandDef[]
// (see command.d.ts) - not modeled as its own message type since responses
// aren't part of this discriminated union, just whatever sendResponse passes.
interface SNForgeGetCommandsMessage {
  type: "SNFORGE_GET_COMMANDS";
}

type SNForgeMessage = SNForgeOpenTabMessage | SNForgeGetCommandsMessage;
