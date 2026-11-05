# Product draft recovery

The shared Studio product flow serves desktop, tablet, mobile browser and the
native Studio WebView. A draft remains DRAFT and is never submitted for review
by the draft action. Its completed task says “Draft saved”.

An interrupted job retains its existing product ID, selected File objects and
completed upload IDs in input order. Retry uploads only remaining files; a
failure after all uploads can retry finalization without uploading them again.
The checkpoint is held in the existing job's memory lifetime. After a full page
reload the existing server draft/editor recovery path remains necessary; this
change does not promise durable browser File objects.

Run `npx vitest run src/features/products/productPublishJob.test.ts`. The web
quality gate runs it alongside the existing rules-of-hooks lint check. Cases
cover saving an incomplete draft, a partial upload outage and retry without
duplicate products/media, and finalization retry preserving media order.

Manual acceptance: save a product draft with several photos; interrupt a later
photo upload and retry from the store card. Confirm one draft, one copy of each
photo, correct ordering, and no review submission. Repeat on the four supported
Studio surfaces. Post-change physical-device acceptance requires reconnection.
