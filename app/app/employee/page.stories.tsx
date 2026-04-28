import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { delay, http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { EmployeeView } from '@/components/employee/EmployeeView'

import '@/app/globals.css'

const meta: Meta<typeof EmployeeView> = {
  title: 'Employee/Page',
  component: EmployeeView,
  parameters: { layout: 'fullscreen' },
  args: { employeeId: 'emp-1' },
}

export default meta
type Story = StoryObj<typeof EmployeeView>

const seedBalances = (employeeId: string) => [
  {
    employeeId,
    locationId: 'loc-1',
    daysAvailable: 10,
    lastUpdated: '2026-04-27T00:00:00.000Z',
  },
  {
    employeeId,
    locationId: 'loc-2',
    daysAvailable: 5,
    lastUpdated: '2026-04-27T00:00:00.000Z',
  },
]

const balanceHandler = http.get('/api/hcm/balances', ({ request }) => {
  const url = new URL(request.url)
  return HttpResponse.json(seedBalances(url.searchParams.get('employeeId') ?? 'emp-1'))
})

const balanceCellHandler = http.get('/api/hcm/balance', ({ request }) => {
  const url = new URL(request.url)
  const employeeId = url.searchParams.get('employeeId') ?? 'emp-1'
  const locationId = url.searchParams.get('locationId') ?? 'loc-1'
  return HttpResponse.json(
    seedBalances(employeeId).find((c) => c.locationId === locationId) ?? { error: 'NOT_FOUND' },
  )
})

export const Typical: Story = {
  parameters: {
    msw: {
      handlers: [
        balanceHandler,
        balanceCellHandler,
        http.post('/api/hcm/request', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({
            id: 'req-typical',
            ...body,
            status: 'pending',
            createdAt: new Date().toISOString(),
          })
        }),
      ],
    },
  },
}

const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const futureEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)

// Interaction test 1: a valid submission shows the optimistic-pending state
// before the server response lands. The handler delays 500ms to give the
// play function a window to assert against the in-flight UI.
export const SubmitOptimistic: Story = {
  args: {
    formDefaults: {
      locationId: 'loc-1',
      startDate: futureStart,
      endDate: futureEnd,
    },
  },
  parameters: {
    msw: {
      handlers: [
        balanceHandler,
        balanceCellHandler,
        http.post('/api/hcm/request', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          // Slow response so the optimistic-pending UI window is observable.
          await delay(1500)
          return HttpResponse.json({
            id: 'req-ok',
            ...body,
            status: 'pending',
            createdAt: new Date().toISOString(),
          })
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('10')).toBeInTheDocument())

    await userEvent.click(canvas.getByTestId('submit-button'))

    // Optimistic-pending kind: data-testid set by BalanceCard for this kind.
    await waitFor(
      () => expect(canvas.getByTestId('balance-card-pending')).toBeInTheDocument(),
      { timeout: 3_000 },
    )
  },
}

// Interaction test 2: the server returns 409 INSUFFICIENT_BALANCE; the
// optimistic state rolls back and the rolled-back card text is visible.
export const SubmitOverBalance: Story = {
  args: {
    formDefaults: {
      locationId: 'loc-1',
      startDate: futureStart,
      endDate: futureEnd,
    },
  },
  parameters: {
    msw: {
      handlers: [
        balanceHandler,
        balanceCellHandler,
        http.post('/api/hcm/request', async () => {
          await delay(50)
          return HttpResponse.json(
            { error: 'INSUFFICIENT_BALANCE', requested: 100, available: 10 },
            { status: 409 },
          )
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('10')).toBeInTheDocument())

    await userEvent.click(canvas.getByTestId('submit-button'))

    // Server-error alert (rendered inside RequestForm) and the rolled-back
    // card ("Last submission rolled back") prove the rollback path.
    await waitFor(() => expect(canvas.getByTestId('server-error')).toBeInTheDocument())
    await expect(canvas.getByText(/Last submission rolled back/i)).toBeInTheDocument()
  },
}

// Interaction test 3: the server says 200 (a "success" record is returned)
// but the subsequent forced re-fetch shows the balance unchanged. The data
// layer emits silent-failure-detected; the toast layer shows a persistent
// notification ("Your last request was not recorded by HCM").
export const SilentFailure: Story = {
  args: {
    formDefaults: {
      locationId: 'loc-1',
      startDate: futureStart,
      endDate: futureEnd,
    },
  },
  parameters: {
    msw: {
      handlers: [
        balanceHandler,
        balanceCellHandler,
        http.post('/api/hcm/request', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>
          // 200 OK with a request record echoed back, but we never decrement
          // the balance — so the post-mutation re-fetch returns the same
          // 10 days as before, triggering the silent-wrongness emission.
          return HttpResponse.json({
            id: 'req-silent',
            ...body,
            status: 'pending',
            createdAt: new Date().toISOString(),
          })
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('10')).toBeInTheDocument())

    await userEvent.click(canvas.getByTestId('submit-button'))

    // Silent-wrongness re-fetch fires after a 300ms delay. NotificationsListener
    // turns the emitted notification into a Sonner toast (persistent). Sonner
    // mounts toasts at the body root, so query document.body, not canvas.
    await waitFor(
      () => {
        const body = within(document.body)
        expect(body.getByText(/not recorded by HCM/i)).toBeInTheDocument()
      },
      { timeout: 5_000 },
    )
  },
}
