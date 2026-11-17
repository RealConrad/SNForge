import { pageLinkCommand } from '../page-link';

export const st = pageLinkCommand({
  name: 'st',
  aliases: ['studio'],
  description: 'Open ServiceNow Studio in a new tab',
  path: '/sn_glider_app/servicenow_studio.do',
});
