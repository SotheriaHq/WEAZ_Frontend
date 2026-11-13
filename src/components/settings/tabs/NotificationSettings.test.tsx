import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationSettings from './NotificationSettings';
import { NOTIFICATION_SECTIONS, PUSH_MASTER_TOGGLE } from '@/notifications/notificationSections';
import type { NotificationSettings as Settings } from '@/notifications/notificationSettings';
const mock = vi.hoisted(() => ({ settings: {} as Settings, patch: vi.fn(), retry: vi.fn(), failed: null as null | { patch: object; message: string }, loading: false, loadError: null as string | null }));
vi.mock('@/notifications/useNotificationSettings', () => ({ useNotificationSettings: () => ({
  settings: mock.settings, patch: mock.patch, retryFailed: mock.retry, dismissFailure: vi.fn(),
  failed: mock.failed, loading: mock.loading, loadError: mock.loadError, reload: vi.fn(), isPending: () => false,
}) }));
function Location() { return <output aria-label="Location">{useLocation().search}</output>; }
function mount(section = '') { return render(<MemoryRouter initialEntries={['/settings?tab=notifications' + (section ? '&notificationSection=' + section : '')]}><NotificationSettings /><Location /></MemoryRouter>); }
function defaults(): Settings {
  return {
    security: { login: true, logout: true },
    push: { enabled: true, sound: true, vibration: true, showPreview: true, quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00' },
    social: { threads: true, follows: true, patches: true },
    comments: { enabled: true, replies: true, fromUnpatchedUsers: true },
    tags: { mentions: true, fromUnpatchedUsers: true },
    collections: { lifecycle: true, access: true },
    brand: { patchRequests: true, contributions: true, verificationPrompts: true },
    orders: { placed: true, statusChanges: true },
    reviews: { reminders: true, replies: true, moderation: true },
    fit: { reminders: true, shares: true, approvals: true },
    messaging: { newMessages: true, reminders: true, moderation: true, desktop: true, sound: true, readReceipts: true, deliveryReceipts: true },
  };
}

beforeEach(() => { vi.clearAllMocks(); mock.settings = defaults(); mock.failed = null; mock.loading = false; mock.loadError = null; });
describe('notification section navigation and controls', () => {
  it('shows an overview, opens one section, retains the Settings tab and returns', () => {
    mount(); expect(screen.queryByRole('switch', { name: 'Review replies' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Reviews All on/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Reviews' })).toHaveFocus();
    expect(screen.getByRole('switch', { name: 'Review replies' })).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toHaveTextContent('tab=notifications');
    fireEvent.click(screen.getByRole('button', { name: /Notification settings/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Notification settings' })).toBeInTheDocument();
  });
  it('hides push-only sections while keeping inbox topics and receipt choices', () => {
    mock.settings.push.enabled = false; mount();
    expect(screen.queryByRole('button', { name: /Quiet hours/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Messages/ }));
    expect(screen.getByRole('switch', { name: 'Read receipts' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Delivery receipts' })).toBeInTheDocument();
  });
  it('hides quiet-hour fields until enabled, preserving stored times', () => {
    const view = mount('quiet-hours'); expect(screen.queryByLabelText('Starts (UTC)')).toBeNull();
    mock.settings = { ...mock.settings, push: { ...mock.settings.push, quietHoursEnabled: true } };
    view.rerender(<MemoryRouter><NotificationSettings /></MemoryRouter>);
    expect(screen.getByLabelText('Starts (UTC)')).toHaveValue('22:00');
    fireEvent.blur(screen.getByLabelText('Starts (UTC)'), { target: { value: '23:15' } });
    expect(mock.patch).toHaveBeenCalledWith({ section: 'push', key: 'quietHoursStart', value: '23:15' });
  });
  it('a push-only deep link with push off offers the master control', () => {
    mock.settings.push.enabled = false; mount('alerts');
    expect(screen.queryByRole('switch', { name: 'Vibration' })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Push notifications' }));
    expect(mock.patch).toHaveBeenCalledWith({ section: 'push', key: 'enabled', value: true });
  });
  it('hides dependent comment/tag controls while keeping their saved values', () => {
    mock.settings.comments.enabled = false; mock.settings.tags.mentions = false; mount('activity');
    expect(screen.queryByRole('switch', { name: 'Replies' })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Tags from unpatched/ })).toBeNull();
    expect(mock.settings.comments.replies).toBe(true);
  });
  it('shows failed-save retry and safe unknown-section handling', () => {
    mock.failed = { patch: {}, message: 'Offline' }; mount('invalid');
    expect(screen.getAllByRole('alert').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' })); expect(mock.retry).toHaveBeenCalledOnce();
  });
  it('every canonical boolean preference has one unique reachable control', () => {
    const toggles = [PUSH_MASTER_TOGGLE, ...NOTIFICATION_SECTIONS.flatMap(section => section.items)];
    expect(new Set(toggles.map(item => item.id)).size).toBe(toggles.length);
    for (const [section, values] of Object.entries(defaults())) for (const key of Object.keys(values)) {
      if (!['quietHoursStart', 'quietHoursEnd'].includes(key)) expect(toggles.some(item => item.section === section && item.key === key), section + '.' + key).toBe(true);
    }
  });
});
