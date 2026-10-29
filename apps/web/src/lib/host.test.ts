import { describe, expect, it } from 'vitest';
import { isAllowedHost } from './host';

describe('isAllowedHost', () => {
  it('accepts this machine on the panel port', () => {
    expect(isAllowedHost('127.0.0.1:3300', '3300')).toBe(true);
    expect(isAllowedHost('localhost:3300', '3300')).toBe(true);
    expect(isAllowedHost('LOCALHOST:3300', '3300')).toBe(true);
  });

  it('refuses any other name, another port and a missing or odd header', () => {
    expect(isAllowedHost('evil.example:3300', '3300')).toBe(false);
    expect(isAllowedHost('127.0.0.1.nip.io:3300', '3300')).toBe(false);
    expect(isAllowedHost('localhost.evil.example', undefined)).toBe(false);
    expect(isAllowedHost('192.168.0.10:3300', '3300')).toBe(false);
    expect(isAllowedHost('127.0.0.1:3301', '3300')).toBe(false);
    expect(isAllowedHost('127.0.0.1', '3300')).toBe(false);
    expect(isAllowedHost(null, '3300')).toBe(false);
    expect(isAllowedHost('', undefined)).toBe(false);
    expect(isAllowedHost('user@127.0.0.1:3300', '3300')).toBe(false);
    expect(isAllowedHost('localhost:3300@evil', '3300')).toBe(false);
    expect(isAllowedHost('[::1]:3300', '3300')).toBe(false);
    expect(isAllowedHost('127.0.0.1.evil.com:3300', '3300')).toBe(false);
  });

  it('takes any port of this machine when the port is not known', () => {
    expect(isAllowedHost('127.0.0.1:3310', undefined)).toBe(true);
    expect(isAllowedHost('localhost', undefined)).toBe(true);
  });
});
