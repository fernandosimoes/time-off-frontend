'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

import { subscribe } from '@/lib/query/notifications'

/**
 * Wires the M3 notification channel to Sonner toasts.
 *
 * Toast lifetime per TRD §4.11:
 * - silent-failure-detected: persistent (require dismissal) — the user must
 *   acknowledge that their last write was not actually recorded.
 * - background-refresh-conflict: persistent — implies a stale decision.
 * - balance-refreshed: transient (5s) — informational.
 */
export function NotificationsListener() {
  useEffect(() => {
    return subscribe((n) => {
      switch (n.kind) {
        case 'silent-failure-detected':
          toast.error('Your last request was not recorded by HCM. Please retry.', {
            duration: Infinity,
            id: `silent-failure-${n.employeeId}-${n.locationId}`,
          })
          break
        case 'background-refresh-conflict':
          toast.warning(n.message, {
            duration: Infinity,
            id: `background-refresh-${n.employeeId}-${n.locationId}`,
          })
          break
        case 'balance-refreshed':
          toast.info(
            `Balance refreshed: +${n.delta} day${n.delta === 1 ? '' : 's'} in ${n.locationId}.`,
            { duration: 5_000 },
          )
          break
      }
    })
  }, [])

  return null
}
