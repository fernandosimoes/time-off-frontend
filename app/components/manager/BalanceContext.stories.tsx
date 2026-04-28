import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import type { BalanceCell } from '@/lib/domain'

import { BalanceContext } from './BalanceContext'

const cell: BalanceCell = {
  employeeId: 'emp-1',
  locationId: 'loc-1',
  daysAvailable: 11,
  lastUpdated: new Date('2026-04-28T00:00:00Z'),
}

const meta: Meta<typeof BalanceContext> = {
  title: 'Manager/BalanceContext',
  component: BalanceContext,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
  args: { onRetry: fn() },
}

export default meta
type Story = StoryObj<typeof BalanceContext>

export const Loading: Story = { args: { state: { kind: 'loading' } } }
export const Fresh: Story = { args: { state: { kind: 'fresh', balance: cell } } }
export const FreshAfterStale: Story = {
  args: {
    state: { kind: 'fresh-after-stale', balance: cell, previousDays: 10 },
  },
}
export const Error: Story = {
  args: {
    state: { kind: 'error', message: 'HTTP 503 from HCM' },
  },
}
