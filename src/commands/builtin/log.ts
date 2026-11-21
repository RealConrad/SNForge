import type { Command } from '../types';
import { classicPageUrl } from '../urls';

/** Today's entries, newest first. */
const QUERY = 'sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()^ORDERBYDESCsys_created_on';

export const log: Command = {
  name: 'log',
  aliases: ['logs', 'syslog'],
  description: "Open today's system log in a new tab",
  usage: 'log',
  async run(ctx) {
    const params = new URLSearchParams({ sysparm_query: QUERY });
    await ctx.openTab(classicPageUrl(`/syslog_list.do?${params.toString()}`, ctx.urlOptions));
    ctx.ui.close();
  },
};
