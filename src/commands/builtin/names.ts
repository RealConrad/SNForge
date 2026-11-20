import type { Command } from '../types';

export const names: Command = {
  name: 'names',
  aliases: ['fields', 'tn', 'technical'],
  description: 'Show or hide technical field names on this form or list',
  usage: 'names',
  run(ctx) {
    if (ctx.toggleFieldNames() === 0) {
      ctx.ui.print('No classic form or list found on this page', 'error');
      return;
    }
    ctx.ui.close(); // so the change is visible right away
  },
};
