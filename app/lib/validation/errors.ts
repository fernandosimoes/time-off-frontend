import { z } from 'zod'

const InsufficientBalanceSchema = z.object({
  error: z.literal('INSUFFICIENT_BALANCE'),
  requested: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
})

const NotFoundSchema = z.object({
  error: z.literal('NOT_FOUND'),
})

const BadRequestSchema = z.object({
  error: z.literal('BAD_REQUEST'),
  message: z.string().optional(),
  details: z.unknown().optional(),
})

export const HcmErrorSchema = z.discriminatedUnion('error', [
  InsufficientBalanceSchema,
  NotFoundSchema,
  BadRequestSchema,
])
export type HcmError = z.infer<typeof HcmErrorSchema>
