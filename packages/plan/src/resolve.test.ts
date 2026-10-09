import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  catalogFromSpecs,
  type PieceLimits,
  type PlanInput,
  resolvePlan,
  validatePlan,
  type VoiceTrack,
} from './index';

const anySpec = (id: string) => ({
  id,
  title: id,
  description: id,
  paramsSchema: z.object({}),
  assetParams: [],
  minSeconds: 0.5,
  maxSeconds: 15,
  example: {},
});
const catalog = catalogFromSpecs([anySpec('title'), anySpec('photo')]);
const wide: PieceLimits = () => ({ minSeconds: 0.5, maxSeconds: 30 });

const brand = {
  colors: {
    background: '#101010',
    surface: '#202020',
    text: '#ffffff',
    primary: '#333333',
    accent: '#ffc83d',
  },
  headingFont: 'Montserrat' as const,
  bodyFont: 'Inter' as const,
};

function plan(scenes: PlanInput['scenes'], lineIds = ['one']) {
  const result = validatePlan(
    {
      version: 1,
      brand,
      voice: {
        provider: 'fake',
        voiceId: 'v',
        language: 'pt-BR',
        lines: lineIds.map((id) => ({ id, text: 'Olá mundo' })),
      },
      music: { track: 'music/loop.mp3' },
      scenes,
    },
    catalog,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

const track = (lineId: string, durationSeconds = 1): VoiceTrack => ({
  lineId,
  src: `voice/${lineId}.wav`,
  durationSeconds,
  words: [
    { text: 'Olá', startSeconds: 0.05, endSeconds: 0.4 },
    { text: 'mundo', startSeconds: 0.45, endSeconds: 0.9 },
  ],
});

describe('resolvePlan', () => {
  it('turns lines and seconds into frames, overlapping only the transition', () => {
    const resolved = resolvePlan(
      plan([
        {
          id: 'a',
          piece: 'title',
          params: {},
          timing: { kind: 'line', lineId: 'one' },
          transitionOut: { kind: 'fade' },
        },
        { id: 'b', piece: 'photo', params: {}, timing: { kind: 'seconds', seconds: 14 } },
      ]),
      [track('one')],
      wide,
    );
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.issues));
    const value = resolved.value;
    expect(value.scenes.map((s) => [s.id, s.from, s.durationInFrames, s.transitionOut])).toEqual([
      ['a', 0, 57, { kind: 'fade', direction: 'left', frames: 12 }],
      ['b', 45, 420, null],
    ]);
    expect(value.durationInFrames).toBe(465);
    expect(value.voice).toEqual([
      { lineId: 'one', src: 'voice/one.wav', from: 6, durationInFrames: 30 },
    ]);
    expect(value.captions.words).toEqual([
      { text: 'Olá', startMs: 250, endMs: 600, timestampMs: null, confidence: null },
      {
        text: ' mundo',
        startMs: 650,
        endMs: 1100,
        timestampMs: null,
        confidence: null,
        pageBreakAfter: true,
      },
    ]);
    expect(value.music).toEqual({ src: 'assets/music/loop.mp3', volume: 0.22, duckTo: 0.07 });
    expect([value.width, value.height, value.fps]).toEqual([1080, 1920, 30]);
  });

  it('starts the voice later when a long transition comes into its scene', () => {
    const resolved = resolvePlan(
      plan([
        {
          id: 'a',
          piece: 'photo',
          params: {},
          timing: { kind: 'seconds', seconds: 14 },
          transitionOut: { kind: 'slide', seconds: 1 },
        },
        { id: 'b', piece: 'title', params: {}, timing: { kind: 'line', lineId: 'one' } },
      ]),
      [track('one')],
      wide,
    );
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.issues));
    expect(resolved.value.voice[0]?.from).toBe(420 + 15);
  });

  it('treats a cut as no transition at all', () => {
    const resolved = resolvePlan(
      plan([
        {
          id: 'a',
          piece: 'title',
          params: {},
          timing: { kind: 'line', lineId: 'one' },
          transitionOut: { kind: 'cut' },
        },
        { id: 'b', piece: 'photo', params: {}, timing: { kind: 'seconds', seconds: 14 } },
      ]),
      [track('one')],
      wide,
    );
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.issues));
    expect(resolved.value.scenes[0]).toMatchObject({ durationInFrames: 45, transitionOut: null });
    expect(resolved.value.scenes[1]?.from).toBe(45);
  });

  it('stretches a short line up to the minimum of its piece', () => {
    const resolved = resolvePlan(
      plan([
        { id: 'a', piece: 'title', params: {}, timing: { kind: 'line', lineId: 'one' } },
        { id: 'b', piece: 'photo', params: {}, timing: { kind: 'seconds', seconds: 13 } },
      ]),
      [track('one')],
      (id) =>
        id === 'title' ? { minSeconds: 3, maxSeconds: 30 } : { minSeconds: 0.5, maxSeconds: 30 },
    );
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.issues));
    expect(resolved.value.scenes[0]?.durationInFrames).toBe(90);
  });

  it('refuses a voice line longer than its piece allows', () => {
    const resolved = resolvePlan(
      plan([
        { id: 'a', piece: 'title', params: {}, timing: { kind: 'line', lineId: 'one' } },
        { id: 'b', piece: 'photo', params: {}, timing: { kind: 'seconds', seconds: 14 } },
      ]),
      [track('one')],
      (id) =>
        id === 'title' ? { minSeconds: 0.5, maxSeconds: 1 } : { minSeconds: 0.5, maxSeconds: 30 },
    );
    expect(resolved).toEqual({
      ok: false,
      issues: [
        {
          path: 'scenes.0',
          message:
            'scene "a" lasts 1.5 s, but piece "title" lasts at most 1 s; shorten its voice line or split the scene',
        },
      ],
    });
  });

  it('refuses a scene shorter than the transition coming into it', () => {
    const resolved = resolvePlan(
      plan([
        {
          id: 'a',
          piece: 'title',
          params: {},
          timing: { kind: 'line', lineId: 'one' },
          transitionOut: { kind: 'fade', seconds: 1 },
        },
        {
          id: 'b',
          piece: 'photo',
          params: {},
          timing: { kind: 'seconds', seconds: 0.5 },
          transitionOut: { kind: 'fade' },
        },
        { id: 'c', piece: 'photo', params: {}, timing: { kind: 'seconds', seconds: 14 } },
      ]),
      [track('one')],
      wide,
    );
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.issues).toEqual([
      { path: 'scenes.1', message: 'scene is shorter than the transition coming into it' },
    ]);
  });

  it.each([
    [5, 'the video lasts 6.5 s; it must last between 15 and 60 s'],
    [15, 'the video lasts 61.5 s; it must last between 15 and 60 s'],
  ])('refuses a video outside 15-60 s (silent scenes of %s s)', (seconds, message) => {
    const scenes: PlanInput['scenes'] = [
      { id: 'a', piece: 'title', params: {}, timing: { kind: 'line', lineId: 'one' } },
    ];
    for (const id of seconds === 5 ? ['b'] : ['b', 'c', 'd', 'e']) {
      scenes.push({ id, piece: 'photo', params: {}, timing: { kind: 'seconds', seconds } });
    }
    expect(resolvePlan(plan(scenes), [track('one')], wide)).toEqual({
      ok: false,
      issues: [{ path: 'scenes', message }],
    });
  });

  it('reports a line without a voice track', () => {
    const resolved = resolvePlan(
      plan([
        { id: 'a', piece: 'title', params: {}, timing: { kind: 'line', lineId: 'one' } },
        { id: 'b', piece: 'photo', params: {}, timing: { kind: 'seconds', seconds: 14 } },
      ]),
      [],
      wide,
    );
    expect(resolved).toEqual({
      ok: false,
      issues: [{ path: 'scenes.0.timing.lineId', message: 'no voice track for line "one"' }],
    });
  });
});
