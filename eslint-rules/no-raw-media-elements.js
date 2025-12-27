/**
 * Enforce global media invariant: forbid raw <img> and <video> usage.
 *
 * Rationale:
 * - Raw media elements invite object-fit boxing, fixed-size wrappers, and background letterboxing.
 * - All media must go through the single abstraction (MediaRenderer) which encodes intrinsic sizing
 *   + max-height scrolling.
 *
 * Allowed exceptions:
 * - Within MediaRenderer.tsx itself.
 * - Optional allowlist for specific files/components can be provided via rule options.
 */

function normalizePath(filename) {
  return String(filename || '').replace(/\\/g, '/');
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow raw <img> and <video> elements; use MediaRenderer instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowFiles: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRawImg: 'Raw <img> is forbidden. Use MediaRenderer (global media invariant).',
      noRawVideo: 'Raw <video> is forbidden. Use MediaRenderer (global media invariant).',
    },
  },

  create(context) {
    const filename = normalizePath(context.getFilename());
    const options = context.options?.[0] || {};
    const allowFiles = new Set(
      (options.allowFiles || []).map((p) => normalizePath(p))
    );

    // Always allow inside the abstraction itself.
    if (filename.endsWith('/src/components/media/MediaRenderer.tsx')) {
      return {};
    }

    // Allow specific files when explicitly configured.
    for (const allowed of allowFiles) {
      if (allowed && filename.endsWith(allowed)) {
        return {};
      }
    }

    return {
      JSXOpeningElement(node) {
        const name = node.name;
        if (!name) return;

        // Only handle simple identifiers: <img>, <video>
        if (name.type !== 'JSXIdentifier') return;

        if (name.name === 'img') {
          context.report({ node, messageId: 'noRawImg' });
        }
        if (name.name === 'video') {
          context.report({ node, messageId: 'noRawVideo' });
        }
      },
    };
  },
};
