import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RunwayStageChrome from '@/components/runway/RunwayStageChrome';

/**
 * The rules here are load-bearing, not cosmetic.
 *
 * This pill replaced five controls — wordmark, hamburger, search, bell and
 * avatar — on the one route where chrome sits on a photograph. Two of the
 * things it replaced were the only resting-state signal that something was
 * waiting, so the badge has to survive refactors that treat it as decoration.
 */

const navigate = vi.fn();
const dispatch = vi.fn();
let unreadCount = 0;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

vi.mock('react-redux', () => ({
  useDispatch: () => dispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ notifications: { unreadCount } }),
}));

describe('RunwayStageChrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unreadCount = 0;
  });

  it('shows the unread count on the CLOSED control', () => {
    unreadCount = 3;
    render(<RunwayStageChrome />);

    // Visible without opening anything — a count you only see after opening a
    // drawer is not a count, and the bell it replaced did not need a tap.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Open menu, 3 unread notifications'),
    ).toBeInTheDocument();
  });

  it('shows no badge at all when nothing is unread', () => {
    render(<RunwayStageChrome />);
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('caps the badge rather than letting it widen the pill', () => {
    unreadCount = 250;
    render(<RunwayStageChrome />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('carries the drawn wordmark, and only once', () => {
    render(<RunwayStageChrome />);
    // On this route the wordmark's usual destination IS this screen, so a link
    // would be a dead tap target sitting on the photograph.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    // The name is artwork, not bold text — and because the muse stands in for
    // the "I", the wordmark already contains the mark. A second mark beside it
    // would draw the figure twice.
    const marks = screen.getAllByRole('img');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAccessibleName('WIEZ');
    expect(marks[0].getAttribute('src')).toMatch(/wiez-wordmark/);
  });

  it('does not repeat the active destination', () => {
    render(<RunwayStageChrome />);
    // The island bar already shows Runway is active; saying it again here is a
    // second answer to a question nobody asked, laid over the image.
    expect(screen.queryByText(/runway/i)).not.toBeInTheDocument();
  });

  it('opens the menu and reaches search', () => {
    render(<RunwayStageChrome />);

    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(dispatch).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Search'));
    expect(navigate).toHaveBeenCalledWith('/search');
  });
});
