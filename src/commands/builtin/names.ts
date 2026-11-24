import type { Command } from '../types';

export const names: Command = {
  name: 'names',
  aliases: ['fields', 'tn', 'technical'],
  description: 'Show or hide technical field names on this form or list',
  run(ctx) {
    if (ctx.page.toggleFieldNames() === 0) {
      throw new Error('No classic form or list found on this page');
    }
    ctx.ui.close(); // so the change is visible right away
  },
};
