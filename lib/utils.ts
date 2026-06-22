import { addYears, differenceInDays, format, parseISO, startOfYear } from 'date-fns'
import type { Course, TrainingRecord, ExpirationStatus } from './types'

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

export function getExpirationDate(
  completedDate: string,
  expiresYears: number | null
): string | null {
  if (expiresYears === null) return null
  return addYears(parseISO(completedDate), expiresYears).toISOString().split('T')[0]
}

// Returns null when track_expiration is off, so the course is treated as "never expires"
export function effectiveExpiresYears(
  expiresYears: number | null | undefined,
  trackExpiration: boolean | undefined
): number | null {
  if (trackExpiration === false) return null
  return expiresYears ?? null
}

export function getExpirationStatus(
  completedDate: string,
  expiresYears: number | null
): ExpirationStatus {
  if (expiresYears === null) return 'never'
  const expDate = addYears(parseISO(completedDate), expiresYears)
  const today = new Date()
  const daysUntil = differenceInDays(expDate, today)

  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 30) return 'expiring_30'
  if (daysUntil <= 60) return 'expiring_60'
  return 'valid'
}

export function getStatusBadge(status: ExpirationStatus) {
  switch (status) {
    case 'expired':
      return { label: 'Expired', className: 'bg-red-100 text-red-700' }
    case 'expiring_30':
      return { label: 'Exp. <30d', className: 'bg-orange-100 text-orange-700' }
    case 'expiring_60':
      return { label: 'Exp. <60d', className: 'bg-yellow-100 text-yellow-700' }
    case 'valid':
      return { label: 'Valid', className: 'bg-green-100 text-green-700' }
    case 'never':
      return { label: 'No Expiry', className: 'bg-gray-100 text-gray-600' }
  }
}

export function getYtdHours(
  records: (TrainingRecord & { course?: Course })[],
  employeeId: string
): number {
  const yearStart = startOfYear(new Date())
  return records
    .filter(
      (r) =>
        r.employee_id === employeeId && new Date(r.completed_date) >= yearStart
    )
    .reduce((sum, r) => sum + Number(r.hours), 0)
}

export function expiresYearsLabel(expiresYears: number | null): string {
  if (expiresYears === null) return 'Never'
  if (expiresYears === 0.5) return '6 months'
  if (expiresYears === 1) return '1 year'
  if (expiresYears === 2) return '2 years'
  if (expiresYears === 3) return '3 years'
  return `${expiresYears} years`
}
