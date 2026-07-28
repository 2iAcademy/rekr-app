import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearAccessToken,
  getAccessToken,
  notifySessionExpired,
  onSessionExpired,
  setAccessToken,
} from './tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    clearAccessToken();
  });

  it('starts empty', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('holds the token it was given', () => {
    setAccessToken('jwt');

    expect(getAccessToken()).toBe('jwt');
  });

  it('clears the token', () => {
    setAccessToken('jwt');
    clearAccessToken();

    expect(getAccessToken()).toBeNull();
  });

  it('notifies every subscriber when the session expires', () => {
    const first = vi.fn();
    const second = vi.fn();
    onSessionExpired(first);
    onSessionExpired(second);

    notifySessionExpired();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    unsubscribe();
    notifySessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });
});
