/** The text to show a user for something that was thrown (an Error or anything else). */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
