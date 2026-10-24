import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react';

export default function NativeEmojiPicker({ onEmojiClick }: { onEmojiClick: (event: EmojiClickData) => void }) {
  return <EmojiPicker onEmojiClick={onEmojiClick} emojiStyle={EmojiStyle.NATIVE} theme={Theme.DARK}
    searchDisabled skinTonesDisabled lazyLoadEmojis />;
}
