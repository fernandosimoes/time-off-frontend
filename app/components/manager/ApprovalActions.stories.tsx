import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { fn } from 'storybook/test'

import { ApprovalActions } from './ApprovalActions'

const meta: Meta<typeof ApprovalActions> = {
  title: 'Manager/ApprovalActions',
  component: ApprovalActions,
  parameters: { layout: 'centered' },
  args: { onApprove: fn(), onDeny: fn() },
}

export default meta
type Story = StoryObj<typeof ApprovalActions>

export const Idle: Story = { args: { disabled: false, busy: null } }
export const Approving: Story = { args: { busy: 'approve' } }
export const Denying: Story = { args: { busy: 'deny' } }
