import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { customFetch } from '@/api/customFetch';
import { useOfferImpression } from './useOfferImpression';
vi.mock('@/api/customFetch', () => ({ customFetch: vi.fn().mockResolvedValue(undefined) }));
let notify: (entries: IntersectionObserverEntry[]) => void;
const observe = vi.fn();
const disconnect = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_DATA_ANALYTICS_ENABLED', 'true');
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof notify) {
        notify = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function visible(ratio: number): void {
  act(() =>
    notify([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry]),
  );
}
describe('opt-in offer impressions', () => {
  it('sends once per offer only when half the active card is visible', () => {
    const ref = { current: document.createElement('div') };
    const { rerender, unmount } = renderHook(({ id }) => useOfferImpression(ref, id, 2), {
      initialProps: { id: 12 },
    });
    visible(0.2);
    expect(customFetch).not.toHaveBeenCalled();
    visible(0.8);
    visible(1);
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(customFetch).toHaveBeenCalledWith(
      '/api/data/offers/12/impression',
      expect.objectContaining({ body: JSON.stringify({ position: 2 }) }),
    );
    rerender({ id: 13 });
    visible(1);
    expect(customFetch).toHaveBeenCalledTimes(2);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
  it('does nothing in the default configuration', () => {
    vi.stubEnv('VITE_DATA_ANALYTICS_ENABLED', '');
    renderHook(() => useOfferImpression({ current: document.createElement('div') }, 12, 1));
    expect(observe).not.toHaveBeenCalled();
  });
  it('waits until the document becomes visible and swallows transport failures', async () => {
    let state = 'hidden';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => state as DocumentVisibilityState,
    );
    vi.mocked(customFetch).mockRejectedValueOnce(new Error('offline'));
    renderHook(() => useOfferImpression({ current: document.createElement('div') }, 12, 1));
    visible(1);
    expect(customFetch).not.toHaveBeenCalled();
    await act(async () => {
      state = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(customFetch).toHaveBeenCalledTimes(1);
  });
  it('does not observe while the card or offer is missing', () => {
    renderHook(() => useOfferImpression({ current: null }, 12, 1));
    renderHook(() => useOfferImpression({ current: document.createElement('div') }, undefined, 1));
    expect(observe).not.toHaveBeenCalled();
    expect(customFetch).not.toHaveBeenCalled();
  });
  it('keeps the feed usable when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    expect(() =>
      renderHook(() => useOfferImpression({ current: document.createElement('div') }, 12, 1)),
    ).not.toThrow();
    expect(customFetch).not.toHaveBeenCalled();
  });
  it('accepts exactly half visibility and does not report a previously viewed offer again', () => {
    const ref = { current: document.createElement('div') };
    const { rerender } = renderHook(({ id }) => useOfferImpression(ref, id, 1), {
      initialProps: { id: 12 },
    });
    visible(0);
    expect(customFetch).not.toHaveBeenCalled();
    visible(0.5);
    expect(customFetch).toHaveBeenCalledTimes(1);
    rerender({ id: 13 });
    visible(0.5);
    const observations = observe.mock.calls.length;
    rerender({ id: 12 });
    expect(observe).toHaveBeenCalledTimes(observations);
    expect(customFetch).toHaveBeenCalledTimes(2);
  });
  it('removes visibility listeners on unmount before a hidden card can be reported', () => {
    let state = 'hidden';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => state as DocumentVisibilityState,
    );
    const { unmount } = renderHook(() =>
      useOfferImpression({ current: document.createElement('div') }, 12, 1),
    );
    visible(1);
    unmount();
    state = 'visible';
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(customFetch).not.toHaveBeenCalled();
  });
});
