/**
 * The field details dialog: opened by clicking a technical-name pill (:names) on a
 * classic form. Shows what field-info.ts found and offers copy, edit and links.
 */

import { messageOf } from '../shared/errors';
import { isIdentifier } from '../shared/identifiers';
import { createSnApi } from '../shared/sn-api';
import { isSysId } from '../shared/sys-id';
import { grantedSession } from './access';
import { editField } from './field-edit';
import { fieldUrls, loadFieldInfo, typeText, type FieldInfo, type FieldRef } from './field-info';
import { isNextExperience, openTab } from './navigation';
import { openInfoDialog, type InfoContent, type InfoLink, type InfoRow } from './ui/info-dialog';

/** The record a classic form shows; undefined for a new record (its id is "-1"). */
function recordOf(doc: Document): string | undefined {
  const sysId = doc.querySelector<HTMLInputElement>('#sys_uniqueValue')?.value ?? '';
  return isSysId(sysId) ? sysId : undefined;
}

function rowsOf(info: FieldInfo): InfoRow[] {
  const rows: InfoRow[] = [];
  const add = (label: string, value: string | undefined, copy?: string): void => {
    if (value !== undefined) {
      rows.push({ label, value, copy });
    }
  };

  add('Label', info.label);
  add('Type', typeText(info) ?? (isIdentifier(info.field) ? 'no dictionary entry found' : 'field of a related record'));
  add('Input', info.choices === 'suggestion' ? 'free text with suggestions' : info.choices && 'choice list');
  if (info.value !== undefined) {
    add('Value', info.value || '(empty)', info.value);
    // References, choices and dates display something else than they store.
    add('Displays as', info.displayValue && info.displayValue !== info.value ? info.displayValue : undefined);
  } else {
    add('Value', info.sysId ? '(could not be read)' : '(record not saved yet)');
  }
  add('Defined on', info.definedOn && info.definedOn !== info.table ? info.definedOn : undefined);
  add('Default', info.defaultValue);
  add('Dictionary', [info.mandatory && 'mandatory', info.readOnly && 'read-only'].filter(Boolean).join(', ') || undefined);
  add('Ref qualifier', info.referenceQualifier, info.referenceQualifier);
  add('Attributes', info.attributes, info.attributes);
  return rows;
}

/** The footer links, in the order they are offered; only pages that exist. */
function linksOf(info: FieldInfo): InfoLink[] {
  const urls = fieldUrls(info, { origin: window.location.origin, nextExperience: isNextExperience() });
  const candidates: [label: string, url: string | undefined][] = [
    ['Dictionary', urls.dictionary],
    ['Open record', urls.record],
    [info.choices === 'suggestion' ? 'Suggestions' : 'Choices', urls.choices],
    ['ACLs', urls.acls],
    ['History', urls.history],
  ];
  return candidates.flatMap(([label, url]) => (url ? [{ label, open: () => openTab(url) }] : []));
}

function contentOf(doc: Document, info: FieldInfo): InfoContent {
  const { table, field, sysId } = info;
  return {
    rows: rowsOf(info),
    links: linksOf(info),
    // Same editor as :edit; a dot-walked field belongs to another record and can't be edited here.
    primary:
      sysId && isIdentifier(field)
        ? { label: 'Change value', run: () => void editField(doc, { table, name: field, sysId }) }
        : undefined,
  };
}

/** Opens the details dialog for one field of the form in `doc`. */
export function showFieldDetails(doc: Document, table: string, field: string): void {
  const ref: FieldRef = { table, field, sysId: recordOf(doc) };
  const dialog = openInfoDialog({ title: field, subtitle: `${table}.${field}`, copyTitle: field });

  loadFieldInfo(createSnApi(grantedSession().token), ref).then(
    (info) => dialog.show(contentOf(doc, info)),
    (error: unknown) => dialog.fail(messageOf(error)),
  );
}
