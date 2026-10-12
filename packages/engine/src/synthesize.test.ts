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
});
