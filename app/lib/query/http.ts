// Shared HTTP helpers for the query layer. Centralizes the fetch/parse/throw
// pattern so individual hooks stay small and consistent.

import type { z } from 'zod'

import type { HcmError } from '@/lib/validation'
import { HcmErrorSchema } from '@/lib/validation'

export class HcmRequestError extends Error {
  constructor(
    public readonly hcm: HcmError,
    public readonly status: number,
  ) {
    super(`HCM ${hcm.error} (HTTP ${status})`)
    this.name = 'HcmRequestError'
  }
}

async function parseErrorBody(res: Response): Promise<HcmError> {
  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    return { error: 'BAD_REQUEST', message: `HTTP ${res.status}` }
  }
  const parsed = HcmErrorSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return { error: 'BAD_REQUEST', message: `HTTP ${res.status}` }
}

export async function fetchJson<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const hcm = await parseErrorBody(res)
    throw new HcmRequestError(hcm, res.status)
  }
  const json = await res.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`Response did not match expected shape: ${parsed.error.message}`)
  }
  return parsed.data
}
