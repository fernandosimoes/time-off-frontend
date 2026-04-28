import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { Location } from '@/lib/domain'

import { RequestForm } from './RequestForm'

const sampleLocations: Location[] = [
  { id: 'loc-1', name: 'Headquarters' },
  { id: 'loc-2', name: 'Remote' },
]

const meta: Meta<typeof RequestForm> = {
  title: 'Employee/RequestForm',
  component: RequestForm,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
  args: {
    locations: sampleLocations,
    onSubmit: fn(),
    isSubmitting: false,
    serverError: null,
  },
}

export default meta
type Story = StoryObj<typeof RequestForm>

export const Empty: Story = {}

export const WithValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // Submit immediately with no fields filled — RHF + Zod resolver fires
    // validation errors for all required fields. The message text comes from
    // Zod's default ("Invalid input") when the field is `undefined`; our
    // custom messages only fire when the string is present-but-empty.
    await userEvent.click(canvas.getByTestId('submit-button'))
    const errors = await canvas.findAllByText(/Invalid input|Pick a/i)
    expect(errors.length).toBeGreaterThan(0)
  },
}

export const Submitting: Story = {
  args: { isSubmitting: true },
}

export const ServerError: Story = {
  args: {
    serverError: { error: 'INSUFFICIENT_BALANCE', requested: 5, available: 2 },
  },
}
