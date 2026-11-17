import { registerCommand } from '../registry';
import { help } from './help';
import { nav } from './nav';

/** Registers every built-in command. Add new commands here. */
export function registerBuiltins(): void {
  registerCommand(help);
  registerCommand(nav);
}
