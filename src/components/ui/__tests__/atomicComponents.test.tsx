import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Input, Textarea, Card, Badge, Text } from '@/components/ui';

describe('Atomic UI Components — Wave 2 Migration', () => {
  describe('Button', () => {
    it('renders primary variant with semantic action-primary classes', () => {
      render(<Button variant="primary">Confirm Action</Button>);
      const btn = screen.getByRole('button', { name: /confirm action/i });
      expect(btn).toBeDefined();
      expect(btn.className).toContain('var(--wiez-action-primary)');
    });

    it('renders brand variant with semantic action-brand classes', () => {
      render(<Button variant="brand">Add to Bag</Button>);
      const btn = screen.getByRole('button', { name: /add to bag/i });
      expect(btn).toBeDefined();
      expect(btn.className).toContain('var(--wiez-action-brand)');
      expect(btn.className).toContain('var(--wiez-action-brand-hover)');
    });

    it('renders secondary tactile variant', () => {
      render(<Button variant="secondary">Cancel</Button>);
      const btn = screen.getByRole('button', { name: /cancel/i });
      expect(btn.className).toContain('neu-pressed-button');
      expect(btn.className).toContain('var(--wiez-action-secondary)');
    });

    it('renders outline variant with 2px border and semantic border token', () => {
      render(<Button variant="outline">Learn More</Button>);
      const btn = screen.getByRole('button', { name: /learn more/i });
      expect(btn.className).toContain('border-2');
      expect(btn.className).toContain('var(--wiez-border-default)');
    });

    it('handles disabled state and prevents clicks', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled Button</Button>);
      const btn = screen.getByRole('button', { name: /disabled button/i });
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles loading state with aria-busy and hides content', () => {
      render(<Button loading>Processing</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn.getAttribute('aria-busy')).toBe('true');
    });

    it('renders leading and trailing icons', () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">←</span>}
          rightIcon={<span data-testid="right-icon">→</span>}
        >
          Navigate
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeDefined();
      expect(screen.getByTestId('right-icon')).toBeDefined();
    });
  });

  describe('Input', () => {
    it('renders with label and semantic input tokens', () => {
      render(<Input label="Email Address" placeholder="you@example.com" required />);
      expect(screen.getByText('Email Address')).toBeDefined();
      expect(screen.getByText('*')).toBeDefined();
      const input = screen.getByPlaceholderText('you@example.com');
      expect(input.className).toContain('var(--wiez-surface-page)');
      expect(input.className).toContain('var(--wiez-text-primary)');
    });

    it('renders error state with semantic danger token', () => {
      render(<Input label="Username" error="Username is already taken" />);
      const errorMsg = screen.getByText('Username is already taken');
      expect(errorMsg.className).toContain('var(--wiez-action-danger)');
    });

    it('renders character counter when charCount and maxCharCount are provided', () => {
      render(<Input label="Bio" charCount={45} maxCharCount={100} />);
      expect(screen.getByText('45/100')).toBeDefined();
    });
  });

  describe('Textarea', () => {
    it('renders textarea with semantic surface and text tokens', () => {
      render(<Textarea label="Order Notes" placeholder="Special delivery instructions" />);
      expect(screen.getByText('Order Notes')).toBeDefined();
      const textarea = screen.getByPlaceholderText('Special delivery instructions');
      expect(textarea.className).toContain('var(--wiez-surface-page)');
      expect(textarea.className).toContain('var(--wiez-text-primary)');
    });
  });

  describe('Card', () => {
    it('renders default/recessed card preserving tactile treatment', () => {
      const { container } = render(<Card>Card Content</Card>);
      expect(container.firstChild).toBeDefined();
      expect((container.firstChild as HTMLElement).className).toContain('neu-recessed-card');
    });

    it('renders elevated card with semantic surface token and shadow', () => {
      const { container } = render(<Card variant="elevated">Elevated Content</Card>);
      const cardEl = container.firstChild as HTMLElement;
      expect(cardEl.className).toContain('var(--wiez-surface-elevated)');
      expect(cardEl.className).toContain('shadow-md');
    });

    it('renders bordered card with semantic surface-card token', () => {
      const { container } = render(<Card variant="bordered">Bordered Content</Card>);
      const cardEl = container.firstChild as HTMLElement;
      expect(cardEl.className).toContain('var(--wiez-surface-card)');
      expect(cardEl.className).toContain('var(--wiez-border-subtle)');
    });
  });

  describe('Badge', () => {
    it('renders status badges with semantic tokens', () => {
      const { container: successBadge } = render(<Badge variant="success">Verified</Badge>);
      expect((successBadge.firstChild as HTMLElement).className).toContain('text-emerald-700');

      const { container: brandBadge } = render(<Badge variant="brand">New Drop</Badge>);
      expect((brandBadge.firstChild as HTMLElement).className).toContain('var(--wiez-brand-subtle)');
      expect((brandBadge.firstChild as HTMLElement).className).toContain('var(--wiez-brand-accent)');
    });

    it('renders dot indicator when dot=true', () => {
      const { container } = render(<Badge variant="brand" dot>Live</Badge>);
      const dotEl = (container.firstChild as HTMLElement).querySelector('.animate-pulse');
      expect(dotEl).not.toBeNull();
    });
  });

  describe('Text Typography Primitive', () => {
    it('renders display variant as h1 with Playfair Display serif font', () => {
      render(<Text variant="display">Fashion Forward</Text>);
      const el = screen.getByRole('heading', { level: 1, name: /fashion forward/i });
      expect(el.className).toContain('font-serif');
      expect(el.className).toContain('text-3xl');
    });

    it('renders screenTitle variant as h1 with Plus Jakarta Sans', () => {
      render(<Text variant="screenTitle">Account Settings</Text>);
      const el = screen.getByRole('heading', { level: 1, name: /account settings/i });
      expect(el.className).toContain('font-sans');
    });

    it('renders money variant with tabular-nums', () => {
      const { container } = render(<Text variant="money">$150.00</Text>);
      expect((container.firstChild as HTMLElement).className).toContain('tabular-nums');
    });

    it('applies semantic tones', () => {
      const { container: brandText } = render(<Text tone="brand">WIEZ Exclusive</Text>);
      expect((brandText.firstChild as HTMLElement).className).toContain('var(--wiez-brand-accent)');

      const { container: mutedText } = render(<Text tone="muted">2 hours ago</Text>);
      expect((mutedText.firstChild as HTMLElement).className).toContain('var(--wiez-text-muted)');
    });
  });
});
