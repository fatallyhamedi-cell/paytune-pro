import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes — prevents 429
      gcTime: 30 * 60 * 1000,        // 30 minutes
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 429) return false;
        return failureCount < 1;
      },
    },
  },
});

export default queryClient;
