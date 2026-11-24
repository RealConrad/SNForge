/**
 * Field edit mode (:edit): while it is on, a triple-click on a read-only field of a
 * classic form opens a small editor that writes that one field to the record.
 *
 * The value is saved through the Table API, not through the form, so it also works when
 * a UI policy or client script locks the field. ACLs, data policies and business rules
 * on the server still apply. After a save the form is reloaded, which also ends the mode.
 */

import { messageOf } from '../shared/errors';
import { isIdentifier } from '../shared/identifiers';
import { createSnApi, type SnApi } from '../shared/sn-api';
import { isSysId } from '../shared/sys-id';
import { grantedSession } from './access';
import { collectDocuments } from './documents';
import { forceUpdateField } from './force-update';
import { FORM_ROW_SELECTOR, parseFormRowId } from './form-rows';
import { openFieldEditor, type EditorToggle } from './ui/field-editor';
import { showNotice } from './ui/notice';

/**
 * The checkboxes in the editor. "force" runs the save as a background script (ignoring
 * ACLs and read-only); the other two are GlideRecord flags that only apply then.
 */
const FORCE = 'force';
const SKIP_BUSINESS_RULES = 'noBR';
const KEEP_SYSTEM_FIELDS = 'noSys';
const TOGGLES: EditorToggle[] = [
  { key: FORCE, label: 'Force update — run as admin, ignore ACLs and read-only' },
  { key: SKIP_BUSINESS_RULES, label: 'Skip business rules (setWorkflow false)' },
  { key: KEEP_SYSTEM_FIELDS, label: 'Do not update the fields "Updated / Updated by" (autoSysFields false)' },
];

/** One field of the record a form shows. */
interface FormField {
  table: string;
  name: string;
  sysId: string;
}

/** A visible control that ServiceNow rendered as not editable. */
const READ_ONLY_CONTROL = ':is(input, textarea, select):is([readonly], [disabled]):not([type="hidden"])';

/** Set while the mode is on: the forms being listened to, and the controller that removes the listeners. */
let listening: { controller: AbortController; forms: Document[] } | undefined;

/**
 * The listeners sit on the form documents, which are usually in an iframe. When that
 * frame reloads or navigates (as it does after a save) its document is discarded and the
 * listeners with it, while this script lives on in the top frame. A discarded document
 * has no window, so the mode only counts as on while a form document still has one.
 */
function isListening(): boolean {
  return listening?.forms.some((doc) => doc.defaultView !== null) ?? false;
}

/** Not instanceof: elements in an iframe belong to that frame's classes. */
function isElement(target: EventTarget | null): target is Element {
  return target !== null && 'closest' in target;
}

/** The read-only form field that was clicked, if the click was on one. */
function readOnlyFieldAt(doc: Document, target: EventTarget | null): FormField | undefined {
  const row = isElement(target) ? target.closest(FORM_ROW_SELECTOR) : null;
  const { table, field: name } = parseFormRowId(row?.id ?? '') ?? {};
  // Every classic form carries the sys_id of its record in this hidden input.
  const sysId = doc.querySelector<HTMLInputElement>('#sys_uniqueValue')?.value ?? '';

  // All of this is page data, so it is only used when it has the expected shape.
  // A dot-walked field is not an identifier: it belongs to another record and can't be edited here.
  if (!row?.querySelector(READ_ONLY_CONTROL) || !table || !name || !isIdentifier(name) || !isSysId(sysId)) {
    return undefined;
  }
  return { table, name, sysId };
}

/** The stored value of the field (sys_id for references, the value for choices). */
async function readValue(api: SnApi, { table, name, sysId }: FormField): Promise<string> {
  const record = await api.getRecord(table, sysId, { fields: [name] });
  if (!record) {
    throw new Error('This record is not saved yet. Save it first.');
  }
  const value = record[name];
  if (typeof value !== 'string') {
    throw new Error(`Could not read ${table}.${name}`);
  }
  return value;
}

/** Writes the value, by the path the ticked toggles call for, and checks it took. */
async function saveValue(
  api: SnApi,
  field: FormField,
  oldValue: string,
  value: string,
  checked: ReadonlySet<string>,
): Promise<void> {
  const force = checked.has(FORCE);
  const stored = force
    ? await forceUpdateField(api, field.table, field.sysId, field.name, value, {
        skipBusinessRules: checked.has(SKIP_BUSINESS_RULES),
        keepSystemFields: checked.has(KEEP_SYSTEM_FIELDS),
      })
    : await api.updateField(field.table, field.sysId, field.name, value);

  // No value came back (record or field not readable): the save can't be confirmed, and
  // closing the editor would report a success nobody saw.
  if (typeof stored !== 'string') {
    throw new Error('Could not read the field back, so the change is unconfirmed. Reload the form to check.');
  }
  if (stored === oldValue && value !== oldValue) {
    throw new Error(
      force
        ? // Force already bypasses ACLs and read-only, so what is left is the value itself:
          // GlideRecord drops a value the field's type can't hold (text in an integer field).
          `ServiceNow did not accept this value for ${field.table}.${field.name}. It probably does not fit the field type (for example text in a number or date field). A data policy can also block it.`
        : 'ServiceNow kept the old value. Tick "Force update" to bypass ACLs and business rules.',
    );
  }
}

async function editField(doc: Document, field: FormField): Promise<void> {
  const api = createSnApi(grantedSession().token);
  try {
    const oldValue = await readValue(api, field);
    openFieldEditor({
      title: `${field.table}.${field.name}`,
      value: oldValue,
      toggles: TOGGLES,
      async save(value, checked) {
        await saveValue(api, field, oldValue, value, checked);
        doc.location.reload(); // show the saved value
      },
    });
  } catch (error) {
    showNotice(messageOf(error));
  }
}

function onClick(doc: Document, event: MouseEvent): void {
  // detail counts the clicks of a multi-click; script-made clicks are ignored.
  if (!event.isTrusted || event.detail !== 3) {
    return;
  }
  const field = readOnlyFieldAt(doc, event.target);
  if (field) {
    void editField(doc, field);
  }
}

/**
 * Turns field edit mode on, or off if it is on, and says so in a notice.
 * Returns false when the page has no classic form (nothing was turned on).
 */
export function toggleFieldEdit(): boolean {
  const wasOn = isListening();
  listening?.controller.abort(); // also clears what is left of a mode whose forms are gone
  listening = undefined;
  if (wasOn) {
    showNotice('Field edit is off');
    return true;
  }

  const forms = collectDocuments().filter((doc) => doc.querySelector('#sys_uniqueValue'));
  if (forms.length === 0) {
    return false;
  }

  const controller = new AbortController();
  listening = { controller, forms };
  for (const doc of forms) {
    doc.addEventListener('click', (event) => onClick(doc, event), { capture: true, signal: controller.signal });
  }
  showNotice('Field edit is on: triple-click a read-only field. Run :edit again to turn it off.');
  return true;
}
