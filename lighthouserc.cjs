/** @type {import('lighthouse').Flags} */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local:',
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/market',
      ],
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.6 }],
        // Temporary release budget approved for Runway/Market. The 2.5-second
        // objective remains a follow-up; use the median of three cold runs.
        'largest-contentful-paint': ['warn', { maxNumericValue: 7500, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'interaction-to-next-paint': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
