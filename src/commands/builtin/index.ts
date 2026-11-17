import { registerCommand } from '../registry';
import { fd } from './fd';
import { help } from './help';
import { nav } from './nav';
import { st } from './st';

/** Registers every built-in command. Add new commands here. */
export function registerBuiltins(): void {
  registerCommand(help);
  registerCommand(nav);
  registerCommand(fd);
  registerCommand(st);
}
