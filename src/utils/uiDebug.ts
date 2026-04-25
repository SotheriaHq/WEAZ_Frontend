export function uiDebug(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem('threadly.uiDebug');
      if (v === '1' || v === 'true') return true;
    }
    // Vite env variable fallback
    // @ts-ignore - import.meta.env present at runtime
    const envVal = (import.meta as any)?.env?.VITE_UI_DEBUG;
    return envVal === '1' || envVal === 'true';
  } catch {
    return false;
  }
}

export default uiDebug;
