import type { z } from 'zod'

// Parse a request body against a Zod schema. Returns either the parsed value
// or a 400 Response with the Zod error tree. Handlers can early-return on the
// `error` branch.
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: 'BAD_REQUEST', message: 'invalid JSON' },
        { status: 400 },
      ),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      response: Response.json(
        {
          error: 'BAD_REQUEST',
          message: 'request body failed validation',
          details: result.error.flatten(),
        },
        { status: 400 },
      ),
    }
  }

  return { ok: true, data: result.data }
}

// Dev-mode-only outgoing response shape assertion. Logs a warning if the
// payload doesn't match the schema after JSON roundtrip (so Date fields get
// re-serialized to strings before the parse, matching wire shape).
export function devAssertResponse<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
  label: string,
): void {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') return
  const wire = JSON.parse(JSON.stringify(value))
  const result = schema.safeParse(wire)
  if (!result.success) {
    console.warn(
      `[hcm-mock] outgoing response (${label}) failed schema:`,
      result.error.flatten(),
    )
  }
}
