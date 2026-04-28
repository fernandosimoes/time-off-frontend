import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import type { BalanceCell, TimeOffRequest } from '@/lib/domain'

import { RequestRow } from './RequestRow'

const sampleRequest: TimeOffRequest = {
  id: 'req-row-1',
  employeeId: 'emp-1',
  locationId: 'loc-1',
  days: 3,
  startDate: '2026-05-04',
  endDate: '2026-05-06',
  status: 'pending',
  createdAt: '2026-04-28T08:00:00.000Z',
}

const cell: BalanceCell = {
  employeeId: 'emp-1',
  locationId: 'loc-1',
  daysAvailable: 11,
  lastUpdated: new Date('2026-04-28T00:00:00Z'),
}

const meta: Meta<typeof RequestRow> = {
  title: 'Manager/RequestRow',
  component: RequestRow,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
  args: {
    request: sampleRequest,
    managerId: 'mgr-1',
    onApprove: fn(),
    onDeny: fn(),
  },
}

export default meta
type Story = StoryObj<typeof RequestRow>

export const Collapsed: Story = { args: { defaultExpanded: false } }

export const ExpandingLoading: Story = {
  args: {
    defaultExpanded: true,
    forceBalanceContextState: { kind: 'loading' },
  },
}

export const ExpandedFresh: Story = {
  args: {
    defaultExpanded: true,
    forceBalanceContextState: { kind: 'fresh', balance: cell },
  },
}

export const ExpandedStaleThenRefreshed: Story = {
  args: {
    defaultExpanded: true,
    forceBalanceContextState: {
      kind: 'fresh-after-stale',
      balance: cell,
      previousDays: 10,
    },
  },
}

export const ExpandedFreshReadFailed: Story = {
  args: {
    defaultExpanded: true,
    forceBalanceContextState: { kind: 'error', message: 'HTTP 503 from HCM' },
  },
}
