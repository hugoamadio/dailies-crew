import { describe, expect, it } from 'vitest';
import { musicOptions } from './music';

describe('musicOptions', () => {
  it('adds the stored track when the folder no longer lists it', () => {
    expect(musicOptions(['music/a.mp3'], 'music/gone.mp3')).toEqual([
      'music/a.mp3',
      'music/gone.mp3',
    ]);
  });
  it('does not repeat a listed track and ignores no music', () => {
    expect(musicOptions(['music/a.mp3'], 'music/a.mp3')).toEqual(['music/a.mp3']);
    expect(musicOptions(['music/a.mp3'], null)).toEqual(['music/a.mp3']);
    expect(musicOptions([], '')).toEqual([]);
  });
});
