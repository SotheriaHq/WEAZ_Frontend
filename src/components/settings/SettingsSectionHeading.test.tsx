import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsSectionHeading } from './SettingsSectionHeading';
afterEach(cleanup);
describe('Settings section headings', () => {
  it('keeps the semantic label before one decorative divider', () => {
    render(<SettingsSectionHeading id="login-sessions">Login sessions</SettingsSectionHeading>);
    const heading = screen.getByRole('heading', { level: 2, name: 'Login sessions' });
    expect(heading.id).toBe('login-sessions');
    expect(heading.children).toHaveLength(2);
    expect(heading.children[0].textContent).toBe('Login sessions');
    expect(heading.children[1].getAttribute('aria-hidden')).toBe('true');
    expect((heading as HTMLElement).style.columnGap).toBe('12px');
    expect((heading.children[1] as HTMLElement).style.height).toBe('2px');
  });
  it('preserves nested heading levels, ids and fully wrapping long labels', () => {
    const title = 'A very long Settings heading with full words and averylongunbrokentoken';
    render(<SettingsSectionHeading as="h3" className="text-red-600" aria-label={title}>{title}</SettingsSectionHeading>);
    const heading = screen.getByRole('heading', { level: 3, name: title });
    expect(heading.textContent).toBe(title);
    expect(heading.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
    expect((heading.children[0] as HTMLElement).style.overflowWrap).toBe('anywhere');
  });
});
