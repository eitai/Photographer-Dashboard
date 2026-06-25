import { QueryClient } from '@tanstack/react-query';

// staleTime > 0 and no focus refetch: the client detail page mounts 2 queries
// per gallery card, so default refetching re-fired them all on every tab focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
