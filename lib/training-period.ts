import { startOfYear, endOfYear, addYears, addMonths, subDays, parseISO, format } from 'date-fns'

export type TrainingPeriod = 'calendar_year' | 'hire_date' | 'fiscal_year' | 'license_renewal'

interface PeriodAgency {
  training_period: TrainingPeriod
  fiscal_year_start_month: number
}

interface PeriodEmployee {
  hire_date: string | null
}

export interface PeriodBounds {
  start: Date
  end: Date
  label: string
}

/**
 * Returns the start and end of the current training period for a given employee.
 * For hire_date mode each employee gets their own rolling window.
 * For license_renewal mode we return all-time so hours are visible but compliance
 * is determined by cert status, not hours.
 */
export function getPeriodBounds(
  agency: PeriodAgency,
  employee: PeriodEmployee,
  today: Date = new Date()
): PeriodBounds {
  switch (agency.training_period) {
    case 'calendar_year':
      return {
        start: startOfYear(today),
        end: endOfYear(today),
        label: `Jan 1 – Dec 31, ${today.getFullYear()}`,
      }

    case 'hire_date': {
      if (!employee.hire_date) {
        // No hire date — fall back to calendar year
        return {
          start: startOfYear(today),
          end: endOfYear(today),
          label: `Jan 1 – Dec 31, ${today.getFullYear()} (no hire date)`,
        }
      }
      const hire = parseISO(employee.hire_date)
      // Find the most recent anniversary on or before today
      let periodStart = new Date(today.getFullYear(), hire.getMonth(), hire.getDate())
      if (periodStart > today) {
        periodStart = new Date(today.getFullYear() - 1, hire.getMonth(), hire.getDate())
      }
      const periodEnd = subDays(addYears(periodStart, 1), 1)
      return {
        start: periodStart,
        end: periodEnd,
        label: `${format(periodStart, 'MMM d, yyyy')} – ${format(periodEnd, 'MMM d, yyyy')}`,
      }
    }

    case 'fiscal_year': {
      const startMonth = Math.max(1, Math.min(12, agency.fiscal_year_start_month)) - 1 // 0-indexed
      let fyStart = new Date(today.getFullYear(), startMonth, 1)
      if (fyStart > today) {
        fyStart = new Date(today.getFullYear() - 1, startMonth, 1)
      }
      const fyEnd = subDays(addYears(fyStart, 1), 1)
      return {
        start: fyStart,
        end: fyEnd,
        label: `${format(fyStart, 'MMM d, yyyy')} – ${format(fyEnd, 'MMM d, yyyy')}`,
      }
    }

    case 'license_renewal':
      // Compliance = certifications current, not hours-based. Return all-time window.
      return {
        start: new Date(0),
        end: today,
        label: 'License renewal cycle',
      }

    default:
      return {
        start: startOfYear(today),
        end: endOfYear(today),
        label: `Jan 1 – Dec 31, ${today.getFullYear()}`,
      }
  }
}

/** Human-readable name for each period type */
export function periodTypeName(period: TrainingPeriod): string {
  switch (period) {
    case 'calendar_year':   return 'Calendar Year'
    case 'hire_date':       return 'Hire Date Anniversary'
    case 'fiscal_year':     return 'Fiscal Year'
    case 'license_renewal': return 'License Renewal Cycle'
  }
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export interface HistoricalPeriod extends PeriodBounds {
  isCurrent: boolean
  yearIndex: number  // 1 = first period, 2 = second, etc.
  shortLabel: string // e.g. "2024" or "Year 3"
}

/**
 * Returns all training periods from hire date to now, oldest first.
 * Used to render per-year progress bars on the employee profile.
 */
export function getAllPastPeriods(
  agency: PeriodAgency,
  employee: PeriodEmployee,
  today: Date = new Date()
): HistoricalPeriod[] {
  if (!employee.hire_date) {
    const bounds = getPeriodBounds(agency, employee, today)
    return [{ ...bounds, isCurrent: true, yearIndex: 1, shortLabel: 'Current' }]
  }

  const hire = parseISO(employee.hire_date)
  const periods: HistoricalPeriod[] = []

  switch (agency.training_period) {
    case 'calendar_year': {
      const startYear = hire.getFullYear()
      const endYear = today.getFullYear()
      for (let year = startYear; year <= endYear; year++) {
        periods.push({
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31),
          label: `Calendar Year ${year}`,
          shortLabel: String(year),
          isCurrent: year === endYear,
          yearIndex: year - startYear + 1,
        })
      }
      break
    }

    case 'hire_date': {
      let periodStart = new Date(hire)
      let yearIndex = 1
      while (periodStart <= today) {
        const periodEnd = subDays(addYears(periodStart, 1), 1)
        periods.push({
          start: periodStart,
          end: periodEnd,
          label: `Year ${yearIndex} · ${format(periodStart, 'MMM d, yyyy')} – ${format(periodEnd, 'MMM d, yyyy')}`,
          shortLabel: `Year ${yearIndex}`,
          isCurrent: periodEnd >= today,
          yearIndex,
        })
        periodStart = addYears(periodStart, 1)
        yearIndex++
        if (yearIndex > 50) break
      }
      break
    }

    case 'fiscal_year': {
      const startMonth = Math.max(1, Math.min(12, agency.fiscal_year_start_month)) - 1
      // First FY that started on or before hire date
      let fyStart = new Date(hire.getFullYear(), startMonth, 1)
      if (fyStart > hire) fyStart = new Date(hire.getFullYear() - 1, startMonth, 1)
      let yearIndex = 1
      while (fyStart <= today) {
        const fyEnd = subDays(addYears(fyStart, 1), 1)
        periods.push({
          start: fyStart,
          end: fyEnd,
          label: `FY ${format(fyStart, 'MMM yyyy')} – ${format(fyEnd, 'MMM yyyy')}`,
          shortLabel: `FY ${fyStart.getFullYear()}`,
          isCurrent: fyEnd >= today,
          yearIndex,
        })
        fyStart = addYears(fyStart, 1)
        yearIndex++
        if (yearIndex > 50) break
      }
      break
    }

    case 'license_renewal':
      return [{ ...getPeriodBounds(agency, employee, today), isCurrent: true, yearIndex: 1, shortLabel: 'Current' }]
  }

  return periods // oldest first — UI can reverse if needed
}

/**
 * For the dashboard year selector: list of selectable period indices or years.
 * Returns them newest-first for display in a dropdown.
 */
export function getSelectableYears(
  agency: PeriodAgency,
  earliestHireDate: string | null,
  today: Date = new Date()
): Array<{ value: number; label: string }> {
  if (!earliestHireDate) return []
  const hire = parseISO(earliestHireDate)

  switch (agency.training_period) {
    case 'calendar_year': {
      const years: Array<{ value: number; label: string }> = []
      for (let y = today.getFullYear(); y >= hire.getFullYear(); y--) {
        years.push({ value: y, label: String(y) })
      }
      return years
    }
    case 'fiscal_year': {
      const startMonth = Math.max(1, Math.min(12, agency.fiscal_year_start_month)) - 1
      let fyStart = new Date(hire.getFullYear(), startMonth, 1)
      if (fyStart > hire) fyStart = new Date(hire.getFullYear() - 1, startMonth, 1)
      const results: Array<{ value: number; label: string }> = []
      let cur = fyStart
      let idx = 1
      while (cur <= today) {
        results.push({ value: idx, label: `FY ${format(cur, 'MMM yyyy')} – ${format(subDays(addYears(cur, 1), 1), 'MMM yyyy')}` })
        cur = addYears(cur, 1)
        idx++
      }
      return results.reverse()
    }
    case 'hire_date': {
      // Max anniversary years across all employees — use a rough estimate from hire date
      const maxYears = today.getFullYear() - hire.getFullYear() + 2
      return Array.from({ length: Math.max(1, maxYears) }, (_, i) => ({
        value: i + 1,
        label: `Year ${i + 1}`,
      })).reverse()
    }
    default:
      return []
  }
}

/**
 * Given a selected year value (calendar year, FY index, or anniversary year),
 * return the PeriodBounds to use for dashboard compliance calculation.
 * For hire_date mode, each employee still gets their own bounds for that year index.
 */
export function getPeriodBoundsForYear(
  agency: PeriodAgency,
  employee: PeriodEmployee,
  yearValue: number,
  today: Date = new Date()
): PeriodBounds {
  if (!employee.hire_date) return getPeriodBounds(agency, employee, today)
  const hire = parseISO(employee.hire_date)

  switch (agency.training_period) {
    case 'calendar_year': {
      return {
        start: new Date(yearValue, 0, 1),
        end: new Date(yearValue, 11, 31),
        label: String(yearValue),
      }
    }
    case 'fiscal_year': {
      const startMonth = Math.max(1, Math.min(12, agency.fiscal_year_start_month)) - 1
      let fyStart = new Date(hire.getFullYear(), startMonth, 1)
      if (fyStart > hire) fyStart = new Date(hire.getFullYear() - 1, startMonth, 1)
      // advance to the yearValue-th fiscal year
      const targetStart = addYears(fyStart, yearValue - 1)
      const targetEnd = subDays(addYears(targetStart, 1), 1)
      return {
        start: targetStart,
        end: targetEnd,
        label: `FY ${format(targetStart, 'MMM yyyy')} – ${format(targetEnd, 'MMM yyyy')}`,
      }
    }
    case 'hire_date': {
      // yearValue = anniversary year index (1, 2, 3…)
      const periodStart = addYears(hire, yearValue - 1)
      const periodEnd = subDays(addYears(periodStart, 1), 1)
      return {
        start: periodStart,
        end: periodEnd,
        label: `Year ${yearValue} · ${format(periodStart, 'MMM d, yyyy')} – ${format(periodEnd, 'MMM d, yyyy')}`,
      }
    }
    default:
      return getPeriodBounds(agency, employee, today)
  }
}
