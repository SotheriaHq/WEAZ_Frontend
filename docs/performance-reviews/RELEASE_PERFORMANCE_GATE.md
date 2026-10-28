# Temporary Runway and Market release budget

The current approved release budget is five seconds for initial Runway/Market
rendering. The earlier 2.5-second objective is held for follow-up after the
remaining implementation work. Lighthouse CI now asserts a median LCP of at
most 5,000 ms over three cold runs per route. A median over the budget still
fails; no tolerance is added and no failing audit is disabled.

The initial CI run of commit `784c07e` measured 4,948.60 ms and 5,006.08 ms for
the two routes against the old 2,500 ms configuration. Those measurements do
not establish a passing five-second release; the updated gate must run again.
Reports remain available as workflow artifacts, including failed runs.

This laboratory check measures initial rendering against the CI preview. It
does not certify authenticated feed data, native WebView performance, user
traffic capacity or field latency. Those still require their own fixtures,
network/device scenarios and measured load tests. The 2.5-second objective
must be revisited after the held release work resumes.

Configuration follows the [Lighthouse CI assertion and aggregation reference](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md#assertions).
