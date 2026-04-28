'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { BalanceList, type BalanceListEntry } from '@/components/employee/BalanceList'
import { RequestForm, type RequestFormSubmission } from '@/components/employee/RequestForm'
import { RequestHistory } from '@/components/employee/RequestHistory'
import { useBalances } from '@/lib/query/balances'
import { useRequestHistory, useSubmitRequest } from '@/lib/query/requests'
import type { HcmError, Location } from '@/lib/validation'

const DEFAULT_LOCATIONS: Location[] = [
  { id: 'loc-1', name: 'Headquarters' },
  { id: 'loc-2', name: 'Remote' },
]

export type EmployeeViewProps = {
  employeeId: string
  locations?: Location[]
  // Optional defaults for the request form. The page never sets these; the
  // Storybook interaction tests pre-fill so they don't have to drive the
  // Calendar popover.
  formDefaults?: {
    locationId?: string
    startDate?: Date
    endDate?: Date
  }
}

function rolledBackReason(err: HcmError): string {
  if (err.error === 'INSUFFICIENT_BALANCE') return 'Insufficient balance'
  if (err.error === 'NOT_FOUND') return 'Employee or location not found'
  return 'message' in err && err.message ? err.message : err.error
}

export function EmployeeView({
  employeeId,
  locations = DEFAULT_LOCATIONS,
  formDefaults,
}: EmployeeViewProps) {
  const balances = useBalances(employeeId)
  const submit = useSubmitRequest()
  const history = useRequestHistory(employeeId)
  const [serverError, setServerError] = useState<HcmError | null>(null)

  function handleSubmit(submission: RequestFormSubmission) {
    setServerError(null)
    submit.mutate(
      {
        employeeId,
        locationId: submission.locationId,
        days: submission.days,
        startDate: submission.startDate,
        endDate: submission.endDate,
      },
      {
        onSuccess: () => toast.success('Request submitted'),
        onError: (err) => {
          setServerError(err)
          const detail =
            err.error === 'INSUFFICIENT_BALANCE'
              ? `Requested ${err.requested}, available ${err.available}`
              : 'message' in err && err.message
                ? err.message
                : err.error
          toast.error(`Could not submit request: ${detail}`)
        },
      },
    )
  }

  const pendingVariables = submit.isPending ? submit.variables : null
  const errorVariables = submit.isError ? submit.variables : null

  const entries: BalanceListEntry[] = locations.map((loc) => {
    if (balances.isPending) {
      return { key: loc.id, state: { kind: 'loading' } }
    }
    if (balances.isError) {
      return {
        key: loc.id,
        state: { kind: 'error', locationName: loc.name, message: balances.error.message },
      }
    }
    const cell = balances.data?.find((c) => c.locationId === loc.id)
    if (!cell) {
      return { key: loc.id, state: { kind: 'empty', locationName: loc.name } }
    }
    if (pendingVariables && pendingVariables.locationId === loc.id) {
      return {
        key: loc.id,
        state: {
          kind: 'optimistic-pending',
          balance: cell,
          locationName: loc.name,
          pendingDelta: pendingVariables.days,
        },
      }
    }
    if (errorVariables && errorVariables.locationId === loc.id && submit.error) {
      return {
        key: loc.id,
        state: {
          kind: 'rolled-back',
          balance: cell,
          locationName: loc.name,
          reason: rolledBackReason(submit.error),
        },
      }
    }
    if (balances.isStale) {
      return { key: loc.id, state: { kind: 'stale', balance: cell, locationName: loc.name } }
    }
    return { key: loc.id, state: { kind: 'fresh', balance: cell, locationName: loc.name } }
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Time off — Employee</h1>
        <p className="text-sm text-muted-foreground">Welcome, Ana</p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your balances
        </h2>
        <BalanceList entries={entries} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Submit a request
        </h2>
        <RequestForm
          locations={locations}
          onSubmit={handleSubmit}
          isSubmitting={submit.isPending}
          serverError={serverError}
          defaultValues={formDefaults}
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Recent requests
        </h2>
        <RequestHistory requests={history.data ?? []} />
      </section>
    </div>
  )
}
