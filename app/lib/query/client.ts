import { QueryClient } from '@tanstack/react-query'

import { subscribeBalanceRefreshDetector } from './refresh-detector'

// Singleton QueryClient. Tests construct their own instance per renderHook
// wrapper to avoid cross-test cache leakage; production code uses this one.
//
// Defaults align with TRD §4.5/§4.7:
// - staleTime 60s matches the polling interval, so the visual indication of
//   staleness is coherent with the refresh cadence.
// - refetchOnWindowFocus covers the "user returned from another tab" case
//   without requiring tighter polling.
// - refetchIntervalInBackground=false stops the timer when the tab is hidden.
// - Exponential backoff with cap on retries to avoid hammering a degraded HCM.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
    mutations: {
      retry: 0,
    },
  },
})

// Side-effect: wire the singleton client to emit `balance-refreshed`
// notifications when polled values increase. Tests use their own QueryClient
// instances and do not share this subscription.
subscribeBalanceRefreshDetector(queryClient)
