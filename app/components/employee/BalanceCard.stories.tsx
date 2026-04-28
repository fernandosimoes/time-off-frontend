import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import type { BalanceCell } from '@/lib/domain'

import { BalanceCard } from './BalanceCard'

const sampleCell: BalanceCell = {
  employeeId: 'emp-1',
  locationId: 'loc-1',
  daysAvailable: 10,
  lastUpdated: new Date('2026-04-27T00:00:00Z'),
}

const meta: Meta<typeof BalanceCard> = {
  title: 'Employee/BalanceCard',
  component: BalanceCard,
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
}

export default meta
type Story = StoryObj<typeof BalanceCard>

export const Loading: Story = {
  args: { state: { kind: 'loading' } },
}

export const Empty: Story = {
  args: { state: { kind: 'empty', locationName: 'Headquarters' } },
}

export const Fresh: Story = {
  args: {
    state: { kind: 'fresh', balance: sampleCell, locationName: 'Headquarters' },
  },
}

export const Stale: Story = {
  args: {
    state: { kind: 'stale', balance: sampleCell, locationName: 'Headquarters' },
  },
}

export const OptimisticPending: Story = {
  args: {
    state: {
      kind: 'optimistic-pending',
      balance: { ...sampleCell, daysAvailable: 7 },
      locationName: 'Headquarters',
      pendingDelta: 3,
    },
  },
}

export const RolledBack: Story = {
  args: {
    state: {
      kind: 'rolled-back',
      balance: sampleCell,
      locationName: 'Headquarters',
      reason: 'Insufficient balance',
    },
  },
}

export const Error: Story = {
  args: {
    state: {
      kind: 'error',
      locationName: 'Headquarters',
      message: 'Could not load balance. Retrying…',
    },
  },
}
