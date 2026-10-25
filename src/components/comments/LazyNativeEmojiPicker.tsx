import { lazy, Suspense } from 'react';
import type { NativeEmojiPickerProps } from './NativeEmojiPicker';

const NativeEmojiPicker = lazy(() => import('./NativeEmojiPicker'));

export default function LazyNativeEmojiPicker(props: NativeEmojiPickerProps) {
  return <Suspense fallback={<div role="status" className="rounded-2xl bg-[color:var(--surface-primary)] p-4 text-theme">Loading emojis…</div>}>
    <NativeEmojiPicker {...props} />
  </Suspense>;
}
