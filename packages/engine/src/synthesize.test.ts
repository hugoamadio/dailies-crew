import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validatePlan } from '@dailies-crew/plan';
import { pieceCatalog } from '@dailies-crew/scenes/specs';
import { describe, expect, it } from 'vitest';
import { synthesizeVoice } from './synthesize';
import { FakeVoiceProvider, type SynthesisRequest, type VoiceProvider } from './voice';

const brand = {
  colors: {
    background: '#101010',
    surface: '#202020',
    text: '#ffffff',
    primary: '#333333',
    accent: '#ffc83d',
  },
  headingFont: 'Montserrat',
  bodyFont: 'Inter',
};

describe('synthesizeVoice', () => {
  it('writes one audio file per line and sends the neighbouring lines along', async () => {
    const validated = validatePlan(
      {
        version: 1,
        brand,
        voice: {
          provider: 'fake',
          voiceId: 'v',
          language: 'pt-BR',
          lines: [
            { id: 'one', text: 'Primeira linha' },
            { id: 'two', text: 'Segunda linha' },
          ],
        },
        scenes: [
          {
            id: 'a',
            piece: 'kinetic-title',
            params: { lines: ['A'] },
            timing: { kind: 'line', lineId: 'one' },
          },
          {
            id: 'b',
            piece: 'kinetic-title',
            params: { lines: ['B'] },
            timing: { kind: 'line', lineId: 'two' },
          },
        ],
      },
      pieceCatalog,
    );
    if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
    const calls: SynthesisRequest[] = [];
    const fake = new FakeVoiceProvider();
    const provider: VoiceProvider = {
      name: 'fake',
      synthesize: (request) => {
        calls.push(request);
        return fake.synthesize(request);
      },
    };
    const publicDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-voice-'));

    const { tracks, characters } = await synthesizeVoice(validated.value, provider, publicDir);

    expect(tracks.map((track) => track.src)).toEqual(['voice/one.wav', 'voice/two.wav']);
    expect(calls.map((call) => [call.previousText, call.nextText])).toEqual([
      [undefined, 'Segunda linha'],
      ['Primeira linha', undefined],
    ]);
    expect(characters).toBe('Primeira linha'.length + 'Segunda linha'.length);
    expect((await fs.stat(path.join(publicDir, 'voice/one.wav'))).size).toBeGreaterThan(44);
    await fs.rm(publicDir, { recursive: true, force: true });
  });

  it('pays once per line: a retry reuses the cached lines and synthesizes only the changed one', async () => {
    const jobDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-cache-'));
    try {
      const cacheFile = path.join(jobDir, 'voice-cache.json');
      const fake = new FakeVoiceProvider();
      const spoken: string[] = [];
      const provider: VoiceProvider = {
        name: 'fake',
        synthesize: (request) => {
          spoken.push(request.text);
          return fake.synthesize(request);
        },
      };
      const plan = (second: string) => {
        const validated = validatePlan(
          {
            version: 1,
            brand,
            voice: {
              provider: 'fake',
              voiceId: 'v',
              language: 'pt-BR',
              lines: [
                { id: 'one', text: 'Primeira linha' },
                { id: 'two', text: second },
              ],
            },
            scenes: ['one', 'two'].map((lineId) => ({
              id: lineId,
              piece: 'kinetic-title',
              params: { lines: ['A'] },
              timing: { kind: 'line', lineId },
            })),
          },
          pieceCatalog,
        );
        if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
        return validated.value;
      };

      const first = await synthesizeVoice(plan('Segunda linha'), provider, path.join(jobDir, 'a'), {
        cacheFile,
      });
      const again = await synthesizeVoice(plan('Segunda linha'), provider, path.join(jobDir, 'b'), {
        cacheFile,
      });
      const changed = await synthesizeVoice(plan('Outra linha'), provider, path.join(jobDir, 'c'), {
        cacheFile,
      });

      expect(spoken).toEqual(['Primeira linha', 'Segunda linha', 'Outra linha']);
      expect([first.characters, again.characters, changed.characters]).toEqual([27, 0, 11]);
      expect([again.cachedCharacters, changed.cachedCharacters]).toEqual([27, 14]);
      expect(again.tracks).toEqual(first.tracks);
      expect((await fs.stat(path.join(jobDir, 'b/voice/two.wav'))).size).toBeGreaterThan(44);
    } finally {
      await fs.rm(jobDir, { recursive: true, force: true });
    }
  });

  describe('the voice cache', () => {
    const lines = (text: string, language = 'pt-BR') =>
      validatePlan(
        {
          version: 1,
          brand,
          voice: { provider: 'fake', voiceId: 'v', language, lines: [{ id: 'one', text }] },
          scenes: [
            {
              id: 'one',
              piece: 'kinetic-title',
              params: { lines: ['A'] },
              timing: { kind: 'line', lineId: 'one' },
            },
          ],
        },
        pieceCatalog,
      );
    const plan = (text: string, language?: string) => {
      const validated = lines(text, language);
      if (!validated.ok) throw new Error(JSON.stringify(validated.issues));
      return validated.value;
    };
    const counting = (cacheKey = 'fake') => {
      const fake = new FakeVoiceProvider();
      const spoken: string[] = [];
      const provider: VoiceProvider = {
        name: 'fake',
        cacheKey,
        synthesize: (request) => {
          spoken.push(request.text);
          return fake.synthesize(request);
        },
      };
      return { provider, spoken };
    };
    const withJob = async (run: (jobDir: string, cacheFile: string) => Promise<void>) => {
      const jobDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-cache-'));
      try {
        await run(jobDir, path.join(jobDir, 'voice-cache.json'));
      } finally {
        await fs.rm(jobDir, { recursive: true, force: true });
      }
    };

    it('synthesizes again when the language or the provider settings change', async () => {
      await withJob(async (jobDir, cacheFile) => {
        const { provider, spoken } = counting();
        const other = counting('fake:other-model');
        await synthesizeVoice(plan('Oi'), provider, path.join(jobDir, 'a'), { cacheFile });
        await synthesizeVoice(plan('Oi', 'en-US'), provider, path.join(jobDir, 'b'), { cacheFile });
        await synthesizeVoice(plan('Oi'), other.provider, path.join(jobDir, 'c'), { cacheFile });
        await synthesizeVoice(plan('Oi'), provider, path.join(jobDir, 'd'), { cacheFile });
        expect([spoken.length, other.spoken.length]).toEqual([2, 1]);
      });
    });

    it.each([
      ['null', () => 'null'],
      ['not JSON', () => '{"half'],
      ['an array', () => '[]'],
    ])('treats an index that is %s as empty', async (_name, content) => {
      await withJob(async (jobDir, cacheFile) => {
        await fs.writeFile(cacheFile, content());
        const { provider, spoken } = counting();
        const outcome = await synthesizeVoice(plan('Oi'), provider, path.join(jobDir, 'a'), {
          cacheFile,
        });
        expect(spoken).toEqual(['Oi']);
        expect(outcome.tracks[0]!.words.length).toBeGreaterThan(0);
        expect((await fs.readdir(jobDir)).some((name) => name.endsWith('.tmp'))).toBe(false);
      });
    });

    it('synthesizes again for an entry without words or time, and for an empty audio file', async () => {
      await withJob(async (jobDir, cacheFile) => {
        const { provider, spoken } = counting();
        await synthesizeVoice(plan('Oi'), provider, path.join(jobDir, 'a'), { cacheFile });
        const index = JSON.parse(await fs.readFile(cacheFile, 'utf8')) as Record<
          string,
          { file: string; words?: unknown; durationSeconds?: unknown }
        >;
        const [key, entry] = Object.entries(index)[0]!;

        index[key] = { file: entry.file, durationSeconds: entry.durationSeconds };
        await fs.writeFile(cacheFile, JSON.stringify(index));
        const noWords = await synthesizeVoice(plan('Oi'), provider, path.join(jobDir, 'b'), {
          cacheFile,
        });
        expect(spoken).toHaveLength(2);
        expect(Array.isArray(noWords.tracks[0]!.words)).toBe(true);

        await fs.writeFile(path.join(jobDir, entry.file), '');
        await synthesizeVoice(plan('Oi'), provider, path.join(jobDir, 'c'), { cacheFile });
        expect(spoken).toHaveLength(3);
        expect((await fs.stat(path.join(jobDir, entry.file))).size).toBeGreaterThan(0);
      });
    });

    it('stops before the next line when aborted', async () => {
      await withJob(async (jobDir, cacheFile) => {
        const controller = new AbortController();
        const fake = new FakeVoiceProvider();
        const spoken: string[] = [];
        const provider: VoiceProvider = {
          name: 'fake',
          synthesize: (request) => {
            spoken.push(request.text);
            controller.abort();
            return fake.synthesize(request);
          },
        };
        const two = validatePlan(
          {
            version: 1,
            brand,
            voice: {
              provider: 'fake',
              voiceId: 'v',
              language: 'pt-BR',
              lines: [
                { id: 'one', text: 'Primeira' },
                { id: 'two', text: 'Segunda' },
              ],
            },
            scenes: ['one', 'two'].map((lineId) => ({
              id: lineId,
              piece: 'kinetic-title',
              params: { lines: ['A'] },
              timing: { kind: 'line', lineId },
            })),
          },
          pieceCatalog,
        );
        if (!two.ok) throw new Error('bad plan');
        await expect(
          synthesizeVoice(two.value, provider, path.join(jobDir, 'a'), {
            cacheFile,
            signal: controller.signal,
          }),
        ).rejects.toThrow();
        expect(spoken).toEqual(['Primeira']);
      });
    });
  });
});
