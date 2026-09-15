import type { PropsWithChildren } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { queryClient } from './queryClient';
import {
  shouldDehydrateWiezQuery,
  WIEZ_QUERY_CACHE_BUSTER,
  WIEZ_QUERY_CACHE_MAX_AGE_MS,
  wiezQueryPersister,
} from './queryPersistor';

export function QueryProvider({ children }: PropsWithChildren) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: wiezQueryPersister,
        maxAge: WIEZ_QUERY_CACHE_MAX_AGE_MS,
        buster: WIEZ_QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydrateWiezQuery,
        },
      }}
    >
      {children}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PersistQueryClientProvider>
  );
}
