/**
 * Shows / hides the technical (column) name of every field on classic forms and lists,
 * as a small pill under the label:
 *
 *   Short description
 *   (short_description)
 *
 * On a form, clicking a pill opens the field details dialog (field-details.ts).
 *
 * Every document of the page is searched (see documents.ts). Workspace / Next Experience
 * native forms are not classic DOM and are not covered.
 */

import { collectDocuments } from './documents';
import { showFieldDetails } from './field-details';
import { FORM_ROW_SELECTOR, parseFormRowId } from './form-rows';

/** Marks the elements we add, so a second run can find and remove them. */
const MARKER = 'data-snforge-field-name';

const PILL_STYLE = [
  'display: inline-block',
  'padding: 0 7px',
  'border: 1px solid rgb(127 127 127 / 40%)', // neutral grey
  'border-radius: 999px',
  'background: rgb(127 127 127 / 16%)',
  'font: 400 11px/16px ui-monospace, Consolas, monospace',
  'text-transform: none',
  'white-space: nowrap',
].join('; ');

/** The form field a clickable pill stands for. */
interface PillField {
  doc: Document;
  table: string;
  field: string;
}

/** Which field each clickable pill is for. Kept here, not in the DOM, where the page could change it. */
const pillFields = new WeakMap<EventTarget, PillField>();

/** Removes the click listeners from the documents that have clickable pills. */
let listening: AbortController | undefined;

/**
 * A real (trusted) click on a form pill opens that field's details.
 *
 * One listener per document, in the capture phase, instead of one per pill: it runs
 * before anything ServiceNow attached to the label or to a link around it, whatever the
 * label's markup is (a read-only or linked label is built differently). The click is
 * also stopped here, because the pill sits inside the field's <label>: it would
 * otherwise focus the field, tick its checkbox or follow the label's link.
 */
function onDocumentClick(event: MouseEvent): void {
  const field = event.target ? pillFields.get(event.target) : undefined;
  if (!field) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.isTrusted) {
    showFieldDetails(field.doc, field.table, field.field);
  }
}

/**
 * A block row holding the pill, so it sits on its own line and follows the label's
 * alignment. Styled inline because it lives in ServiceNow's DOM, outside our Shadow DOM.
 *
 * With `field` the pill is a button that opens the field's details (see onDocumentClick).
 * Without it, one click selects the name for copying.
 */
function createPill(doc: Document, name: string, field?: PillField): HTMLElement {
  const pill = doc.createElement('span');
  pill.textContent = name;
  pill.style.cssText = PILL_STYLE;
  if (field) {
    pill.style.cursor = 'pointer';
    pill.title = 'Field details';
    pillFields.set(pill, field);
  } else {
    pill.style.userSelect = 'all';
  }

  const row = doc.createElement('span');
  row.setAttribute(MARKER, '');
  row.style.cssText = 'display: block; margin: 2px 0';
  row.append(pill);
  return row;
}

/** Adds a pill to every form field and list column in `doc`; returns how many. */
function addPills(doc: Document, signal: AbortSignal): number {
  let count = 0;

  for (const formRow of doc.querySelectorAll(FORM_ROW_SELECTOR)) {
    const row = parseFormRowId(formRow.id);
    if (row) {
      // The <label> is the label column itself, so the pill goes inside it, under the text.
      const label = formRow.querySelector('label') ?? formRow;
      label.append(createPill(doc, row.field, { doc, table: row.table, field: row.field }));
      count += 1;
    }
  }
  if (count > 0) {
    doc.addEventListener('click', onDocumentClick, { capture: true, signal });
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
  listening?.abort(); // the pills are about to be removed, or replaced on a reloaded form
  listening = undefined;

  const shown = documents.flatMap((doc) => [...doc.querySelectorAll(`[${MARKER}]`)]);
  if (shown.length) {
    shown.forEach((pill) => pill.remove());
    return shown.length;
  }

  const { signal } = (listening = new AbortController());
  return documents.reduce((total, doc) => total + addPills(doc, signal), 0);
}
