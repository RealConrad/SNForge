import { TABLE_NAME } from './table-shortcut';
import type { Command } from './types';
import { CLASSIC_TARGET_PREFIX, classicPageUrl } from './urls';

/** Data for a command that lists the configuration records of one table. */
interface TableLink {
  name: string;
  aliases?: string[];
  description: string;
  /** Table that holds the configuration records, e.g. "sys_script". */
  listTable: string;
  /** Field on `listTable` that names the table a record belongs to, e.g. "collection". */
  tableField: string;
}

/** A classic form or list path: "/incident.do?…" or "/incident_list.do?…". */
const CLASSIC_PAGE = /^\/?([a-z][a-z0-9_]*?)(?:_list)?\.do(?:\?|$)/;

/**
 * The table of the classic form or list at `currentPath`, also when it is shown inside
 * Next Experience. Undefined on other pages (workspaces, Flow Designer, …).
 */
export function tableOfPage(currentPath: string): string | undefined {
  const path = currentPath.startsWith(CLASSIC_TARGET_PREFIX)
    ? decodeURIComponent(currentPath.slice(CLASSIC_TARGET_PREFIX.length))
    : currentPath;
  return CLASSIC_PAGE.exec(path)?.[1];
}

/**
 * Makes a command that opens, in a new tab, the `link.listTable` records that belong to
 * a table: the one given as argument, otherwise the table of the current page.
 * Not a command itself: builtin/br.ts and builtin/cs.ts each call it once.
 */
export function tableLinkCommand(link: TableLink): Command {
  return {
    name: link.name,
    aliases: link.aliases,
    description: link.description,
    usage: `${link.name} [table]`,
    async run(ctx, [input]) {
      const table = input?.toLowerCase() ?? tableOfPage(ctx.currentPath);
      if (!table || !TABLE_NAME.test(table)) {
        throw new Error(`Open a form or list first, or add a table, for example :${link.name} incident`);
      }

      const params = new URLSearchParams({ sysparm_query: `${link.tableField}=${table}` });
      const url = classicPageUrl(`/${link.listTable}_list.do?${params.toString()}`, ctx.urlOptions);
      await ctx.openTab(url);
      ctx.ui.close();
    },
  };
}
