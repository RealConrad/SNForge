import { tableLinkCommand } from '../table-link';

export const cs = tableLinkCommand({
  name: 'cs',
  aliases: ['clientscripts'],
  description: 'Open the client scripts of a table (default: the current page) in a new tab',
  listTable: 'sys_script_client',
  tableField: 'table',
});
