import { StudioError } from '@dailies-crew/studio';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { failure } from './result';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('failure', () => {
  it('shows a studio error with each problem next to its field', () => {
    const error = new StudioError('Invalid line:\n- name: too short\n- brand.colors.text: bad', [
      { path: 'name', message: 'too short' },
      { path: 'brand.colors.text', message: 'bad' },
      { path: 'name', message: 'second problem' },
    ]);
    expect(failure(error, 'oops')).toEqual({
      status: 'error',
      message: 'Invalid line:',
      fields: { name: 'too short', 'brand.colors.text': 'bad' },
    });
    expect(failure(new StudioError('No video with id x'), 'oops')).toEqual({
      status: 'error',
      message: 'No video with id x',
      fields: {},
    });
  });

  it('hides anything else behind the generic message and logs it on the server', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(failure(new Error('connection refused at 127.0.0.1'), 'Something went wrong')).toEqual({
      status: 'error',
      message: 'Something went wrong',
      fields: {},
    });
    expect(log).toHaveBeenCalledOnce();
  });
});
