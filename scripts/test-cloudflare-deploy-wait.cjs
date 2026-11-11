const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, 'purge-cloudflare-cache.cjs'), 'utf8');
const sha = 'a'.repeat(40);
const deployment = (name, status, extra = {}) => ({ id: 'fixture-release', environment: 'production',
  deployment_trigger: { metadata: { commit_hash: sha } }, latest_stage: { name, status }, ...extra });
function fixture(stages, env = {}) {
  let clock = 0, polls = 0;
  const events = [];
  const module = { exports: {} };
  vm.runInNewContext(source, { module, require: { main: null }, AbortSignal,
    process: { env: { CF_API_TOKEN: 'fixture-not-a-credential', CF_ZONE_ID: 'fixture-zone',
      CF_ACCOUNT_ID: 'fixture-account', CF_PAGES_PROJECT_NAME: 'fixture-project',
      CF_WAIT_COMMIT_SHA: sha, CF_WAIT_POLL_SEC: '1', CF_WAIT_TIMEOUT_SEC: '10', ...env },
      exit(code) { throw new Error('exit:' + code); } },
    console: { log() {}, warn() {}, error() {} }, Date: { now: () => clock },
    setTimeout(callback, delay) { clock += delay; callback(); },
    fetch: async (url, init) => {
      assert(init.signal, 'Every provider call has a bounded timeout.');
      if (url.endsWith('/user/tokens/verify')) return { ok: true, json: async () => ({ result: { status: 'active' } }) };
      if (url.includes('/deployments?')) {
        const current = stages[Math.min(polls++, stages.length - 1)];
        events.push('poll:' + current.latest_stage.name + ':' + current.latest_stage.status);
        return { ok: true, json: async () => ({ result: [current] }) };
      }
      assert(url.endsWith('/purge_cache')); assert.equal(init.method, 'POST');
      events.push('purge'); return { ok: true, json: async () => ({ result: { id: 'fixture-purge' } }) };
    },
  }, { filename: 'purge-cloudflare-cache.cjs' });
  return { main: module.exports.main, events, polls: () => polls };
}
test('actual purge flow waits past clone/build success and active deploy until production deploy succeeds', async () => {
  const f = fixture([deployment('clone_repo', 'active'), deployment('clone_repo', 'success'),
    deployment('build', 'active'), deployment('build', 'success'), deployment('deploy', 'active'), deployment('deploy', 'success')]);
  await f.main(); assert.equal(f.polls(), 6); assert.equal(f.events.at(-1), 'purge');
  assert.equal(f.events.filter(e => e === 'purge').length, 1);
});
for (const status of ['failure', 'canceled', 'cancelled', 'skipped']) test(status + ' release never purges', async () => {
  const f = fixture([deployment('deploy', status)]);
  await assert.rejects(f.main(), /exit:1/); assert(!f.events.includes('purge'));
});
for (const [label, value] of [
  ['preview', deployment('deploy', 'success', { environment: 'preview' })],
  ['unknown environment', deployment('deploy', 'success', { environment: undefined })],
  ['wrong commit', deployment('deploy', 'success', { deployment_trigger: { metadata: { commit_hash: 'b'.repeat(40) } } })],
  ['active deploy', deployment('deploy', 'active')],
  ['successful build only', deployment('build', 'success')],
  ['unknown stage', deployment('unknown', 'success')],
]) test(label + ' cannot establish a successful production release', async () => {
  const f = fixture([value]); await assert.rejects(f.main(), /exit:1/); assert(!f.events.includes('purge'));
});
test('skipped deployment cannot pass even if stage status incorrectly says success', async () => {
  const f = fixture([deployment('deploy', 'success', { is_skipped: true })]);
  await assert.rejects(f.main(), /exit:1/); assert(!f.events.includes('purge'));
});
test('explicit release wait fails closed without project configuration', async () => {
  const f = fixture([deployment('deploy', 'success')], { CF_PAGES_PROJECT_NAME: '' });
  await assert.rejects(f.main(), /exit:1/); assert.equal(f.polls(), 0); assert(!f.events.includes('purge'));
});
