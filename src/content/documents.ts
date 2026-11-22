/**
 * Classic pages may sit in the `gsft_main` iframe, which Next Experience nests inside
 * several shadow roots. Code that works on classic forms and lists therefore looks in
 * the top document, open shadow roots and same-origin iframes.
 */

/** tagName, not instanceof: elements in another frame belong to that frame's classes. */
function isIframe(element: Element): element is HTMLIFrameElement {
  return element.tagName === 'IFRAME';
}

/** Adds the document of every same-origin iframe under `root` to `found`. */
function findFrameDocuments(root: Document | ShadowRoot, found: Document[]): void {
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) {
      findFrameDocuments(element.shadowRoot, found);
    } else if (isIframe(element) && element.contentDocument) {
      // contentDocument is null for cross-origin frames.
      found.push(element.contentDocument);
      findFrameDocuments(element.contentDocument, found);
    }
  }
}

/** The top document plus every same-origin iframe document, however deeply nested. */
export function collectDocuments(): Document[] {
  const found = [document];
  findFrameDocuments(document, found);
  return found;
}
