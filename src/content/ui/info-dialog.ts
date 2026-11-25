import { el } from '../../shared/dom';
import styles from './info-dialog.css';
import { mountShadow } from './shadow-host';

/** One "label: value" line. */
export interface InfoRow {
  label: string;
  value: string;
  /** When set, the row gets a small Copy button that puts this text on the clipboard. */
  copy?: string;
}

/** A page to open, shown as a text link under the rows. */
export interface InfoLink {
  label: string;
  /** Runs on a trusted click; a rejection is shown on the link for a moment. */
  open(): Promise<void> | void;
}

export interface InfoContent {
  rows: InfoRow[];
  links: InfoLink[];
  /** The one real button, bottom right. The dialog closes when it is pressed. */
  primary?: { label: string; run(): void };
}

export interface InfoDialogOptions {
  title: string;
  subtitle: string;
  /** When set, the title gets a Copy button that puts this text on the clipboard. */
  copyTitle?: string;
}

export interface InfoDialog {
  /** Replaces "Loading…" with the content. */
  show(content: InfoContent): void;
  /** Replaces "Loading…" with an error line. */
  fail(message: string): void;
}

/** How long a button shows its feedback text ("Copied"). */
const FEEDBACK_MS = 1_200;

let host: HTMLElement | undefined;

function closeInfoDialog(): void {
  host?.remove();
  host = undefined;
}

/** A button that only reacts to real clicks. */
function createButton(className: string, label: string, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = el('button', className, label);
  button.type = 'button';
  button.addEventListener('click', (event) => {
    if (event.isTrusted) {
      onClick(button);
    }
  });
  return button;
}

/** Shows `text` on the button for a moment, then its own label again. */
function flash(button: HTMLButtonElement, text: string, label: string): void {
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = label;
  }, FEEDBACK_MS);
}

function createCopyButton(text: string): HTMLButtonElement {
  const button = createButton('chip', 'Copy', () => {
    navigator.clipboard.writeText(text).then(
      () => flash(button, 'Copied', 'Copy'),
      () => flash(button, 'Failed', 'Copy'),
    );
  });
  return button;
}

function createLinkButton(link: InfoLink): HTMLButtonElement {
  const label = `${link.label} ↗`;
  return createButton('link', label, (button) => {
    void Promise.resolve()
      .then(() => link.open())
      .catch(() => flash(button, 'Could not open', label));
  });
}

function createRows(rows: InfoRow[]): HTMLElement {
  const list = el('dl', 'rows');
  for (const row of rows) {
    const cell = el('dd');
    cell.append(el('span', 'value', row.value));
    if (row.copy !== undefined) {
      cell.append(createCopyButton(row.copy));
    }
    list.append(el('dt', undefined, row.label), cell);
  }
  return list;
}

/** Links on the left, the primary button on the right. */
function createFooter({ links, primary }: InfoContent): HTMLElement | undefined {
  if (links.length === 0 && !primary) {
    return undefined;
  }
  const footer = el('div', 'footer');

  const linkList = el('div', 'links');
  linkList.append(...links.map(createLinkButton));
  footer.append(linkList);

  if (primary) {
    footer.append(
      createButton('primary', primary.label, () => {
        closeInfoDialog();
        primary.run();
      }),
    );
  }
  return footer;
}

/**
 * Opens a read-only dialog: a title, then "Loading…" until show() or fail() is called.
 * Like the palette it lives in a closed Shadow DOM, ignores script-made events and
 * writes every value with textContent. Esc, the × or a press outside closes it.
 *
 * Layout: copying is done where the text is (a small Copy next to the title and next to
 * a row), pages to open are plain links in the footer, and at most one action is a button.
 */
export function openInfoDialog({ title, subtitle, copyTitle }: InfoDialogOptions): InfoDialog {
  closeInfoDialog();

  const titleRow = el('div', 'title-row');
  titleRow.append(el('span', 'title', title));
  if (copyTitle !== undefined) {
    titleRow.append(createCopyButton(copyTitle));
  }
  const headingText = el('div', 'heading-text');
  headingText.append(titleRow, el('div', 'subtitle', subtitle));

  const closeButton = createButton('close', '×', closeInfoDialog);
  closeButton.setAttribute('aria-label', 'Close');
  const heading = el('div', 'heading');
  heading.append(headingText, closeButton);

  const body = el('div', 'body');
  body.append(el('div', 'status', 'Loading…'));

  const panel = el('div', 'dialog');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', title);
  panel.append(heading, body);
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation(); // keep keys away from ServiceNow's own shortcuts
    if (event.isTrusted && event.key === 'Escape') {
      event.preventDefault();
      closeInfoDialog();
    }
  });
  // A press on the backdrop (the host) closes the dialog; presses inside the panel don't reach it.
  panel.addEventListener('pointerdown', (event) => event.stopPropagation());

  const mounted = mountShadow(styles, panel);
  host = mounted;
  mounted.addEventListener('pointerdown', (event) => {
    if (event.isTrusted) {
      closeInfoDialog();
    }
  });

  window.focus(); // the click was inside the form's iframe
  closeButton.focus();

  /** A dialog opened later replaced this one; its late answer must not be drawn into the new one. */
  const isCurrent = (): boolean => host === mounted;

  return {
    show(content) {
      if (!isCurrent()) {
        return;
      }
      body.replaceChildren(createRows(content.rows));
      const footer = createFooter(content);
      if (footer) {
        panel.append(footer);
      }
    },
    fail(message) {
      if (isCurrent()) {
        body.replaceChildren(el('div', 'status error', message));
      }
    },
  };
}
