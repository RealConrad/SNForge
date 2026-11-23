/**
 * Decides which suggestions the palette lists for an input, and in what order. No DOM
 * here: palette.ts renders the items and supplies what happens when one is accepted.
 */

import { findCommand, matchCommands } from '../../commands/registry';
import { describeTableShortcut, parseTableShortcut, type TableShortcut } from '../../commands/table-shortcut';
import type { Command } from '../../commands/types';
import { MAX_SUGGESTIONS, SUGGESTED_INPUTS } from '../../config';
import { isSysId } from '../../shared/sys-id';

/** One row in the suggestion list. */
export interface PaletteItem {
  icon: string;
  title: string;
  description: string;
  hint: string;
  /** Enter / click. */
  accept(): void;
  /** Text Tab puts into the input; undefined when Tab has nothing to complete. */
  completion?: string;
}

/** What accepting an item can do; implemented by the palette. */
export interface ItemActions {
  /** Runs `input` as a command line, e.g. ":find 6816f79c…". */
  runCommand(input: string): void;
  /** Puts ":name " into the input so arguments can be typed. */
  completeCommand(command: Command): void;
  runTableShortcut(shortcut: TableShortcut): void;
}

function tableItem(shortcut: TableShortcut, actions: ItemActions): PaletteItem {
  const { title, detail } = describeTableShortcut(shortcut);
  return {
    icon: shortcut.newTab ? '↗' : '→',
    title,
    description: detail,
    hint: shortcut.newTab ? 'new tab' : '',
    accept: () => actions.runTableShortcut(shortcut),
  };
}

/** A pasted sys_id runs :find, so there is one code path for the search. */
function sysIdItem(sysId: string, actions: ItemActions): PaletteItem {
  return {
    icon: '#',
    title: `Find record: ${sysId}`,
    description: 'Search by sys_id and open the record',
    hint: '',
    accept: () => actions.runCommand(`:find ${sysId}`),
  };
}

function commandItem(command: Command, typedName: string, input: string, actions: ItemActions): PaletteItem {
  const isExact = findCommand(typedName) === command;
  return {
    icon: ':',
    title: `:${command.name}`,
    description: command.description,
    hint: '',
    // A fully typed name runs; a partial one completes first.
    accept: () => (isExact ? actions.runCommand(input) : actions.completeCommand(command)),
    completion: `:${command.name} `,
  };
}

/** The item a suggested input ("incident", ":nav") stands for, as if it had been typed. */
function suggestedItem(text: string, actions: ItemActions): PaletteItem | undefined {
  if (text.startsWith(':')) {
    const name = text.slice(1).toLowerCase();
    const command = findCommand(name);
    return command ? commandItem(command, name, text, actions) : undefined;
  }
  const shortcut = parseTableShortcut(text);
  return shortcut ? tableItem(shortcut, actions) : undefined;
}

/**
 * Suggested inputs containing what was typed (all of them for empty input).
 * Typing in uppercase ("INC") keeps the new-tab meaning by uppercasing the suggestion.
 */
function suggestedItems(trimmed: string, actions: ItemActions): PaletteItem[] {
  if (/\s/.test(trimmed)) {
    return []; // arguments typed: the user is past picking a suggestion
  }
  const needle = trimmed.toLowerCase();
  const newTab = trimmed !== needle;

  return SUGGESTED_INPUTS.filter((text) => text.toLowerCase().includes(needle))
    .map((text) => suggestedItem(newTab ? text.toUpperCase() : text, actions))
    .filter((item): item is PaletteItem => item !== undefined);
}

/** Suggestions overlap with the typed shortcut / command matches; keep the first of each. */
function uniqueByTitle(items: PaletteItem[]): PaletteItem[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.title) && seen.add(item.title));
}

/** The suggestion list for `input`, best match first, at most MAX_SUGGESTIONS long. */
export function buildItems(input: string, actions: ItemActions): PaletteItem[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return suggestedItems('', actions).slice(0, MAX_SUGGESTIONS);
  }

  // A sys_id is unambiguous (and also looks like a table name), so it is the only item.
  if (isSysId(trimmed.toLowerCase())) {
    return [sysIdItem(trimmed.toLowerCase(), actions)];
  }

  const typedName = (trimmed.replace(/^:/, '').split(/\s+/, 1)[0] ?? '').toLowerCase();

  // Commands come first: the exact match ("help"), then every name or alias that
  // starts with what was typed ("nam" → :names).
  const exact = findCommand(typedName);
  const partial = matchCommands(typedName).filter((command) => command !== exact);
  const commands = exact ? [exact, ...partial] : partial;

  const items = uniqueByTitle([
    ...commands.map((command) => commandItem(command, typedName, trimmed, actions)),
    ...suggestedItems(trimmed, actions),
  ]);

  // The typed text as a table name is the fallback, so it goes last, and it always
  // keeps its place in the list however many other matches there are.
  const shortcut = parseTableShortcut(trimmed);
  if (!shortcut) {
    return items.slice(0, MAX_SUGGESTIONS);
  }
  return uniqueByTitle([...items.slice(0, MAX_SUGGESTIONS - 1), tableItem(shortcut, actions)]);
}
