import { describe, expect, it } from 'vitest';
import { DUCK_HOLD_FRAMES, musicVolumeAt } from './audio';

const music = { volume: 0.2, duckTo: 0.05 };
const voice = [{ from: 100, durationInFrames: 50 }];

describe('musicVolumeAt', () => {
  it('plays at full volume far from the voice', () => {
    expect(musicVolumeAt(50, voice, music, 300)).toBeCloseTo(0.2);
  });
  it('ducks while the voice speaks', () => {
    expect(musicVolumeAt(120, voice, music, 300)).toBeCloseTo(0.05);
  });
  it('ramps down over the 6 frames before the voice', () => {
    expect(musicVolumeAt(97, voice, music, 300)).toBeCloseTo(0.05 + 0.15 * 0.5);
  });
  it('stays ducked across a gap shorter than 20 frames between two lines', () => {
    expect(DUCK_HOLD_FRAMES).toBe(20);
    const lines = [
      { from: 100, durationInFrames: 50 },
      { from: 165, durationInFrames: 50 },
    ];
    for (let frame = 150; frame < 165; frame += 1) {
      expect(musicVolumeAt(frame, lines, music, 400)).toBeCloseTo(0.05);
    }
  });
  it('swells back to full volume in the middle of a 40-frame gap', () => {
    const lines = [
      { from: 100, durationInFrames: 50 },
      { from: 190, durationInFrames: 50 },
    ];
    expect(musicVolumeAt(170, lines, music, 400)).toBeCloseTo(0.2);
    expect(musicVolumeAt(150, lines, music, 400)).toBeLessThan(0.2);
  });
  it('fades in over the first 10 frames and out over the last 20', () => {
    expect(musicVolumeAt(0, [], music, 300)).toBe(0);
    expect(musicVolumeAt(5, [], music, 300)).toBeCloseTo(0.1);
    expect(musicVolumeAt(289, [], music, 300)).toBeCloseTo(0.1);
    expect(musicVolumeAt(299, [], music, 300)).toBe(0);
  });
});
