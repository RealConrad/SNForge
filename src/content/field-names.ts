/**
 * Shows / hides the technical (column) name of every field on classic forms and lists,
 * as a small pill under the label:
 *
 *   Short description
 *   (short_description)
 *
 * Every document of the page is searched (see documents.ts). Workspace / Next Experience
 * native forms are not classic DOM and are not covered.
 */

import { collectDocuments } from './documents';

/** Marks the elements we add, so a second run can find and remove them. */
const MARKER = 'data-snforge-field-name';

/** Classic form rows have the id "element.<table>.<field>"; the capture is the field. */
const FORM_ROW_ID = /^element\.[a-z0-9_]+\.(.+)$/;

const PILL_STYLE = [
  'display: inline-block',
  'padding: 0 7px',
  'border: 1px solid rgb(127 127 127 / 40%)', // neutral grey
  'border-radius: 999px',
  'background: rgb(127 127 127 / 16%)',
  'font: 400 11px/16px ui-monospace, Consolas, monospace',
  'text-transform: none',
  'white-space: nowrap',
  'user-select: all', // one click selects the whole name for copying
].join('; ');

/**
 * A block row holding the pill, so it sits on its own line and follows the label's
 * alignment. Styled inline because it lives in ServiceNow's DOM, outside our Shadow DOM.
 */
function createPill(doc: Document, name: string): HTMLElement {
  const pill = doc.createElement('span');
  pill.textContent = name;
  pill.style.cssText = PILL_STYLE;

  const row = doc.createElement('span');
  row.setAttribute(MARKER, '');
  row.style.cssText = 'display: block; margin: 2px 0';
  row.append(pill);
  return row;
}

/** Adds a pill to every form field and list column in `doc`; returns how many. */
function addPills(doc: Document): number {
  let count = 0;

  for (const formRow of doc.querySelectorAll('[id^="element."]')) {
    const name = FORM_ROW_ID.exec(formRow.id)?.[1];
    if (name) {
      // The <label> is the label column itself, so the pill goes inside it, under the text.
      const label = formRow.querySelector('label') ?? formRow;
      label.append(createPill(doc, name));
      count += 1;
    }
  }

  for (const header of doc.querySelectorAll('th.list_header_cell')) {
    const name = header.getAttribute('name');
    if (name) {
      header.append(createPill(doc, name));
      count += 1;
    }
  }

  return count;
}

/**
 * Removes the pills if any are shown, otherwise adds them.
 * Returns how many were removed or added; 0 means the page has no classic form or list.
 */
export function toggleFieldNames(): number {
  const documents = collectDocuments();

  const shown = documents.flatMap((doc) => [...doc.querySelectorAll(`[${MARKER}]`)]);
  if (shown.length) {
    shown.forEach((pill) => pill.remove());
    return shown.length;
  }

  return documents.reduce((total, doc) => total + addPills(doc), 0);
}
