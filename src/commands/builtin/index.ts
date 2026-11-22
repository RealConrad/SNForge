import { registerCommand } from '../registry';
import { br } from './br';
import { cs } from './cs';
import { edit } from './edit';
import { fd } from './fd';
import { find } from './find';
import { help } from './help';
import { lang } from './lang';
import { log } from './log';
import { names } from './names';
import { nav } from './nav';
import { st } from './st';

/** Registers every built-in command. Add new commands here. */
export function registerBuiltins(): void {
  registerCommand(help);
  registerCommand(nav);
  registerCommand(fd);
  registerCommand(st);
  registerCommand(names);
  registerCommand(lang);
  registerCommand(find);
  registerCommand(br);
  registerCommand(cs);
  registerCommand(log);
  registerCommand(edit);
}
