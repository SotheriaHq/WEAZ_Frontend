# Phase 5C Web Private Media Validation

Date: 2026-05-23

## Status

The web private signed-media fallback was validated against the Phase 5C local private fixture.

Validated route:

```text
/designs/5c5c0000-0000-4000-8000-000000000104
```

## Client Behavior

`DesignViewModal` now continues to the private signed fallback when the public URL lookup correctly denies a private file.

Resolution order in the validated path:

1. Use an already valid absolute media URL if one is present.
2. Try `GET /uploads/public-url/:fileId`.
3. If public lookup is denied or unavailable, try `GET /uploads/signed-url/:fileId`.
4. Display fallback media if signed lookup also fails.

The public lookup and signed lookup use `retry: false` in this fallback path so expected private-media denials do not create retry spam.

## Runtime Result

Authenticated owner route trace:

| Metric | Result |
| --- | ---: |
| Total traced API requests | 11 |
| Private public URL lookup | 1 |
| Private signed URL lookup | 1 |
| Signed URL 400s | 0 |
| Cache-busted/no-store calls | 0 |
| Request failures | 0 |
| Maximum update depth warnings | 0 |
| ORB/image failures | 0 |
| Media displayed | yes |

The tracer classified the public and signed media resolver buckets together as `signedUrlCalls.total = 2`, but the endpoint split was one denied public lookup and one successful signed lookup.

## Notes

- The fixture uses local dev upload storage, not a production S3 object.
- The backend keeps production S3 presigning intact.
- Raw signed URLs and private media secrets were not printed in the validation output.

