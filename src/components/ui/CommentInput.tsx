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
  variant?: 'default' | 'overlay';
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
  variant = 'default',
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

  const inputStyles = variant === 'overlay'
    ? "bg-black/30 backdrop-blur-md border-white/20 text-white placeholder-white/70 focus:ring-purple-500/50"
    : "bg-white/80 dark:bg-white/10 backdrop-blur-md border-white/60 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-600 dark:placeholder-white/70 focus:ring-purple-300/60 dark:focus:ring-purple-500/30";

  const iconColor = variant === 'overlay'
    ? "text-white/70"
    : "text-gray-600 dark:text-white/70";

  return (
    <div className={`relative ${className}`}>
      <MessageCircle className={`pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${iconColor}`} />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={`w-full rounded-lg border pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 shadow-lg transition-all ${inputStyles}`}
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