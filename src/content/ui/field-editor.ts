import { el } from '../../shared/dom';
import styles from './field-editor.css';
import { mountShadow } from './shadow-host';

/** A checkbox under the value box, e.g. "Force update". `key` is returned when it's ticked. */
export interface EditorToggle {
  key: string;
  label: string;
}

export interface FieldEditorOptions {
  /** What is being edited, e.g. "incident.short_description". */
  title: string;
  /** The value the field has now. */
  value: string;
  /** Checkboxes to show under the value box (optional). */
  toggles?: EditorToggle[];
  /**
   * Writes the new value with the set of ticked toggle keys. The editor closes when this
   * resolves and shows the message when it rejects.
   */
  save(value: string, checked: ReadonlySet<string>): Promise<void>;
}

let host: HTMLElement | undefined;

function closeFieldEditor(): void {
  host?.remove();
  host = undefined;
}

/**
 * Opens a small dialog with one text box for a field's value and any toggle checkboxes.
 * Nothing is written until the user presses Save (or Ctrl+Enter): that is the
 * confirmation for the change. Like the palette it lives in a closed Shadow DOM and
 * ignores script-made events.
 */
export function openFieldEditor({ title, value, toggles = [], save }: FieldEditorOptions): void {
  closeFieldEditor();

  const input = el('textarea');
  input.value = value;
  input.rows = 4;
  input.spellcheck = false;
  input.setAttribute('aria-label', `New value for ${title}`);

  const boxes = new Map<string, HTMLInputElement>();
  const toggleList = el('div', 'toggles');
  for (const toggle of toggles) {
    const box = el('input');
    box.type = 'checkbox';
    const row = el('label', 'toggle');
    row.append(box, el('span', undefined, toggle.label));
    toggleList.append(row);
    boxes.set(toggle.key, box);
  }

  const error = el('div', 'error');
  error.hidden = true;

  const cancelButton = el('button', 'button', 'Cancel');
  cancelButton.type = 'button';
  const saveButton = el('button', 'button primary', 'Save');
  saveButton.type = 'button';

  async function submit(): Promise<void> {
    const checked = new Set([...boxes].filter(([, box]) => box.checked).map(([key]) => key));
    saveButton.disabled = true;
    error.hidden = true;
    try {
      await save(input.value, checked);
      closeFieldEditor();
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : String(reason);
      error.hidden = false;
      saveButton.disabled = false;
    }
  }

  cancelButton.addEventListener('click', (event) => {
    if (event.isTrusted) {
      closeFieldEditor();
    }
  });
  saveButton.addEventListener('click', (event) => {
    if (event.isTrusted) {
      void submit();
    }
  });

  const actions = el('div', 'actions');
  actions.append(el('span', 'hint', 'Ctrl+Enter saves · Esc cancels'), cancelButton, saveButton);

  const panel = el('div', 'editor');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', `Edit ${title}`);
  panel.append(el('div', 'title', title), input);
  if (toggles.length) {
    panel.append(toggleList);
  }
  panel.append(error, actions);

  panel.addEventListener('keydown', (event) => {
    event.stopPropagation(); // keep typing away from ServiceNow's own shortcuts
    if (!event.isTrusted) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFieldEditor();
    } else if (event.key === 'Enter' && event.ctrlKey && !saveButton.disabled) {
      event.preventDefault();
      void submit();
    }
  });
  // A press on the backdrop (the host) closes the editor; presses inside the panel don't reach it.
  panel.addEventListener('pointerdown', (event) => event.stopPropagation());

  host = mountShadow(styles, panel);
  host.addEventListener('pointerdown', (event) => {
    if (event.isTrusted) {
      closeFieldEditor();
    }
  });

  window.focus(); // the click was inside the form's iframe
  input.focus();
  input.select();
}
