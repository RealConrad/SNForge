import { parseCommand } from './parser';
import { findCommand } from './registry';
import type { CommandContext } from './types';

/**
 * Runs `task` and prints any error via ctx.ui. If the run was cancelled (palette closed,
 * another run started), errors are swallowed: nobody is waiting for the result.
 */
export async function runSafely(ctx: CommandContext, task: () => Promise<void> | void): Promise<void> {
  try {
    await task();
  } catch (error: unknown) {
    if (ctx.signal.aborted) {
      return;
    }
    ctx.ui.print(error instanceof Error ? error.message : String(error), 'error');
  }
}

/** Parses `input`, finds the command and runs it. Errors are printed, never thrown. */
export async function runCommandInput(input: string, ctx: CommandContext): Promise<void> {
  const parsed = parseCommand(input);
  if (!parsed) {
    return;
  }

  const command = findCommand(parsed.name);
  if (!command) {
    ctx.ui.print(`Unknown command: ${parsed.name}`, 'error');
    return;
  }

  await runSafely(ctx, () => command.run(ctx, parsed.args));
}
