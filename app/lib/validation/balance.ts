import { z } from 'zod'

// Wire shape for incoming JSON: lastUpdated is an ISO string before transform.
// The transform converts it to a Date so domain code can do date math freely.
export const BalanceCellSchema = z.object({
  employeeId: z.string().min(1),
  locationId: z.string().min(1),
  daysAvailable: z.number().int().nonnegative(),
  lastUpdated: z.iso.datetime().transform((s) => new Date(s)),
})
export type BalanceCell = z.infer<typeof BalanceCellSchema>

export const BalancesResponseSchema = z.array(BalanceCellSchema)
export type BalancesResponse = z.infer<typeof BalancesResponseSchema>
