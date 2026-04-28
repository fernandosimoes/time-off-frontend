'use client'

import { Button } from '@/components/ui/button'
import { usePendingRequests } from '@/lib/query/requests'

import { PendingRequestList } from './PendingRequestList'

export type ManagerViewProps = {
  managerId: string
}

export function ManagerView({ managerId }: ManagerViewProps) {
  const requests = usePendingRequests()

  async function handleSeed() {
    await fetch('/api/hcm/dev/seed', { method: 'POST' })
    await requests.refetch()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Time off — Manager</h1>
          <p className="text-sm text-muted-foreground">Reviewing as {managerId}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSeed}
          data-testid="seed-button"
        >
          Seed demo requests
        </Button>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Pending requests
        </h2>
        {requests.isPending && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {requests.isError && (
          <p className="text-sm text-destructive">
            Could not load pending requests: {requests.error.message}
          </p>
        )}
        {requests.isSuccess && (
          <PendingRequestList requests={requests.data} managerId={managerId} />
        )}
      </section>
    </div>
  )
}
