import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useMemo } from 'react';

import { AuthProvider } from './AuthProvider';
import { TaskForgeProvider } from './TaskForgeProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TaskForgeProvider>{children}</TaskForgeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
