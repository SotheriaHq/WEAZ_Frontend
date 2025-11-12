import React from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';

interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  maxLength?: number;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Add a comment...",
  disabled = false,
  busy = false,
  className = "",
  maxLength = 500,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !busy && !disabled) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit();
    }
  };

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!busy && !disabled) {
      onSubmit();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <MessageCircle className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-white/70" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-lg bg-white/80 dark:bg-black/40 backdrop-blur-md border border-white/60 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/70 pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300/60 dark:focus:ring-purple-500/30 shadow-lg"
        maxLength={maxLength}
        disabled={disabled || busy}
      />
      <button
        type="button"
        aria-label="Send comment"
        disabled={busy || disabled || value.trim().length === 0}
        onClick={handleSubmit}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-md hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
      </button>
    </div>
  );
};

export default CommentInput;