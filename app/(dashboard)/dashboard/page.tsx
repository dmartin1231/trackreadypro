import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { addYears, differenceInDays, parseISO } from 'date-fns'
import Link from 'next/link'
import { Suspense } from 'react'
import { Users, CheckCircle2, XCircle, Clock, AlertTriangle, CalendarClock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getPeriodBounds, getPeriodBoundsForYear, periodTypeName, getSelectableYears } from '@/lib/training-period'
import EmployeeComplianceTable from '@/components/employee-compliance-table'
import YearSelector from '@/components/year-selector'
import BackupReminder from '@/components/backup-reminder'

export default async function DashboardPage({ searchParams }: { searchParams?: { period?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('agency_id').eq('id', user.id).single()
  if (!profile?.agency_id) redirect('/setup')

  const agencyId = profile.agency_id

  const [
    { data: agency },
    { data: employees },
    { data: records },
    { data: courses },
    { data: assignments },
  ] = await Promise.all([
    supabase.from('agencies').select('*').eq('id', agencyId).single(),
    supabase.from('employees').select('*').eq('agency_id', agencyId).order('name'),
    supabase.from('training_records').select('*').eq('agency_id', agencyId),
    supabase.from('courses').select('*').eq('agency_id', agencyId),
    supabase.from('training_assignments').select('*, course:courses(name)').eq('agency_id', agencyId),
  ])

  const requiredHours = agency?.required_hours ?? 24
  const trainingPeriod = agency?.training_period ?? 'calendar_year'
  const isLicenseRenewal = trainingPeriod === 'license_renewal'
  const today = new Date()
  const courseMap = Object.fromEntries((courses ?? []).map((c) => [c.id, c]))

  // Build year selector options
  const earliestHireDate = (employees ?? [])
    .map(e => e.hire_date)
    .filter(Boolean)
    .sort()[0] ?? null

  const yearOptions = getSelectableYears(
    agency ?? { training_period: 'calendar_year', fiscal_year_start_month: 1 },
    earliestHireDate,
    today
  )

  // Determine selected period value (defaults to current year / current FY / current anniversary)
  const defaultPeriodValue = yearOptions[0]?.value ?? today.getFullYear()
  const selectedPeriodValue = searchParams?.period ? parseInt(searchParams.period) : defaultPeriodValue
  const isCurrentPeriod = selectedPeriodValue === defaultPeriodValue

  // Per-employee period bounds — use selected year if not current, otherwise current period
  const periodBoundsMap: Record<string, ReturnType<typeof getPeriodBounds>> = {}
  ;(employees ?? []).forEach((emp) => {
    const agencyData = agency ?? { training_period: 'calendar_year' as const, fiscal_year_start_month: 1 }
    periodBoundsMap[emp.id] = isCurrentPeriod
      ? getPeriodBounds(agencyData, emp, today)
      : getPeriodBoundsForYear(agencyData, emp, selectedPeriodValue, today)
  })

  // Hours within each employee's training period (all records count toward hours)
  const employeeHours: Record<string, number> = {}
  ;(records ?? []).forEach((r) => {
    const bounds = periodBoundsMap[r.employee_id]
    if (!bounds) return
    const completed = parseISO(r.completed_date)
    if (completed >= bounds.start && completed <= bounds.end) {
      employeeHours[r.employee_id] = (employeeHours[r.employee_id] ?? 0) + Number(r.hours)
    }
  })

  // For cert-based calculations: keep only the latest record per employee+course
  // so a renewed CPR doesn't show the old expired record as a problem
  const latestCertRecords = (() => {
    const sorted = [...(records ?? [])].sort((a, b) => b.completed_date.localeCompare(a.completed_date))
    const seen = new Set<string>()
    return sorted.filter(r => {
      const key = `${r.employee_id}|${r.course_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  })()

  // For license_renewal: track expired certs per employee (latest cert per course only)
  const expiredCertsPerEmployee: Record<string, number> = {}
  latestCertRecords.forEach((r) => {
    const course = courseMap[r.course_id]
    if (!course || course.expires_years === null || course.track_expiration === false) return
    const expDate = addYears(parseISO(r.completed_date), course.expires_years)
    if (expDate < today) {
      expiredCertsPerEmployee[r.employee_id] = (expiredCertsPerEmployee[r.employee_id] ?? 0) + 1
    }
  })

  // Certs expiring within 30 days (latest cert per course only)
  const expiringPerEmployee: Record<string, number> = {}
  latestCertRecords.forEach((r) => {
    const course = courseMap[r.course_id]
    if (!course || course.expires_years === null || course.track_expiration === false) return
    const expDate = addYears(parseISO(r.completed_date), course.expires_years)
    const daysLeft = differenceInDays(expDate, today)
    if (daysLeft >= 0 && daysLeft <= 30) {
      expiringPerEmployee[r.employee_id] = (expiringPerEmployee[r.employee_id] ?? 0) + 1
    }
  })

  // Assignments per employee
  type AssignmentSummary = { overdue: number; dueSoon: Array<{ name: string; daysLeft: number }> }
  const assignmentsByEmployee: Record<string, AssignmentSummary> = {}
  ;(assignments ?? []).forEach((a: any) => {
    const daysLeft = differenceInDays(parseISO(a.due_date), today)
    if (!assignmentsByEmployee[a.employee_id]) {
      assignmentsByEmployee[a.employee_id] = { overdue: 0, dueSoon: [] }
    }
    if (daysLeft < 0) {
      assignmentsByEmployee[a.employee_id].overdue++
    } else if (daysLeft <= 30) {
      assignmentsByEmployee[a.employee_id].dueSoon.push({ name: a.course?.name ?? 'Unknown', daysLeft })
    }
  })

  const totalEmployees = employees?.length ?? 0

  const rows = (employees ?? []).map((emp) => {
    const hours = employeeHours[emp.id] ?? 0
    const percent = Math.min((hours / requiredHours) * 100, 100)
    const compliant = isLicenseRenewal
      ? (expiredCertsPerEmployee[emp.id] ?? 0) === 0
      : hours >= requiredHours
    const empAssignments = assignmentsByEmployee[emp.id] ?? { overdue: 0, dueSoon: [] }
    const expiring = expiringPerEmployee[emp.id] ?? 0
    const periodLabel = periodBoundsMap[emp.id]?.label ?? ''
    const employeeType = emp.employee_type ?? 'employee'
    return { emp, hours, percent, compliant, empAssignments, expiring, periodLabel, employeeType }
  }).sort((a, b) => {
    const aScore = a.empAssignments.overdue * 3 + a.empAssignments.dueSoon.length * 2 + (a.compliant ? 0 : 1)
    const bScore = b.empAssignments.overdue * 3 + b.empAssignments.dueSoon.length * 2 + (b.compliant ? 0 : 1)
    return bScore - aScore
  })

  const compliantCount = rows.filter((r) => r.compliant).length
  const nonCompliantCount = totalEmployees - compliantCount
  const avgHours = totalEmployees > 0
    ? (Object.values(employeeHours).reduce((a, b) => a + b, 0) / totalEmployees).toFixed(1)
    : '0.0'

  const totalExpiring = Object.values(expiringPerEmployee).reduce((a, b) => a + b, 0)
  const totalOverdueAssignments = Object.values(assignmentsByEmployee).reduce((s, v) => s + v.overdue, 0)
  const totalDueSoonAssignments = Object.values(assignmentsByEmployee).reduce((s, v) => s + v.dueSoon.length, 0)

  // Period label for the header (calendar/fiscal same for everyone; hire_date varies per employee)
  const headerPeriodLabel = trainingPeriod === 'hire_date'
    ? 'Hire date anniversary'
    : trainingPeriod === 'license_renewal'
    ? 'License renewal cycle'
    : rows[0]?.periodLabel ?? ''

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {headerPeriodLabel && !isLicenseRenewal && (
              <span className="ml-2 text-gray-400">· {periodTypeName(trainingPeriod)}: {headerPeriodLabel}</span>
            )}
          </p>
        </div>
        {!isLicenseRenewal && yearOptions.length > 1 && (
          <Suspense fallback={null}>
            <YearSelector
              options={yearOptions}
              currentValue={selectedPeriodValue}
              label="Viewing period"
            />
          </Suspense>
        )}
      </div>

      {/* Alert banners */}
      <div className="space-y-3 mb-8">
        <BackupReminder />
        {totalOverdueAssignments > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <CalendarClock className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              {totalOverdueAssignments} training assignment{totalOverdueAssignments !== 1 ? 's are' : ' is'} overdue
            </p>
          </div>
        )}
        {totalDueSoonAssignments > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <CalendarClock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800 font-medium">
              {totalDueSoonAssignments} training assignment{totalDueSoonAssignments !== 1 ? 's' : ''} due within 30 days
            </p>
          </div>
        )}
        {totalExpiring > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-800 font-medium">
              {totalExpiring} certification{totalExpiring !== 1 ? 's' : ''} expiring within 30 days
            </p>
            <Link href="/expiring-soon" className="ml-auto text-orange-700 text-xs font-medium hover:underline whitespace-nowrap">
              View →
            </Link>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total" value={totalEmployees} icon={<Users className="w-5 h-5" />} color="blue" />
        <MetricCard
          label="Compliant"
          value={compliantCount}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="green"
          sub={totalEmployees > 0 ? `${Math.round((compliantCount / totalEmployees) * 100)}% of team` : '—'}
        />
        <MetricCard
          label="Non-Compliant"
          value={nonCompliantCount}
          icon={<XCircle className="w-5 h-5" />}
          color="red"
          sub={totalEmployees > 0 ? `${Math.round((nonCompliantCount / totalEmployees) * 100)}% of team` : '—'}
        />
        <MetricCard
          label={isLicenseRenewal ? 'Avg Hours (all-time)' : 'Avg Hours (period)'}
          value={avgHours}
          icon={<Clock className="w-5 h-5" />}
          color="purple"
          sub={isLicenseRenewal ? 'License renewal mode' : `of ${requiredHours}h required`}
        />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-12 text-center text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No employees yet</p>
          <Link href="/employees" className="text-black text-sm hover:underline mt-1 block">Add employees →</Link>
        </div>
      ) : (
        <EmployeeComplianceTable
          rows={rows}
          requiredHours={requiredHours}
          trainingPeriod={trainingPeriod}
          isLicenseRenewal={isLicenseRenewal}
          courses={courses ?? []}
          agencyId={agencyId}
        />
      )}
    </div>
  )
}

function MetricCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode
  color: 'blue' | 'green' | 'red' | 'purple'; sub?: string
}) {
  const light = { blue: 'bg-blue-50', green: 'bg-emerald-50', red: 'bg-red-50', purple: 'bg-gray-100' }
  const icons = { blue: 'text-blue-600', green: 'text-emerald-600', red: 'text-red-600', purple: 'text-black' }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 ${light[color]} rounded-xl flex items-center justify-center ${icons[color]} mb-4`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
