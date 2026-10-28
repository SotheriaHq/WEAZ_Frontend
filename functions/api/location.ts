/**
 * The visitor's country, as Cloudflare's edge sees it, so prices can be shown
 * in a familiar currency. Used only as a suggestion the shopper can change.
 *
 * `request.cf.country` is set by Cloudflare, not by the client, so it cannot be
 * spoofed with a header. Nothing is logged or stored, and the answer is never
 * cached, so one visitor's country is never served to another.
 */
export const onRequestGet: PagesFunction = async (context) => {
  const cf = (context.request as Request & { cf?: { country?: unknown } }).cf;
  const raw = typeof cf?.country === 'string' ? cf.country.toUpperCase() : '';
  // "XX" is unknown and "T1" is Tor; neither is a country.
  const country = /^[A-Z]{2}$/.test(raw) && raw !== 'XX' && raw !== 'T1' ? raw : null;
  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
};
