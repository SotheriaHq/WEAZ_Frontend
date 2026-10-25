import EmojiPicker, { EmojiStyle, Theme, type PickerProps } from 'emoji-picker-react';

export type NativeEmojiPickerProps = Omit<PickerProps, 'emojiStyle' | 'theme'> & { theme?: 'dark' | 'auto' };

export default function NativeEmojiPicker({ theme = 'dark', ...props }: NativeEmojiPickerProps) {
  return <EmojiPicker searchDisabled skinTonesDisabled lazyLoadEmojis {...props}
    emojiStyle={EmojiStyle.NATIVE} theme={theme === 'auto' ? Theme.AUTO : Theme.DARK} />;
}
