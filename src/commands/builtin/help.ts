import { DOCS_URL } from '../../config';
import type { Command } from '../types';

export const help: Command = {
  name: 'help',
  aliases: ['docs'],
  description: 'Open the SNForge documentation',
  usage: 'help',
  async run(ctx) {
    await ctx.openTab(DOCS_URL);
    ctx.ui.close();
  },
};
