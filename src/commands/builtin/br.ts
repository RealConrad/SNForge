import { tableLinkCommand } from '../table-link';

export const br = tableLinkCommand({
  name: 'br',
  aliases: ['rules', 'businessrules'],
  description: 'Open the business rules of a table (default: the current page) in a new tab',
  listTable: 'sys_script',
  tableField: 'collection',
});
