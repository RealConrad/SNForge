// Shared theme shape. The actual color values are NOT duplicated per-file -
// src/background/background.ts owns the one canonical THEMES array and
// seeds it into chrome.storage.local; palette.ts and popup.ts both just read
// it from there. That's necessary (not just tidier) because content scripts
// can't import, and the popup runs in a completely separate realm from any
// content script - storage is the only thing that can reach both.
interface Theme {
  id: string;
  name: string;
  bg: string;
  border: string;
  text: string;
  accent: string;
  selectedBg: string;
  muted: string;
}
