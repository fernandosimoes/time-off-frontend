import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import type { TimeOffRequest } from '@/lib/domain'

import { PendingRequestList } from './PendingRequestList'

const baseReq: TimeOffRequest = {
  id: 'req-base',
  employeeId: 'emp-1',
  locationId: 'loc-1',
  days: 3,
  startDate: '2026-05-04',
  endDate: '2026-05-06',
  status: 'pending',
  createdAt: '2026-04-28T08:00:00.000Z',
}

const meta: Meta<typeof PendingRequestList> = {
  title: 'Manager/PendingRequestList',
  component: PendingRequestList,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
  args: { managerId: 'mgr-1' },
}

export default meta
type Story = StoryObj<typeof PendingRequestList>

export const Empty: Story = { args: { requests: [] } }

// "All pending" — three pending entries from different employees, the demo
// seed shape.
export const AllPending: Story = {
  args: {
    requests: [
      { ...baseReq, id: 'req-emp1', employeeId: 'emp-1' },
      {
        ...baseReq,
        id: 'req-emp2',
        employeeId: 'emp-2',
        days: 5,
        startDate: '2026-05-11',
        endDate: '2026-05-15',
      },
      {
        ...baseReq,
        id: 'req-emp3',
        employeeId: 'emp-3',
        locationId: 'loc-2',
        days: 2,
        startDate: '2026-05-18',
        endDate: '2026-05-19',
      },
    ],
  },
}

// "Mixed statuses" — server filter usually scopes to pending, but if it
// doesn't (a misconfigured query) the row layout still degrades gracefully.
// Approved/denied rows are shown for illustration only.
export const MixedStatuses: Story = {
  args: {
    requests: [
      { ...baseReq, id: 'req-pending' },
      {
        ...baseReq,
        id: 'req-approved',
        status: 'approved',
        decidedAt: '2026-04-25T12:00:00.000Z',
        decidedBy: 'mgr-1',
        startDate: '2026-04-26',
        endDate: '2026-04-28',
      },
      {
        ...baseReq,
        id: 'req-denied',
        status: 'denied',
        decidedAt: '2026-04-20T10:00:00.000Z',
        decidedBy: 'mgr-1',
        startDate: '2026-04-22',
        endDate: '2026-04-23',
      },
    ],
  },
}
