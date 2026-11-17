export interface ParsedCommand {
  name: string;
  args: string[];
}

/**
 * Splits `:name arg1 "quoted arg" arg3` into name + args.
 * The leading ":" is optional. Returns null for empty input.
 * An unterminated quote runs to the end of the input.
 */
export function parseCommand(input: string): ParsedCommand | null {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let hasToken = false;

  for (const char of input.trim().replace(/^:/, '')) {
    if (char === '"') {
      inQuotes = !inQuotes;
      hasToken = true;
    } else if (/\s/.test(char) && !inQuotes) {
      if (hasToken) {
        tokens.push(current);
        current = '';
        hasToken = false;
      }
    } else {
      current += char;
      hasToken = true;
    }
  }
  if (hasToken) {
    tokens.push(current);
  }

  const [name, ...args] = tokens;
  return name ? { name: name.toLowerCase(), args } : null;
}
