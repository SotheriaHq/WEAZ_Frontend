import React from 'react';
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

function openNativeRoute(path: string): void {
  postStudioNativeEvent({ type: 'OPEN_NATIVE_ROUTE', path });
}

const StudioEmbeddedSearchBridge: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('threadly:native-search-open', handleOpen);
    return () => window.removeEventListener('threadly:native-search-open', handleOpen);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-layer-modal bg-black/20 px-3 py-4 backdrop-blur-sm dark:bg-black/45">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 cursor-default"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto mt-2 w-full max-w-xl rounded-2xl border border-black/5 bg-[color:var(--surface-primary)] p-3 shadow-2xl dark:border-white/10">
        <SearchBarWithSuggestions
          placeholder="Search WEAZ"
          className="!max-w-none"
          collapsible={false}
          enableGlobalShortcut={false}
          onSubmitQuery={(query) => {
            setOpen(false);
            openNativeRoute(`/search?q=${encodeURIComponent(query)}`);
          }}
          onNavigate={(href) => {
            setOpen(false);
            openNativeRoute(href);
          }}
        />
      </div>
    </div>
  );
};

export default StudioEmbeddedSearchBridge;
