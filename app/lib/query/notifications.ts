// Non-blocking notification channel. M3 emits; M4 subscribes via a toast UI.
//
// Kinds (initial set, see TRD §3 + spec §03 "Notification kinds"):
// - silent-failure-detected: a write succeeded on the wire (200 OK) but the
//   reconciliation poll proves the server didn't actually persist it.
// - background-refresh-conflict: a polled value contradicts a recently-
//   acknowledged mutation result.
// - balance-refreshed: anniversary bonus or external change detected
//   mid-session.

export type Notification =
  | {
      kind: 'silent-failure-detected'
      employeeId: string
      locationId: string
      attemptedDays: number
    }
  | {
      kind: 'background-refresh-conflict'
      employeeId: string
      locationId: string
      message: string
    }
  | {
      kind: 'balance-refreshed'
      employeeId: string
      locationId: string
      delta: number
    }

type Listener = (notification: Notification) => void

const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emit(notification: Notification): void {
  for (const fn of listeners) {
    fn(notification)
  }
}

// Test-only: clear all listeners between tests.
export function _resetListenersForTest(): void {
  listeners.clear()
}
