import './ThreadActivityIndicator.css';
import type { CSSProperties } from 'react';

export type ThreadActivityIndicatorState =
  | 'idle'
  | 'adding'
  | 'removing'
  | 'pending'
  | 'reduced'
  | 'revert';

type ThreadActivityIndicatorProps = {
  active?: boolean;
  className?: string;
  size?: number;
  state?: ThreadActivityIndicatorState;
};

const THREAD_SYMBOL = String.fromCodePoint(0x1f9f5);

const ThreadActivityIndicator = ({
  active = false,
  className = '',
  size = 20,
  state = 'idle',
}: ThreadActivityIndicatorProps) => {
  const classes = [
    'thread-activity-indicator',
    active ? 'thread-activity-indicator--active' : '',
    `thread-activity-indicator--${state}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      aria-hidden="true"
      className={classes}
      data-testid="thread-activity-indicator"
      data-active={active ? 'true' : 'false'}
      data-thread-state={state}
      style={
        {
          '--thread-activity-size': `${size}px`,
        } as CSSProperties
      }
    >
      <span className="thread-activity-indicator__glyph">{THREAD_SYMBOL}</span>
    </span>
  );
};

export default ThreadActivityIndicator;
