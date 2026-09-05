import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { messagingApi } from '@/api/MessagingApi';
import MediaRenderer from '@/components/media/MediaRenderer';

interface PendingFile {
  fileId: string;
  fileName: string;
  previewUrl: string | null;
}

export interface ReplyTo {
  id: string;
  bodyText?: string | null;
  senderName: string;
}

interface ComposeAreaProps {
  onSend: (bodyText: string, attachmentFileIds: string[], replyToMessageId?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** When set, shows a reply preview above the input */
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
}

const MAX_ATTACHMENTS = 5;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';
const QUICK_STICKERS = ['✨ Noted', '🚚 On it', '✅ Done', '🙏 Thank you'];

const ComposeArea: React.FC<ComposeAreaProps> = memo(({
  onSend,
  disabled = false,
  placeholder = 'Type a message…',
  maxLength = 4000,
  replyTo = null,
  onCancelReply,
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const filesRef = useRef<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPopoverRef = useRef<HTMLDivElement | null>(null);
  const emojiHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { filesRef.current = files; }, [files]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      for (const f of filesRef.current) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!emojiPopoverRef.current) return;
      if (!emojiPopoverRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showEmojiPicker]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const canSend = !disabled && !sending && !uploading && (text.trim().length > 0 || files.length > 0);

  const handlePickFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const selectedFiles = Array.from(fileList);
    if (filesRef.current.length + selectedFiles.length > MAX_ATTACHMENTS) {
      toast.error(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const uploaded = (await Promise.all(
        selectedFiles.map(async (file) => {
          const res = await messagingApi.uploadMessageAttachment(file);
          if (!res?.id) {
            throw new Error('Attachment upload completed without a file ID');
          }

          const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
          return {
            fileId: res.id,
            fileName: res.originalName || res.fileName || file.name,
            previewUrl: preview,
          } satisfies PendingFile;
        }),
      ));
      setFiles(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.fileId === fileId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(f => f.fileId !== fileId);
    });
  }, []);

  const appendText = useCallback((chunk: string) => {
    setText((prev) => {
      const next = `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${chunk}`.slice(0, maxLength);
      return next;
    });
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [maxLength]);

  useEffect(() => {
    if (!showEmojiPicker || !emojiHostRef.current) return;

    let cancelled = false;
    const host = emojiHostRef.current;

    host.innerHTML = '';

    void Promise.all([
      import('@emoji-mart/data'),
      import('emoji-mart'),
    ]).then(([dataModule, pickerModule]) => {
      if (cancelled || !host) return;

      const picker = new pickerModule.Picker({
        data: dataModule.default,
        onEmojiSelect: (emoji: any) => {
          if (emoji?.native) {
            appendText(String(emoji.native));
          }
          setShowEmojiPicker(false);
        },
        previewPosition: 'none',
        skinTonePosition: 'none',
        theme: 'light',
      }) as unknown as HTMLElement;

      host.innerHTML = '';
      host.appendChild(picker);
    }).catch(() => {
      if (!cancelled) {
        toast.error('Emoji picker failed to load');
        setShowEmojiPicker(false);
      }
    });

    return () => {
      cancelled = true;
      host.innerHTML = '';
    };
  }, [appendText, showEmojiPicker]);

  /**
   * Clear the composer on the keystroke, not on the response.
   *
   * The box used to hold the text until the round trip finished, which on a
   * slow connection reads as "nothing happened" — so people press Enter again
   * and send it twice. The message is now already in the thread by the time
   * this returns (the parent puts it there optimistically and owns its
   * sending/failed state), so the composer's job is done the moment it hands
   * the text over, and there is nothing left for it to report.
   *
   * A failure surfaces on the message itself, with Resend and Delete, rather
   * than as a toast over an emptied box: the words are not lost, they are in
   * the thread marked "not sent".
   */
  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const body = text.trim();
    const attIds = files.map((f) => f.fileId).filter(Boolean);
    const sentFiles = files;

    setText('');
    setFiles([]);
    onCancelReply?.();
    textareaRef.current?.focus();

    setSending(true);
    try {
      await onSend(body, attIds, replyTo?.id);
    } finally {
      for (const f of sentFiles) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
      setSending(false);
    }
  }, [canSend, text, files, onSend, replyTo, onCancelReply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  return (
    <div className="shrink-0 bg-white/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm dark:bg-white/[0.04]">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 rounded-xl border-l-4 border-purple-500 bg-purple-50/80 dark:bg-purple-500/10 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 mb-0.5">↩️ {replyTo.senderName}</p>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate leading-snug">
              {replyTo.bodyText || '📎 Attachment'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full hover:bg-purple-100 dark:hover:bg-purple-500/20 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Cancel reply"
          >
            <span aria-hidden="true" className="text-sm leading-none">✕</span>
          </button>
        </div>
      )}
      {/* Pending attachments */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map(f => (
            <div key={f.fileId} className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.08] px-2.5 py-1.5 text-xs">
              {f.previewUrl ? (
                <MediaRenderer
                  kind="image"
                  src={f.previewUrl}
                  alt=""
                  fit="cover"
                  className="h-6 w-6 rounded"
                />
              ) : (
                <span>📎</span>
              )}
              <span className="truncate max-w-[100px]">{f.fileName}</span>
              <button
                type="button"
                onClick={() => removeFile(f.fileId)}
                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`Remove ${f.fileName}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1 sm:gap-2">
        <div className="relative shrink-0" ref={emojiPopoverRef}>
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={disabled || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors sm:h-10 sm:w-10"
            title="Open emoji picker"
            aria-label="Open emoji picker"
          >
            😀
          </button>
          {showEmojiPicker ? (
            <div className="absolute bottom-12 left-0 z-20">
              <div ref={emojiHostRef} />
            </div>
          ) : null}
        </div>

        {/* Attach button */}
        <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors sm:h-10 sm:w-10" title="Attach files">
          <input
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handlePickFiles}
            disabled={disabled || uploading || sending}
          />
          <span className="text-lg">{uploading ? '⏳' : '📎'}</span>
        </label>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          rows={1}
          placeholder={placeholder}
          disabled={disabled || sending}
          className="min-w-0 flex-1 resize-none rounded-2xl bg-gray-100 dark:bg-white/[0.08] px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-shadow"
        />

        {/*
          Send button.

          `overflow-hidden` + a spinner sized in `em` keeps the busy state
          INSIDE the button: the old ⏳ glyph was an emoji, and emoji are laid
          out with their own optical metrics, so at `text-sm` it still drew
          past a 40px box on the fonts that render it large.

          Sizes step down under `sm:` so the row (emoji · attach · textarea ·
          send) still fits a 320px-wide phone without the textarea being
          squeezed to nothing.
        */}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!canSend}
          className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/25 transition-shadow"
          aria-label={sending ? 'Sending message' : 'Send message'}
          aria-busy={sending}
        >
          {sending ? (
            <span
              className="h-[1.1em] w-[1.1em] animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <span className="text-sm sm:text-base leading-none" aria-hidden="true">📨</span>
          )}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {QUICK_STICKERS.map((sticker) => (
          <button
            key={sticker}
            type="button"
            onClick={() => appendText(sticker)}
            disabled={disabled || sending}
            className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition-colors hover:bg-purple-100 hover:text-purple-700 dark:bg-white/[0.08] dark:text-gray-300 dark:hover:bg-purple-500/20 dark:hover:text-purple-200"
          >
            {sticker}
          </button>
        ))}
      </div>

      {/* Character count */}
      {text.length > maxLength * 0.8 && (
        <div className="mt-1 text-right">
          <span className={`text-[10px] ${text.length >= maxLength ? 'text-red-500' : 'text-gray-400'}`}>
            {text.length}/{maxLength}
          </span>
        </div>
      )}
    </div>
  );
});

ComposeArea.displayName = 'ComposeArea';
export default ComposeArea;
