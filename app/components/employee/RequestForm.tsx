'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Location } from '@/lib/domain'
import type { HcmError } from '@/lib/validation'
import { cn } from '@/lib/utils'

const FormSchema = z
  .object({
    locationId: z.string().min(1, 'Choose a location'),
    startDate: z.date({ message: 'Pick a start date' }),
    endDate: z.date({ message: 'Pick an end date' }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })

type FormValues = z.infer<typeof FormSchema>

export type RequestFormSubmission = {
  locationId: string
  startDate: string
  endDate: string
  days: number
}

export type RequestFormProps = {
  locations: Location[]
  onSubmit: (submission: RequestFormSubmission) => void
  isSubmitting?: boolean
  serverError?: HcmError | null
  // Test-only: pre-fill the form so interaction tests don't need to drive
  // the Calendar popover (which is brittle to assert against).
  defaultValues?: Partial<FormValues>
}

function dayCount(start: Date, end: Date): number {
  // Inclusive count: Mon→Tue is 2 days off, not 1.
  return Math.max(1, differenceInCalendarDays(end, start) + 1)
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

export function RequestForm({
  locations,
  onSubmit,
  isSubmitting = false,
  serverError = null,
  defaultValues,
}: RequestFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onBlur',
    defaultValues: defaultValues as FormValues | undefined,
  })

  // RHF watch is the documented way to read live form values; the eslint
  // rule is incompatible-library, suppressed once for the pair.
  // eslint-disable-next-line react-hooks/incompatible-library
  const startDate = form.watch('startDate')
  const endDate = form.watch('endDate')
  const days =
    startDate instanceof Date && endDate instanceof Date && endDate >= startDate
      ? dayCount(startDate, endDate)
      : null

  function submitHandler(values: FormValues) {
    onSubmit({
      locationId: values.locationId,
      startDate: format(values.startDate, 'yyyy-MM-dd'),
      endDate: format(values.endDate, 'yyyy-MM-dd'),
      days: dayCount(values.startDate, values.endDate),
    })
    form.reset()
  }

  return (
    <form
      onSubmit={form.handleSubmit(submitHandler)}
      className="space-y-4"
      data-testid="request-form"
    >
      <div>
        <Label htmlFor="locationId">Location</Label>
        <Controller
          control={form.control}
          name="locationId"
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger id="locationId" className="mt-1 w-full">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={form.formState.errors.locationId?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DatePickerField
          name="startDate"
          label="Start date"
          control={form.control}
          error={form.formState.errors.startDate?.message}
        />
        <DatePickerField
          name="endDate"
          label="End date"
          control={form.control}
          error={form.formState.errors.endDate?.message}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        {days !== null ? (
          <span data-testid="days-computed">
            {days} day{days === 1 ? '' : 's'} requested
          </span>
        ) : (
          <span>Pick dates to compute total days</span>
        )}
      </div>

      {serverError && (
        <Alert variant="destructive" data-testid="server-error">
          <AlertTitle>{serverError.error.replaceAll('_', ' ')}</AlertTitle>
          <AlertDescription>
            {serverError.error === 'INSUFFICIENT_BALANCE'
              ? `Requested ${serverError.requested} but only ${serverError.available} available.`
              : 'message' in serverError && serverError.message
                ? serverError.message
                : 'Something went wrong. Try again.'}
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting} data-testid="submit-button">
        {isSubmitting ? 'Submitting…' : 'Submit request'}
      </Button>
    </form>
  )
}

type DatePickerFieldProps = {
  name: 'startDate' | 'endDate'
  label: string
  control: ReturnType<typeof useForm<FormValues>>['control']
  error?: string
}

function DatePickerField({ name, label, control, error }: DatePickerFieldProps) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  id={name}
                  variant="outline"
                  className={cn(
                    'mt-1 w-full justify-start text-left font-normal',
                    !field.value && 'text-muted-foreground',
                  )}
                  data-testid={`${name}-trigger`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value instanceof Date ? format(field.value, 'PPP') : 'Pick a date'}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value instanceof Date ? field.value : undefined}
                onSelect={(date) => field.onChange(date ?? undefined)}
                disabled={{ before: startOfDay(new Date()) }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        )}
      />
      <FieldError message={error} />
    </div>
  )
}

// Re-exported helper so the page-level connector can pre-fill values from a
// stored draft if needed — kept for symmetry with SubmitRequestSchema.
export function parseISODate(s: string): Date {
  return parseISO(s)
}
