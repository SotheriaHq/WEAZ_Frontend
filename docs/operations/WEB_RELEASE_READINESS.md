# Web release readiness

A merged commit or a cache-purge job is not proof that weaz.me serves that release. Cloudflare reports the current build stage separately from its status. See the [Cloudflare deployment contract](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/create/).

The release wait in scripts/purge-cloudflare-cache.cjs requires the requested commit in the production environment, latest_stage.name=deploy and latest_stage.status=success, without is_skipped. Clone/build success and every active stage remain pending. Failed, cancelled or skipped releases never trigger a cache purge. Missing project settings with an explicit commit wait fail closed. Each API call has a 15-second timeout; the workflow bounds the overall wait.

After the wait and purge succeed, independently request the live entry point and hashed script, then verify /.well-known/assetlinks.json returns JSON with the approved release signer. HTML at that URL means the association is not published, regardless of build status. Do not approve Android passkeys from a preview deployment or the public debug signer.

Run node --test scripts/test-cloudflare-deploy-wait.cjs before release. Its actual script-flow fixtures cover stage transitions, wrong commits, preview/unknown environments, failure/cancellation, skipped deployment and missing configuration.
