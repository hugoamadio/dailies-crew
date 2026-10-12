import { loadEnv } from './env';
import { runCli } from './cli';
import { createRuntime } from './runtime';

loadEnv();
process.exitCode = await runCli(
  process.argv.slice(2),
  { out: (line) => console.log(line), err: (line) => console.error(line) },
  process.env,
  ({ queue }) =>
    createRuntime(process.env, {
      queue,
      worker: false,
      lazyLlm: true,
      log: (line) => console.error(line),
    }),
);
