import { registerCommand } from '../registry';
import { help } from './help';

/** Registers every built-in command. Add new commands here. */
export function registerBuiltins(): void {
  registerCommand(help);
}
