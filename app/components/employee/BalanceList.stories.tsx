import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import type { BalanceCell } from '@/lib/domain'

import { BalanceList } from './BalanceList'

const cellHQ: BalanceCell = {
  employeeId: 'emp-1',
  locationId: 'loc-1',
  daysAvailable: 10,
  lastUpdated: new Date('2026-04-27T00:00:00Z'),
}
const cellRemote: BalanceCell = {
  employeeId: 'emp-1',
  locationId: 'loc-2',
  daysAvailable: 5,
  lastUpdated: new Date('2026-04-27T00:00:00Z'),
}

const meta: Meta<typeof BalanceList> = {
  title: 'Employee/BalanceList',
  component: BalanceList,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
}

export default meta
type Story = StoryObj<typeof BalanceList>

export const Empty: Story = {
  args: { entries: [] },
}

export const AllLoading: Story = {
  args: {
    entries: [
      { key: 'loc-1', state: { kind: 'loading' } },
      { key: 'loc-2', state: { kind: 'loading' } },
    ],
  },
}

export const MixedStates: Story = {
  args: {
    entries: [
      { key: 'loc-1', state: { kind: 'fresh', balance: cellHQ, locationName: 'Headquarters' } },
      {
        key: 'loc-2',
        state: {
          kind: 'optimistic-pending',
          balance: { ...cellRemote, daysAvailable: 3 },
          locationName: 'Remote',
          pendingDelta: 2,
        },
      },
    ],
  },
}
