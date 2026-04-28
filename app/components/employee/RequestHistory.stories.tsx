import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import type { TimeOffRequest } from '@/lib/domain'

import { RequestHistory } from './RequestHistory'

const baseReq: TimeOffRequest = {
  id: 'req-1',
  employeeId: 'emp-1',
  locationId: 'loc-1',
  days: 2,
  startDate: '2026-05-01',
  endDate: '2026-05-02',
  status: 'pending',
  createdAt: '2026-04-28T10:00:00.000Z',
}

const meta: Meta<typeof RequestHistory> = {
  title: 'Employee/RequestHistory',
  component: RequestHistory,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
}

export default meta
type Story = StoryObj<typeof RequestHistory>

export const Empty: Story = {
  args: { requests: [] },
}

export const OnlyPending: Story = {
  args: {
    requests: [
      baseReq,
      { ...baseReq, id: 'req-2', startDate: '2026-06-10', endDate: '2026-06-12', days: 3 },
    ],
  },
}

export const Mixed: Story = {
  args: {
    requests: [
      {
        ...baseReq,
        id: 'req-approved',
        startDate: '2026-04-15',
        endDate: '2026-04-16',
        days: 2,
        status: 'approved',
        decidedAt: '2026-04-10T14:00:00.000Z',
        decidedBy: 'mgr-1',
      },
      { ...baseReq, id: 'req-pending', startDate: '2026-05-01', endDate: '2026-05-03', days: 3 },
      {
        ...baseReq,
        id: 'req-denied',
        locationId: 'loc-2',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        days: 5,
        status: 'denied',
        decidedAt: '2026-02-25T09:00:00.000Z',
        decidedBy: 'mgr-1',
      },
    ],
  },
}
