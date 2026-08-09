#!/usr/bin/env node
/**
 * Purge Cloudflare edge cache for the WIEZ web app after a frontend deploy.
 *
 * Why this exists
 * ---------------
 * Vite hashes live under /assets/* with long-lived Cache-Control. That is correct
 * for real JS/CSS. During a deploy race Cloudflare Pages can briefly SPA-fallback
 * index.html for a missing hashed path, and that HTML was historically stamped
 * with the same immutable header — so the EDGE and the browser cached poison
 * under a .js URL (MIME "text/html" boot failure). Incidents: 2026-07-10, 2026-07-31.
 *
 * Pages eventually points at the new deployment, but zone/edge cache and
 * poisoned immutable entries need an explicit purge so every POP serves the
 * new build immediately.
 *
 * Required env
 * ------------
 *   CF_API_TOKEN   API token with Zone.Cache Purge (and Pages Read if waiting)
 *   CF_ZONE_ID     Zone id for weaz.me
 *
 * Optional env
 * ------------
 *   CF_PURGE_HOSTS          Comma-separated hosts (default: weaz.me,www.weaz.me)
 *   CF_PURGE_EVERYTHING     "true" to purge the entire zone (heavier)
 *   CF_ACCOUNT_ID           Needed to wait for Pages deploy
 *   CF_PAGES_PROJECT_NAME   Needed to wait for Pages deploy (e.g. weaz-frontend)
 *   CF_WAIT_COMMIT_SHA      Git SHA that must become the latest successful deploy
 *   CF_WAIT_TIMEOUT_SEC     Default 600
 *   CF_WAIT_POLL_SEC        Default 15
 *
 * Usage
 * -----
 *   node scripts/purge-cloudflare-cache.cjs
 *   CF_WAIT_COMMIT_SHA=$GITHUB_SHA node scripts/purge-cloudflare-cache.cjs
 */

const CF_API = 'https://api.cloudflare.com/client/v4';

const token = String(process.env.CF_API_TOKEN || '').trim();
const zoneId = String(process.env.CF_ZONE_ID || '').trim();
const accountId = String(process.env.CF_ACCOUNT_ID || '').trim();
const projectName = String(process.env.CF_PAGES_PROJECT_NAME || '').trim();
const waitSha = String(process.env.CF_WAIT_COMMIT_SHA || '').trim().toLowerCase();
const waitTimeoutSec = Number(process.env.CF_WAIT_TIMEOUT_SEC || 600) || 600;
const waitPollSec = Number(process.env.CF_WAIT_POLL_SEC || 15) || 15;
const purgeEverything =
  String(process.env.CF_PURGE_EVERYTHING || '')
    .trim()
    .toLowerCase() === 'true';
const hosts = String(process.env.CF_PURGE_HOSTS || 'weaz.me,www.weaz.me')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

function fail(message) {
  console.error(`[purge-cloudflare] ERROR: ${message}`);
  process.exit(1);
}

async function cfFetch(path, init = {}) {
  const response = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = JSON.stringify(body.errors || body || {}, null, 2);
    throw new Error(`Cloudflare API ${response.status} ${path}: ${detail}`);
  }
  return body;
}

function normalizeSha(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function deploymentMatchesSha(deployment, sha) {
  if (!deployment || !sha) return false;
  const candidates = [
    deployment.deployment_trigger?.metadata?.commit_hash,
    deployment.build_config?.commit_hash,
    deployment.source?.config?.production_branch &&
      deployment.deployment_trigger?.metadata?.commit_hash,
  ]
    .map(normalizeSha)
    .filter(Boolean);

  return candidates.some(
    (candidate) => candidate === sha || candidate.startsWith(sha) || sha.startsWith(candidate),
  );
}

async function waitForPagesDeploy(sha) {
  if (!accountId || !projectName) {
    console.warn(
      '[purge-cloudflare] CF_ACCOUNT_ID / CF_PAGES_PROJECT_NAME not set — skipping Pages wait; purging immediately.',
    );
    return;
  }

  const deadline = Date.now() + waitTimeoutSec * 1000;
  console.log(
    `[purge-cloudflare] Waiting up to ${waitTimeoutSec}s for Pages project "${projectName}" deploy of ${sha}…`,
  );

  while (Date.now() < deadline) {
    let body;
    try {
      body = await cfFetch(
        `/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/deployments?per_page=10`,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      // The token already verified as active, so a 401/403 here is about this
      // account or this project, not the token value.
      if (/\b(401|403)\b/.test(detail)) {
        fail(
          [
            'Token is valid but cannot read this Pages project. Check, in order:',
            `  1. CF_ACCOUNT_ID (${accountId.slice(0, 6)}…) is the account that OWNS the Pages project,`,
            '     and is the account selected under the token\'s "Account Resources".',
            '  2. The token has Account → Cloudflare Pages → Read.',
            `  3. CF_PAGES_PROJECT_NAME ("${projectName}") matches Workers & Pages exactly.`,
            '',
            detail,
          ].join('\n'),
        );
      }
      throw error;
    }
    const deployments = Array.isArray(body.result) ? body.result : [];
    const match = deployments.find((d) => deploymentMatchesSha(d, sha));

    if (match) {
      const stage = match.latest_stage?.name || match.stage || 'unknown';
      const status = match.latest_stage?.status || match.status || 'unknown';
      console.log(`[purge-cloudflare] Found deployment ${match.id}: stage=${stage} status=${status}`);

      if (status === 'success' || status === 'active') {
        console.log('[purge-cloudflare] Pages deploy is live.');
        return;
      }
      if (status === 'failure' || status === 'canceled' || status === 'cancelled') {
        fail(`Pages deploy ${match.id} ended with status=${status}`);
      }
    } else {
      console.log('[purge-cloudflare] Matching deployment not listed yet…');
    }

    await new Promise((r) => setTimeout(r, waitPollSec * 1000));
  }

  fail(
    `Timed out waiting for Pages deploy of ${sha}. Check the Cloudflare Pages dashboard, then re-run this workflow.`,
  );
}

async function purgeCache() {
  const payload = purgeEverything
    ? { purge_everything: true }
    : { hosts };

  console.log(
    `[purge-cloudflare] Purging zone ${zoneId}: ${
      purgeEverything ? 'purge_everything' : `hosts=${hosts.join(',')}`
    }`,
  );

  const body = await cfFetch(`/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  console.log('[purge-cloudflare] Purge accepted:', JSON.stringify(body.result || body));
}

/**
 * Ask Cloudflare whether the token itself is usable BEFORE spending the run on
 * an account-scoped call.
 *
 * Without this, a dead token surfaced as `401 … {"code":10000,"message":
 * "Authentication error"}` on the Pages deployments endpoint — which reads like
 * a permissions problem and sent us auditing token scopes for two days. The
 * real cause on 2026-08-09 was that `gh secret set` had been given the token
 * where the NAME goes, so the repo grew secrets literally called
 * `CFUT_<token>` while `CF_API_TOKEN` still held the pre-rotation value.
 *
 * `/user/tokens/verify` needs no permissions at all, so it separates the two
 * cases cleanly: fail here and the token is wrong or revoked; pass here and a
 * later 401 really is a missing scope or the wrong account id.
 */
async function assertTokenUsable() {
  let verified;
  try {
    verified = await cfFetch('/user/tokens/verify');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(
      [
        'CF_API_TOKEN was rejected by Cloudflare — the token value is wrong, expired, or revoked.',
        'This is NOT a permissions problem; /user/tokens/verify requires no scopes.',
        '',
        'Set it with the NAME first and the value at the prompt, never inline:',
        '  gh secret set CF_API_TOKEN --repo <owner>/<repo>',
        '',
        'If `gh secret list` shows a secret whose name looks like CFUT_… then the',
        'token was passed as the secret name. Delete it and revoke that token —',
        'secret NAMES are not encrypted.',
        '',
        detail,
      ].join('\n'),
    );
  }

  const status = verified?.result?.status;
  if (status && status !== 'active') {
    fail(`CF_API_TOKEN status is "${status}", not "active".`);
  }
  console.log('[purge-cloudflare] Token verified (status=active).');
}

async function main() {
  if (!token) fail('CF_API_TOKEN is required');
  if (!zoneId) fail('CF_ZONE_ID is required');

  await assertTokenUsable();

  if (waitSha) {
    await waitForPagesDeploy(waitSha);
  } else {
    console.log('[purge-cloudflare] No CF_WAIT_COMMIT_SHA — purging without waiting for Pages.');
  }

  await purgeCache();
  console.log('[purge-cloudflare] Done. Edge should serve the new frontend build immediately.');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
