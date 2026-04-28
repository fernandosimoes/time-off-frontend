// Domain types for employees and locations. The canonical schemas live in
// lib/validation; we re-export the inferred types here so consumers import
// from a single place (@/lib/domain) without coupling to Zod.
export type { Employee, Location } from '@/lib/validation/employee'
