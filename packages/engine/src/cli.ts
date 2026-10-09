import path from 'node:path';
import { parseArgs } from 'node:util';
import { produceVideo } from './produce';
import { createVoiceProvider } from './voice';

const USAGE = `Usage: npm run dailies -- render <plan.json> --assets <folder> [--out <file.mp4>] [--voice fake|elevenlabs]

  --assets  folder the plan's image and music paths are relative to
  --out     where to write the video (default: data/jobs/<job>/video.mp4)
  --voice   override the plan's voice provider ("fake" makes a silent voice, no key needed)

ElevenLabs needs ELEVENLABS_API_KEY in the environment or in a .env file.`;

function progressPrinter(): (progress: number) => void {
  let last = -1;
  return (progress) => {
    const percent = Math.floor(progress * 10) * 10;
    if (percent !== last) {
      last = percent;
      console.log(`[render] ${percent}%`);
    }
  };
}

async function main(argv: string[]): Promise<number> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // no .env file: the environment alone is used
  }
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      assets: { type: 'string' },
      out: { type: 'string' },
      voice: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, planFile] = positionals;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (command !== 'render' || !planFile || !values.assets) {
    console.error(USAGE);
    return 1;
  }
  if (values.voice !== undefined && values.voice !== 'fake' && values.voice !== 'elevenlabs') {
    console.error('--voice must be "fake" or "elevenlabs"');
    return 1;
  }
  try {
    const result = await produceVideo({
      planFile: path.resolve(planFile),
      assetsDir: path.resolve(values.assets),
      outFile: values.out ? path.resolve(values.out) : undefined,
      voice: values.voice ? createVoiceProvider(values.voice, process.env) : undefined,
      onStage: (stage, detail) => console.log(`[${stage}]${detail ? ` ${detail}` : ''}`),
      onRenderProgress: progressPrinter(),
    });
    console.log(
      `Video ready: ${result.outFile} (${result.durationSeconds.toFixed(1)} s, ${result.voiceCharacters} voice characters)`,
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

process.exitCode = await main(process.argv.slice(2));
