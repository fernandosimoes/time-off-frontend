import { z } from 'zod'

const isoCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be ISO calendar date (YYYY-MM-DD)')

export const RequestStatusSchema = z.enum(['pending', 'approved', 'denied'])
export type RequestStatus = z.infer<typeof RequestStatusSchema>

export const SubmitRequestSchema = z.object({
  employeeId: z.string().min(1),
  locationId: z.string().min(1),
  days: z.number().int().positive(),
  startDate: isoCalendarDate,
  endDate: isoCalendarDate,
})
export type SubmitRequest = z.infer<typeof SubmitRequestSchema>

export const ApproveRequestSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['approve', 'deny']),
  managerId: z.string().min(1),
})
export type ApproveRequest = z.infer<typeof ApproveRequestSchema>

export const TimeOffRequestSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  locationId: z.string().min(1),
  days: z.number().int().positive(),
  startDate: isoCalendarDate,
  endDate: isoCalendarDate,
  status: RequestStatusSchema,
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().optional(),
  decidedBy: z.string().min(1).optional(),
})
export type TimeOffRequest = z.infer<typeof TimeOffRequestSchema>

export const TimeOffRequestListSchema = z.array(TimeOffRequestSchema)
export type TimeOffRequestList = z.infer<typeof TimeOffRequestListSchema>
