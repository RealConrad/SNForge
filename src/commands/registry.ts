import type { Command } from './types';

const commands = new Map<string, Command>();
const aliases = new Map<string, Command>();

export function registerCommand(command: Command): void {
  for (const key of [command.name, ...(command.aliases ?? [])]) {
    if (commands.has(key) || aliases.has(key)) {
      throw new Error(`Duplicate command name or alias: ${key}`);
    }
  }
  commands.set(command.name, command);
  for (const alias of command.aliases ?? []) {
    aliases.set(alias, command);
  }
}

/** Finds a command by exact name or alias (case-insensitive). */
export function findCommand(name: string): Command | undefined {
  const key = name.toLowerCase();
  return commands.get(key) ?? aliases.get(key);
}

/** Commands whose name or alias starts with `prefix`; all commands for an empty prefix. */
export function matchCommands(prefix: string): Command[] {
  const key = prefix.toLowerCase();
  return [...commands.values()].filter((command) =>
    [command.name, ...(command.aliases ?? [])].some((name) => name.startsWith(key)),
  );
}
