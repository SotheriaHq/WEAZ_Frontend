/**
 * While the mobile app is handing this document a session, the handoff is the
 * only thing allowed to decide who is signed in.
 *
 * The Studio WebView keeps its storage between accounts. When a new brand
 * signed up on a phone that had been signed in before, the document booted
 * with the previous account's saved identity, so the session restore in
 * AuthContext ran alongside the handoff exchange. Whichever finished last won:
 * a failed restore cleared the user the handoff had just set (the app showed
 * "Studio session expired" to a brand that had only just signed up), and a
 * successful one put the previous account back in front of the new brand.
 *
 * A handoff is in flight from the moment the page loads with `handoffCode`
 * until the exchange and its profile read have settled.
 */
let handoffsInFlight = 0;

const urlCarriesHandoffCode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('handoffCode');
  } catch {
    return false;
  }
};

export const beginStudioHandoff = (): void => {
  handoffsInFlight += 1;
};

export const endStudioHandoff = (): void => {
  handoffsInFlight = Math.max(0, handoffsInFlight - 1);
};

export const isStudioHandoffInFlight = (): boolean =>
  handoffsInFlight > 0 || urlCarriesHandoffCode();
