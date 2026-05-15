export const isKnownUnavailableSeedMediaUrl = (value?: string | null): boolean => {
  const raw = String(value ?? '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase() === 'threadly.local';
  } catch {
    return raw.toLowerCase().includes('threadly.local/uploads/seed/');
  }
};
