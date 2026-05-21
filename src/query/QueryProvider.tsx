import type { PropsWithChildren } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { queryClient } from './queryClient';
import {
  shouldDehydrateThreadlyQuery,
  THREADLY_QUERY_CACHE_BUSTER,
  THREADLY_QUERY_CACHE_MAX_AGE_MS,
  threadlyQueryPersister,
} from './queryPersistor';

export function QueryProvider({ children }: PropsWithChildren) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: threadlyQueryPersister,
        maxAge: THREADLY_QUERY_CACHE_MAX_AGE_MS,
        buster: THREADLY_QUERY_CACHE_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldDehydrateThreadlyQuery,
        },
      }}
    >
      {children}
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PersistQueryClientProvider>
  );
}
