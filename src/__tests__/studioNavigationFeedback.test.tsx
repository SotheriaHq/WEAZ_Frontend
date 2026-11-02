import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useStudioNativeNavBridge } from '@/hooks/useStudioNativeNavBridge';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

function Bridge() {
  useStudioNativeNavBridge();
  const location = useLocation();
  useEffect(() => {
    postStudioNativeEvent({ type: 'ROUTE_CHANGED',
      path: `${location.pathname}${location.search}${location.hash}` });
  }, [location]);
  return <output aria-label="Studio location">{location.pathname}{location.search}</output>;
}

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState(null, '', '/studio?surface=mobile-app&tab=customers');
});
afterEach(() => { delete window.ReactNativeWebView; vi.restoreAllMocks(); });

it('drops late React route reports after the browser has moved to another section', () => {
  const postMessage = vi.fn();
  window.ReactNativeWebView = { postMessage };
  postStudioNativeEvent({ type: 'ROUTE_CHANGED', path: '/studio?surface=mobile-app' });
  expect(postMessage).not.toHaveBeenCalled();
  postStudioNativeEvent({ type: 'ROUTE_CHANGED', path: '/studio?surface=mobile-app&tab=customers' });
  expect(postMessage).toHaveBeenCalledOnce();
});

it('does not navigate again when native acknowledges the reported route', async () => {
  const postMessage = vi.fn();
  window.ReactNativeWebView = { postMessage };
  render(<BrowserRouter><Bridge /></BrowserRouter>);
  const replace = vi.spyOn(history, 'replaceState');
  await act(async () => { window.__WIEZ_STUDIO_NAV__?.('/studio?tab=customers'); });
  expect(replace).not.toHaveBeenCalled();
  expect(postMessage).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Studio location')).toHaveTextContent('tab=customers');
});

it('settles rapid native commands on the last destination without an echo loop', async () => {
  const messages: { type: string; path?: string }[] = [];
  window.ReactNativeWebView = { postMessage: (raw) => {
    const event = JSON.parse(raw);
    messages.push(event);
    if (messages.length > 10) throw new Error('Unbounded navigation feedback');
    // Existing native versions can acknowledge a route by sending it back.
    if (event.type === 'ROUTE_CHANGED') window.__WIEZ_STUDIO_NAV__?.(event.path);
  } };
  render(<BrowserRouter><Bridge /></BrowserRouter>);
  await act(async () => {
    window.__WIEZ_STUDIO_NAV__?.('/studio?tab=orders');
    window.__WIEZ_STUDIO_NAV__?.('/studio?tab=analytics');
  });
  expect(screen.getByLabelText('Studio location')).toHaveTextContent('tab=analytics');
  expect(messages.length).toBeLessThanOrEqual(3);
  const count = messages.length;
  await act(async () => { await Promise.resolve(); });
  expect(messages).toHaveLength(count);
});

it('rejects protocol-relative external navigation', async () => {
  window.ReactNativeWebView = { postMessage: vi.fn() };
  render(<BrowserRouter><Bridge /></BrowserRouter>);
  await act(async () => { window.__WIEZ_STUDIO_NAV__?.('//other.example/studio'); });
  expect(window.location.pathname).toBe('/studio');
  expect(window.location.search).toContain('tab=customers');
});
