import { z } from 'zod'

export const EmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hireDate: z.iso.datetime().transform((s) => new Date(s)),
})
export type Employee = z.infer<typeof EmployeeSchema>

export const LocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})
export type Location = z.infer<typeof LocationSchema>
