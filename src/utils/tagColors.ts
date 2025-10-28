export const TAG_COLORS = ['purple', 'blue', 'green', 'orange', 'red'] as const;
export type TagColor = typeof TAG_COLORS[number];

export function getTagColor(tagName: string, index?: number): TagColor {
  if (index !== undefined) {
    return TAG_COLORS[index % TAG_COLORS.length];
  }
  // Hash-based color assignment for consistency
  const hash = tagName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLORS[hash % TAG_COLORS.length];
}