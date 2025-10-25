# Media Upload Toolkit

This guide documents the client-side pieces that power threaded media uploads so that other teams can plug them in quickly and consistently.

## Building Blocks

- **`MediaProvider` / `useMediaStore`** (`src/hooks/useMediaStore.tsx`) keep track of the current selection. `MediaProvider` must wrap any surface that needs to read/write items, and the hook exposes helpers such as `addFiles`, `remove`, `clear`, and `reorder`.
- **`FileUploader`** (`src/components/upload/FileUploader.tsx`) renders the drag-and-drop surface. It accepts `variant="large" | "small"`, `disabled`, and validation props. The component already ships with dark-mode aware styling and exposes a shared picker contract so multiple uploaders can reuse one hidden input (see `useFilePicker`).
- **`MediaPreview`** (`src/components/upload/MediaPreview.tsx`) displays the thumbnail rail and highlights per-file progress if you pass the `progressById` map from the upload hook.
- **`useCollectionUpload`** (`src/hooks/useCollectionUpload.ts`) negotiates presigned URLs, throttles concurrent PUT/POST uploads, retries with exponential backoff, and aggregates progress. The hook returns `{ uploadCollection, isUploading, progress, perFileProgress, error }`.
- **`WizardLayout`** (`src/components/layouts/WizardLayout.tsx`) is a reusable two-column shell with optional description/actions slots. Use it for any multi-step authoring flow to keep the layout consistent across the app.

## Integrate the Flow

```tsx
import { MediaProvider, useMediaStore } from '../hooks/useMediaStore';
import FileUploader from '../components/upload/FileUploader';
import MediaPreview from '../components/upload/MediaPreview';
import useFilePicker from '../components/upload/useFilePicker';
import useCollectionUpload from '../hooks/useCollectionUpload';
import WizardLayout from '../components/layouts/WizardLayout';
import { toast } from 'react-toastify';

const CollectionComposer = () => {
  const mediaStore = useMediaStore();
  const { uploadCollection, isUploading, progress, perFileProgress } = useCollectionUpload();
  const picker = useFilePicker({ accept: ['image/*', 'video/*'], maxFiles: 20, onFiles: mediaStore.addFiles });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mediaStore.items.length === 0) {
      toast.error('Attach at least one file');
      return;
    }
    await uploadCollection(mediaStore.items, 'Title', 'Optional description');
    mediaStore.clear();
  };

  return (
    <form onSubmit={handleSubmit}>
      <WizardLayout
        title="Create a Collection"
        left={
          <>
            <MediaPreview
              items={mediaStore.items}
              onDeleteItem={mediaStore.remove}
              onAddMore={picker.open}
              progressById={perFileProgress}
              disabled={isUploading}
            />
            <FileUploader onFilesUpload={mediaStore.addFiles} picker={picker} variant="small" disabled={isUploading} />
          </>
        }
        right={<button type="submit" disabled={isUploading || mediaStore.items.length === 0}>Save</button>}
      />
    </form>
  );
};

export default function Page() {
  return (
    <MediaProvider>
      <CollectionComposer />
    </MediaProvider>
  );
}
```

### Concurrency & Retry Defaults

- `MAX_PARALLEL_UPLOADS = 3`
- `MAX_RETRY_ATTEMPTS = 2` with a backoff of `750ms * attempt`
- `perFileProgress` is keyed by `MediaItem.id` and drives the thumbnail rail progress bars.

Override behaviour by forking the hook or exposing new options as needed; tests cover the core contract so regressions surface quickly.

## Testing

Vitest + React Testing Library live in `src/__tests__`:

- `mediaStore.test.tsx`: context lifecycle (add/remove/clear).
- `FileUploader.test.tsx`: drag state, validation, and disabled interactions.
- `useCollectionUpload.test.tsx`: concurrency, progress aggregation, and retry/backoff.

Run `npm test -- --run` to execute the suite.

## Toasts & Layout Consistency

- The global `ToastContainer` now lives in `App.tsx`; feature surfaces only need to call `toast.*`.
- Reuse `WizardLayout` for any future wizard-like flows to get the shared heading, optional description, and two-column grid without duplicating markup or spacing rules.
