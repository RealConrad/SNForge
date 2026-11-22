import type { Command } from '../types';

export const edit: Command = {
  name: 'edit',
  aliases: ['fieldedit', 'unlock'],
  description: 'Turn field edit on or off: triple-click a form field to change its value',
  usage: 'edit',
  run(ctx) {
    if (!ctx.toggleFieldEdit()) {
      throw new Error('No classic form found on this page');
    }
    ctx.ui.close();
  },
};
