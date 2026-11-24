import { registerCommand } from '../registry';
import type { Command } from '../types';
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

/** Every built-in command. Add new commands here. */
const BUILTINS: readonly Command[] = [help, nav, fd, st, names, lang, find, br, cs, log, edit];

export function registerBuiltins(): void {
  BUILTINS.forEach(registerCommand);
}
