import { describe, expect, it, vi } from 'vitest';
import { runCli, USAGE } from './cli';

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) },
    out,
    err,
  };
}

describe('runCli', () => {
  it('prints the usage with --help', async () => {
    const { io, out } = capture();
    const open = vi.fn();
    expect(await runCli(['--help'], io, {}, open)).toBe(0);
    expect(out).toEqual([USAGE]);
    expect(open).not.toHaveBeenCalled();
  });

  it.each([
    [['dance'], 'Unknown command "dance"'],
    [[], 'Which command?'],
    [['approve'], '"approve" takes one id'],
    [['reject', 'abc', '--mode', 'learn'], '"reject" needs --reason'],
    [['run-now'], '"run-now" needs --line'],
    [['status', '--colour'], "Unknown option '--colour'"],
  ])('refuses %j before touching the database', async (argv, message) => {
    const { io, err } = capture();
    const open = vi.fn();
    expect(await runCli(argv, io, {}, open)).toBe(1);
    expect(err[0]).toContain(message);
    expect(err.at(-1)).toBe(USAGE);
    expect(open).not.toHaveBeenCalled();
  });

  it('prints one line and exits 1 when closing fails after a successful command', async () => {
    const { io, out, err } = capture();
    const runtime = {
      db: { productionLine: { findMany: async () => [] } },
      ctx: {},
      boss: null,
      close: async () => {
        throw new Error('the queue did not stop');
      },
    };
    expect(await runCli(['line:list'], io, {}, async () => runtime as never)).toBe(1);
    expect(out[0]).toContain('No lines yet');
    expect(err).toEqual(['Could not close cleanly: the queue did not stop']);
  });
});
