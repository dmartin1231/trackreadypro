'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { parseISO, addYears, isAfter, isBefore, startOfDay, endOfDay, format } from 'date-fns'
import {
  FileSpreadsheet, FileText, Loader2, Download,
  BarChart3, Users, BookOpen, ClipboardList,
  ChevronDown, ChevronLeft, ChevronRight,
  X, Search, Check, Clock, AlertTriangle, Play,
  SlidersHorizontal,
} from 'lucide-react'
import { formatDate, getExpirationDate, getExpirationStatus } from '@/lib/utils'
import {
  getPeriodBounds, getPeriodBoundsForYear, getSelectableYears, periodTypeName,
} from '@/lib/training-period'
import type { Agency, Employee, Course, TrainingRecord } from '@/lib/types'

type ReportType =
  | 'compliance_summary'
  | 'employee_history'
  | 'certification_status'
  | 'training_log'
  | 'expiring_window'
  | 'gap_report'
  | 'employee_transcript'
  | 'custom_report'

// ── Custom report builder config ──────────────────────────────────────────────
type CustomScope = 'all' | 'latest_per_combo' | 'with_cert' | 'expired_expiring'
type CustomSort  = 'emp_asc' | 'emp_desc' | 'date_desc' | 'date_asc' | 'course_asc' | 'exp_date_asc' | 'status'

type CustomColumnDef = {
  id: string
  group: 'Employee' | 'Course' | 'Training Record'
  label: string
  required?: boolean
}

const CUSTOM_COLUMN_DEFS: CustomColumnDef[] = [
  { id: 'emp_name',       group: 'Employee',        label: 'Name',               required: true  },
  { id: 'emp_number',     group: 'Employee',        label: 'Employee ID'                         },
  { id: 'emp_hire_date',  group: 'Employee',        label: 'Hire Date'                           },
  { id: 'emp_type',       group: 'Employee',        label: 'Role (Staff / Admin)'                },
  { id: 'course_name',    group: 'Course',          label: 'Course Name',        required: true  },
  { id: 'course_hrs',     group: 'Course',          label: 'Credit Hours'                        },
  { id: 'course_expiry',  group: 'Course',          label: 'Expiration Policy'                   },
  { id: 'completed_date', group: 'Training Record', label: 'Completion Date'                     },
  { id: 'hours_earned',   group: 'Training Record', label: 'Hours Earned'                        },
  { id: 'exp_date',       group: 'Training Record', label: 'Expiration Date'                     },
  { id: 'days_remaining', group: 'Training Record', label: 'Days Remaining'                      },
  { id: 'status',         group: 'Training Record', label: 'Status'                              },
  { id: 'has_cert',       group: 'Training Record', label: 'Certificate on File'                 },
]

const DEFAULT_CUSTOM_COLUMNS = new Set(['emp_name', 'course_name', 'completed_date', 'hours_earned', 'exp_date', 'status'])

const REPORT_TYPES = [
  {
    id: 'compliance_summary' as ReportType,
    label: 'Compliance Summary',
    icon: BarChart3,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    category: 'Audit',
    categoryColor: 'bg-blue-100 text-blue-700',
    description: 'Hours vs required per employee. The primary report for state audits and annual compliance reviews.',
    hint: 'Best for: annual audits, showing who met required training hours for a period.',
  },
  {
    id: 'employee_history' as ReportType,
    label: 'Employee Training History',
    icon: Users,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    category: 'History',
    categoryColor: 'bg-violet-100 text-violet-700',
    description: 'Every training record for one or more employees, optionally filtered by course or date.',
    hint: 'Best for: reviewing what an individual completed over time.',
  },
  {
    id: 'certification_status' as ReportType,
    label: 'Certification Status',
    icon: BookOpen,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    category: 'Certifications',
    categoryColor: 'bg-emerald-100 text-emerald-700',
    description: "Current valid/expiring/expired status for each employee+course combination. Select a course to see who's certified.",
    hint: 'Best for: auditing one cert across the whole team.',
  },
  {
    id: 'training_log' as ReportType,
    label: 'Full Training Log',
    icon: ClipboardList,
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
    category: 'Records',
    categoryColor: 'bg-gray-100 text-gray-600',
    description: 'Every training record in the system. Filter by employee, course, or date to narrow down.',
    hint: 'Best for: a complete raw export of all training activity.',
  },
  {
    id: 'expiring_window' as ReportType,
    label: 'Expiring Within X Days',
    icon: Clock,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-50',
    category: 'Operations',
    categoryColor: 'bg-orange-100 text-orange-700',
    description: 'Certifications expiring within a custom window — 30, 60, 90, or 180 days. Includes already-expired.',
    hint: 'Best for: planning ahead and scheduling renewal training.',
  },
  {
    id: 'gap_report' as ReportType,
    label: 'Training Gap Report',
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    category: 'Gaps',
    categoryColor: 'bg-red-100 text-red-700',
    description: 'Shows employees who have never completed a specific course. Catches anyone who was skipped entirely.',
    hint: 'Best for: identifying employees missing a required course.',
  },
  {
    id: 'employee_transcript' as ReportType,
    label: 'Employee Transcript',
    icon: FileText,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-50',
    category: 'Personnel',
    categoryColor: 'bg-teal-100 text-teal-700',
    description: 'A complete training record for one employee — every course, date, hours, and cert status.',
    hint: 'Best for: personnel files, employee requests, and state audits.',
  },
  {
    id: 'custom_report' as ReportType,
    label: 'Custom Report',
    icon: SlidersHorizontal,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
    category: 'Custom',
    categoryColor: 'bg-indigo-100 text-indigo-700',
    description: 'Pick exactly which columns, records, filters, and sort order you want. Fully yours.',
    hint: 'Best for: one-off reports and anything the other report types don\'t cover.',
  },
]

type RecordWithJoins = TrainingRecord & { employee?: Employee; course?: Course }

function statusLabel(status: ReturnType<typeof getExpirationStatus>) {
  const map: Record<string, string> = {
    expired: 'Expired', expiring_30: 'Expiring <30d', expiring_60: 'Expiring <60d',
    valid: 'Valid', never: 'Never Expires',
  }
  return map[status] ?? status
}

function daysLabel(dateStr: string | null) {
  if (!dateStr) return '—'
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0)  return `${Math.abs(diff)}d overdue`
  if (diff === 0) return 'Today'
  return `${diff}d remaining`
}

// ── Multi-select picker ───────────────────────────────────────────────────────
function MultiPicker({
  options, selected, onChange, noun, noun_plural,
}: {
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
  noun: string
  noun_plural: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const allSelected = selected.length === 0
  const label = allSelected
    ? `All ${options.length} ${noun_plural}`
    : selected.length === 1
    ? options.find(o => o.id === selected[0])?.label ?? '1 selected'
    : `${selected.length} ${noun_plural} selected`

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 transition-colors text-left"
      >
        <span className={`truncate ${allSelected ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {!allSelected && (
        <button type="button" onClick={() => onChange([])} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${noun_plural}…`}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left ${allSelected ? 'font-semibold text-black' : 'text-gray-700'}`}
            >
              {allSelected ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <span className="w-3.5" />}
              All {options.length} {noun_plural}
            </button>
            {filtered.map(opt => (
              <label key={opt.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt.id)} onChange={() => toggle(opt.id)} className="accent-black w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate">{opt.label}</span>
              </label>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-400 px-3 py-4 text-center">No matches</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Export helpers ────────────────────────────────────────────────────────────
function exportExcel(title: string, headers: string[], rows: string[][], filename: string, agencyName: string) {
  const today = new Date().toLocaleDateString('en-US', { dateStyle: 'full' })
  const meta = [[agencyName], [title], [`Generated: ${today}`], [], headers]
  const ws = XLSX.utils.aoa_to_sheet([...meta, ...rows])
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

async function exportPDF(title: string, headers: string[], rows: string[][], filename: string, agencyName: string) {
  const { default: jsPDF }     = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const landscape = headers.length > 6
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait' })
  const today = new Date().toLocaleDateString('en-US', { dateStyle: 'full' })
  doc.setFontSize(18); doc.setFont('helvetica', 'bold')
  doc.text(agencyName, 14, 18)
  doc.setFontSize(13); doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 27)
  doc.setFontSize(9); doc.setTextColor(120)
  doc.text(`Generated: ${today}`, 14, 34)
  doc.setTextColor(0)
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14 },
  })
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(150)
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' })
  }
  doc.save(`${filename}.pdf`)
}

// ── Filter checkbox row ───────────────────────────────────────────────────────
function FilterToggle({
  label, subtext, checked, onChange, children,
}: {
  label: string
  subtext?: string
  checked: boolean
  onChange: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-xl border transition-colors ${checked ? 'border-black/20 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <label className="flex items-start gap-3 p-4 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="accent-black w-4 h-4 mt-0.5 flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
        </div>
      </label>
      {checked && children && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const supabase = createClient()
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [agency, setAgency]       = useState<Agency | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [courses, setCourses]     = useState<Course[]>([])
  const [records, setRecords]     = useState<RecordWithJoins[]>([])

  // Navigation
  const [step, setStep]         = useState<'select' | 'configure'>('select')
  const [reportType, setReportType] = useState<ReportType>('compliance_summary')
  const [hasRun, setHasRun]     = useState(false)

  // Filter toggles
  const [filterByEmp,    setFilterByEmp]    = useState(false)
  const [filterByCourse, setFilterByCourse] = useState(false)
  const [filterByDate,   setFilterByDate]   = useState(false)

  // Filter values
  const [selectedEmps,    setSelectedEmps]    = useState<string[]>([])
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  // Report-specific options
  const [selectedYear,     setSelectedYear]     = useState<number | null>(null)
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'non_compliant'>('all')
  const [certStatusFilter, setCertStatusFilter] = useState<'all' | 'valid' | 'expiring' | 'expired'>('all')
  const [expiringDays,     setExpiringDays]     = useState<30 | 60 | 90 | 180>(60)
  const [transcriptEmpId,  setTranscriptEmpId]  = useState('')

  // Custom report builder
  const [customColumns,  setCustomColumns]  = useState<Set<string>>(new Set(DEFAULT_CUSTOM_COLUMNS))
  const [customScope,    setCustomScope]    = useState<CustomScope>('all')
  const [customSort,     setCustomSort]     = useState<CustomSort>('emp_asc')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
      if (!profile?.agency_id) return

      const [{ data: ag }, { data: emps }, { data: crs }, { data: recs }] = await Promise.all([
        supabase.from('agencies').select('*').eq('id', profile.agency_id).single(),
        supabase.from('employees').select('*').eq('agency_id', profile.agency_id).order('name'),
        supabase.from('courses').select('*').eq('agency_id', profile.agency_id).order('name'),
        supabase.from('training_records')
          .select('*, employee:employees(*), course:courses(*)')
          .eq('agency_id', profile.agency_id)
          .order('completed_date', { ascending: false }),
      ])

      setAgency(ag)
      setEmployees(emps ?? [])
      setCourses(crs ?? [])
      setRecords(recs ?? [])
      setLoading(false)

      if (ag) {
        const earliest = (emps ?? []).map(e => e.hire_date).filter(Boolean).sort()[0] ?? null
        const opts = getSelectableYears(ag, earliest, new Date())
        if (opts.length) setSelectedYear(opts[0].value)
      }
    }
    load()
  }, [])

  const yearOptions = useMemo(() => {
    if (!agency) return []
    const earliest = employees.map(e => e.hire_date).filter(Boolean).sort()[0] ?? null
    return getSelectableYears(agency, earliest, new Date())
  }, [agency, employees])

  const isLicenseRenewal = agency?.training_period === 'license_renewal'

  function selectReport(id: ReportType) {
    setReportType(id)
    setHasRun(false)
    setFilterByEmp(false); setFilterByCourse(false); setFilterByDate(false)
    setSelectedEmps([]); setSelectedCourses([]); setDateFrom(''); setDateTo('')
    setComplianceFilter('all'); setCertStatusFilter('all')
    setTranscriptEmpId('')
    setCustomColumns(new Set(DEFAULT_CUSTOM_COLUMNS))
    setCustomScope('all')
    setCustomSort('emp_asc')
    setStep('configure')
  }

  function goBack() {
    setStep('select')
    setHasRun(false)
  }

  // Active filter values
  const activeEmps    = filterByEmp    ? selectedEmps    : []
  const activeCourses = filterByCourse ? selectedCourses : []
  const activeDateFrom = filterByDate  ? dateFrom : ''
  const activeDateTo   = filterByDate  ? dateTo   : ''

  function empFilter(id: string)    { return activeEmps.length === 0    || activeEmps.includes(id) }
  function courseFilter(id: string) { return activeCourses.length === 0 || activeCourses.includes(id) }
  function dateFilter(dateStr: string) {
    if (activeDateFrom && isBefore(parseISO(dateStr), startOfDay(parseISO(activeDateFrom)))) return false
    if (activeDateTo   && isAfter(parseISO(dateStr),  endOfDay(parseISO(activeDateTo))))     return false
    return true
  }

  // ── Report computation ──────────────────────────────────────────────────────
  const { headers, rows, reportTitle, exportFilename } = useMemo(() => {
    if (!agency) return { headers: [], rows: [], reportTitle: '', exportFilename: 'report' }
    const today = new Date()
    const requiredHours = agency.required_hours

    const empNames = activeEmps.length === 1
      ? employees.find(e => e.id === activeEmps[0])?.name ?? ''
      : activeEmps.length > 1 ? `${activeEmps.length} employees` : 'All Employees'

    const courseNames = activeCourses.length === 1
      ? courses.find(c => c.id === activeCourses[0])?.name ?? ''
      : activeCourses.length > 1 ? `${activeCourses.length} courses` : null

    const dateLabel = activeDateFrom || activeDateTo
      ? ` (${activeDateFrom ? format(parseISO(activeDateFrom), 'MMM d, yyyy') : 'start'} – ${activeDateTo ? format(parseISO(activeDateTo), 'MMM d, yyyy') : 'today'})`
      : ''

    // ── 1. Compliance Summary ─────────────────────────────────────────────────
    if (reportType === 'compliance_summary') {
      const data = employees.filter(emp => empFilter(emp.id)).map(emp => {
        const bounds = selectedYear && !isLicenseRenewal
          ? getPeriodBoundsForYear(agency, emp, selectedYear, today)
          : getPeriodBounds(agency, emp, today)

        const empRecords = records.filter(r => r.employee_id === emp.id && courseFilter(r.course_id))
        const periodRecords = empRecords.filter(r => {
          const d = parseISO(r.completed_date)
          return d >= bounds.start && d <= bounds.end && dateFilter(r.completed_date)
        })
        const hoursInPeriod = periodRecords.reduce((s, r) => s + Number(r.hours), 0)
        const compliant = isLicenseRenewal
          ? empRecords.every(r => !r.course?.expires_years || isAfter(addYears(parseISO(r.completed_date), r.course.expires_years), today))
          : hoursInPeriod >= requiredHours
        return { emp, bounds, hoursInPeriod, compliant }
      }).filter(row => {
        if (complianceFilter === 'compliant')     return row.compliant
        if (complianceFilter === 'non_compliant') return !row.compliant
        return true
      })

      const periodLabel = isLicenseRenewal ? 'License Renewal'
        : (data[0]?.bounds.label ?? (selectedYear ? String(selectedYear) : 'Current Period'))

      return {
        reportTitle: `Training Compliance Summary — ${empNames}${courseNames ? ` — ${courseNames}` : ''}${dateLabel} — ${periodLabel}`,
        exportFilename: `compliance_${selectedYear ?? 'current'}`,
        headers: ['Employee', 'Employee ID', 'Hire Date', 'Period', isLicenseRenewal ? 'Cert Status' : `Hours (req. ${requiredHours}h)`, 'Status'],
        rows: data.map(({ emp, bounds, hoursInPeriod, compliant }) => [
          emp.name, emp.employee_number ?? '—', formatDate(emp.hire_date) ?? '—',
          isLicenseRenewal ? 'License Renewal' : bounds.label,
          isLicenseRenewal ? '—' : hoursInPeriod.toFixed(1),
          compliant ? 'Compliant' : 'Non-Compliant',
        ]),
      }
    }

    // ── 2. Employee Training History ──────────────────────────────────────────
    if (reportType === 'employee_history') {
      const filtered = records.filter(r => empFilter(r.employee_id) && courseFilter(r.course_id) && dateFilter(r.completed_date))
      return {
        reportTitle: `Employee Training History — ${empNames}${courseNames ? ` — ${courseNames}` : ''}${dateLabel}`,
        exportFilename: `employee_history`,
        headers: ['Employee', 'Employee ID', 'Course', 'Completed Date', 'Hours', 'Expiration Date', 'Status'],
        rows: filtered.map(r => {
          const expDate = getExpirationDate(r.completed_date, r.course?.expires_years ?? null)
          return [r.employee?.name ?? '—', r.employee?.employee_number ?? '—', r.course?.name ?? '—',
            formatDate(r.completed_date) ?? '—', String(r.hours),
            expDate ? (formatDate(expDate) ?? '—') : 'Never expires',
            statusLabel(getExpirationStatus(r.completed_date, r.course?.expires_years ?? null))]
        }),
      }
    }

    // ── 3. Certification Status ───────────────────────────────────────────────
    if (reportType === 'certification_status') {
      const latestRecord = new Map<string, RecordWithJoins>()
      records.filter(r => empFilter(r.employee_id) && courseFilter(r.course_id)).forEach(r => {
        const key = `${r.employee_id}|${r.course_id}`
        if (!latestRecord.has(key)) latestRecord.set(key, r)
      })
      const filteredEmps    = employees.filter(emp => empFilter(emp.id))
      const filteredCourses = activeCourses.length > 0 ? courses.filter(c => activeCourses.includes(c.id)) : courses

      type CertRow = { emp: Employee; course: Course; record: RecordWithJoins | null }
      const matrix: CertRow[] = activeCourses.length > 0
        ? filteredCourses.flatMap(course => filteredEmps.map(emp => ({ emp, course, record: latestRecord.get(`${emp.id}|${course.id}`) ?? null })))
        : Array.from(latestRecord.values()).map(r => ({
            emp: employees.find(e => e.id === r.employee_id)!,
            course: courses.find(c => c.id === r.course_id)!,
            record: r,
          })).filter(row => row.emp && row.course)

      const filtered = matrix.filter(({ record }) => {
        if (!record) { return certStatusFilter !== 'valid' && certStatusFilter !== 'expiring' }
        if (!dateFilter(record.completed_date)) return false
        const s = getExpirationStatus(record.completed_date, record.course?.expires_years ?? null)
        if (certStatusFilter === 'valid')    return s === 'valid' || s === 'never'
        if (certStatusFilter === 'expiring') return s === 'expiring_30' || s === 'expiring_60'
        if (certStatusFilter === 'expired')  return s === 'expired'
        return true
      }).sort((a, b) => {
        const n = a.emp.name.localeCompare(b.emp.name)
        return n !== 0 ? n : a.course.name.localeCompare(b.course.name)
      })

      return {
        reportTitle: `Certification Status — ${empNames}${courseNames ? ` — ${courseNames}` : ''}`,
        exportFilename: `certification_status`,
        headers: ['Employee', 'Employee ID', 'Course', 'Last Completed', 'Expiration Date', 'Time Remaining', 'Status'],
        rows: filtered.map(({ emp, course, record }) => {
          if (!record) return [emp.name, emp.employee_number ?? '—', course.name, '—', '—', '—', 'Never Completed']
          const expDate = getExpirationDate(record.completed_date, record.course?.expires_years ?? null)
          return [emp.name, emp.employee_number ?? '—', course.name,
            formatDate(record.completed_date) ?? '—',
            expDate ? (formatDate(expDate) ?? '—') : 'Never expires',
            expDate ? daysLabel(expDate) : '—',
            statusLabel(getExpirationStatus(record.completed_date, record.course?.expires_years ?? null))]
        }),
      }
    }

    // ── 4. Full Training Log ──────────────────────────────────────────────────
    if (reportType === 'training_log') {
      const filtered = records.filter(r => empFilter(r.employee_id) && courseFilter(r.course_id) && dateFilter(r.completed_date))
      return {
        reportTitle: `Training Log — ${empNames}${courseNames ? ` — ${courseNames}` : ''}${dateLabel}`,
        exportFilename: `training_log`,
        headers: ['Employee', 'Employee ID', 'Course', 'Completed Date', 'Hours', 'Expiration Date', 'Status', 'Certificate'],
        rows: filtered.map(r => {
          const expDate = getExpirationDate(r.completed_date, r.course?.expires_years ?? null)
          return [r.employee?.name ?? '—', r.employee?.employee_number ?? '—', r.course?.name ?? '—',
            formatDate(r.completed_date) ?? '—', String(r.hours),
            expDate ? (formatDate(expDate) ?? '—') : 'Never expires',
            statusLabel(getExpirationStatus(r.completed_date, r.course?.expires_years ?? null)),
            r.certificate_url ? 'Yes' : 'No']
        }),
      }
    }

    // ── 5. Expiring Within X Days ─────────────────────────────────────────────
    if (reportType === 'expiring_window') {
      const latestRecord = new Map<string, RecordWithJoins>()
      records.filter(r => empFilter(r.employee_id) && courseFilter(r.course_id)).forEach(r => {
        if (!r.course?.expires_years) return
        const key = `${r.employee_id}|${r.course_id}`
        if (!latestRecord.has(key)) latestRecord.set(key, r)
      })
      const enriched = Array.from(latestRecord.values()).map(r => {
        const expDate  = addYears(parseISO(r.completed_date), r.course!.expires_years!)
        const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / 86400000)
        return { r, expDate, daysLeft }
      }).filter(({ daysLeft }) => daysLeft <= expiringDays).sort((a, b) => a.daysLeft - b.daysLeft)

      return {
        reportTitle: `Expiring Within ${expiringDays} Days — ${empNames}${courseNames ? ` — ${courseNames}` : ''}`,
        exportFilename: `expiring_${expiringDays}d`,
        headers: ['Employee', 'Employee ID', 'Course', 'Last Completed', 'Expiration Date', 'Days Remaining', 'Status'],
        rows: enriched.map(({ r, expDate, daysLeft }) => [
          r.employee?.name ?? '—', r.employee?.employee_number ?? '—', r.course?.name ?? '—',
          formatDate(r.completed_date) ?? '—',
          formatDate(expDate.toISOString().split('T')[0]) ?? '—',
          daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d remaining`,
          statusLabel(getExpirationStatus(r.completed_date, r.course?.expires_years ?? null)),
        ]),
      }
    }

    // ── 6. Training Gap Report ────────────────────────────────────────────────
    if (reportType === 'gap_report') {
      const filteredEmps    = employees.filter(emp => empFilter(emp.id))
      const filteredCourses = activeCourses.length > 0 ? courses.filter(c => activeCourses.includes(c.id)) : courses
      const hasRecord = new Set<string>()
      records.forEach(r => hasRecord.add(`${r.employee_id}|${r.course_id}`))
      const gapRows: { emp: Employee; course: Course }[] = []
      for (const course of filteredCourses)
        for (const emp of filteredEmps)
          if (!hasRecord.has(`${emp.id}|${course.id}`)) gapRows.push({ emp, course })
      gapRows.sort((a, b) => { const n = a.emp.name.localeCompare(b.emp.name); return n !== 0 ? n : a.course.name.localeCompare(b.course.name) })

      return {
        reportTitle: `Training Gap Report — ${empNames}${courseNames ? ` — ${courseNames}` : ''}`,
        exportFilename: `gap_report`,
        headers: ['Employee', 'Employee ID', 'Course', 'Status'],
        rows: gapRows.map(({ emp, course }) => [emp.name, emp.employee_number ?? '—', course.name, 'Never Completed']),
      }
    }

    // ── 7. Employee Transcript ────────────────────────────────────────────────
    if (reportType === 'employee_transcript') {
      if (!transcriptEmpId) return { headers: [], rows: [], reportTitle: 'Employee Transcript', exportFilename: 'transcript' }
      const emp = employees.find(e => e.id === transcriptEmpId)
      if (!emp) return { headers: [], rows: [], reportTitle: 'Employee Transcript', exportFilename: 'transcript' }
      const filtered = records.filter(r => r.employee_id === transcriptEmpId && dateFilter(r.completed_date))
        .sort((a, b) => { const n = (a.course?.name ?? '').localeCompare(b.course?.name ?? ''); return n !== 0 ? n : b.completed_date.localeCompare(a.completed_date) })
      return {
        reportTitle: `Employee Transcript — ${emp.name}${emp.employee_number ? ` (${emp.employee_number})` : ''}${dateLabel}`,
        exportFilename: `transcript_${emp.name.replace(/\W+/g, '_')}`,
        headers: ['Course', 'Completed Date', 'Hours', 'Expiration Date', 'Time Remaining', 'Status', 'Certificate'],
        rows: filtered.map(r => {
          const expDate = getExpirationDate(r.completed_date, r.course?.expires_years ?? null)
          return [r.course?.name ?? '—', formatDate(r.completed_date) ?? '—', String(r.hours),
            expDate ? (formatDate(expDate) ?? '—') : 'Never expires',
            expDate ? daysLabel(expDate) : '—',
            statusLabel(getExpirationStatus(r.completed_date, r.course?.expires_years ?? null)),
            r.certificate_url ? 'Yes' : 'No']
        }),
      }
    }

    // ── 8. Custom Report ──────────────────────────────────────────────────────
    if (reportType === 'custom_report') {
      // 1. Scope filter
      let scoped = records.filter(r => empFilter(r.employee_id) && courseFilter(r.course_id) && dateFilter(r.completed_date))

      if (customScope === 'latest_per_combo') {
        const seen = new Map<string, RecordWithJoins>()
        scoped.forEach(r => { const k = `${r.employee_id}|${r.course_id}`; if (!seen.has(k)) seen.set(k, r) })
        scoped = Array.from(seen.values())
      } else if (customScope === 'with_cert') {
        scoped = scoped.filter(r => r.certificate_url)
      } else if (customScope === 'expired_expiring') {
        scoped = scoped.filter(r => {
          const s = getExpirationStatus(r.completed_date, r.course?.expires_years ?? null)
          return s === 'expired' || s === 'expiring_30' || s === 'expiring_60'
        })
      }

      // 2. Sort
      scoped = [...scoped].sort((a, b) => {
        if (customSort === 'emp_asc')      return (a.employee?.name ?? '').localeCompare(b.employee?.name ?? '')
        if (customSort === 'emp_desc')     return (b.employee?.name ?? '').localeCompare(a.employee?.name ?? '')
        if (customSort === 'date_desc')    return b.completed_date.localeCompare(a.completed_date)
        if (customSort === 'date_asc')     return a.completed_date.localeCompare(b.completed_date)
        if (customSort === 'course_asc')   return (a.course?.name ?? '').localeCompare(b.course?.name ?? '')
        if (customSort === 'status') {
          const order = { expired: 0, expiring_30: 1, expiring_60: 2, valid: 3, never: 4 }
          const sa = getExpirationStatus(a.completed_date, a.course?.expires_years ?? null)
          const sb = getExpirationStatus(b.completed_date, b.course?.expires_years ?? null)
          return (order[sa] ?? 5) - (order[sb] ?? 5)
        }
        if (customSort === 'exp_date_asc') {
          const ea = a.course?.expires_years ? addYears(parseISO(a.completed_date), a.course.expires_years).getTime() : Infinity
          const eb = b.course?.expires_years ? addYears(parseISO(b.completed_date), b.course.expires_years).getTime() : Infinity
          return ea - eb
        }
        return 0
      })

      // 3. Build headers + rows from selected columns (in definition order)
      const cols = CUSTOM_COLUMN_DEFS.filter(c => customColumns.has(c.id))
      const hdrs = cols.map(c => c.label)
      const tableRows = scoped.map(r => {
        const expDate = getExpirationDate(r.completed_date, r.course?.expires_years ?? null)
        const status  = getExpirationStatus(r.completed_date, r.course?.expires_years ?? null)
        return cols.map(c => {
          switch (c.id) {
            case 'emp_name':       return r.employee?.name ?? '—'
            case 'emp_number':     return r.employee?.employee_number ?? '—'
            case 'emp_hire_date':  return formatDate(r.employee?.hire_date ?? null) ?? '—'
            case 'emp_type':       return r.employee?.employee_type === 'admin' ? 'Admin' : 'Staff'
            case 'course_name':    return r.course?.name ?? '—'
            case 'course_hrs':     return r.course ? `${r.course.credit_hours}h` : '—'
            case 'course_expiry':  return r.course?.expires_years == null ? 'Never expires' : r.course.expires_years === 0.5 ? '6 months' : `${r.course.expires_years} year${r.course.expires_years !== 1 ? 's' : ''}`
            case 'completed_date': return formatDate(r.completed_date) ?? '—'
            case 'hours_earned':   return `${r.hours}h`
            case 'exp_date':       return expDate ? (formatDate(expDate) ?? '—') : 'Never expires'
            case 'days_remaining': return expDate ? daysLabel(expDate) : '—'
            case 'status':         return statusLabel(status)
            case 'has_cert':       return r.certificate_url ? 'Yes' : 'No'
            default:               return '—'
          }
        })
      })

      const scopeLabel = customScope === 'all' ? '' : customScope === 'latest_per_combo' ? ' (latest only)' : customScope === 'with_cert' ? ' (with certificate)' : ' (expired/expiring)'
      return {
        reportTitle: `Custom Report — ${empNames}${courseNames ? ` — ${courseNames}` : ''}${dateLabel}${scopeLabel}`,
        exportFilename: `custom_report`,
        headers: hdrs,
        rows: tableRows,
      }
    }

    return { headers: [], rows: [], reportTitle: '', exportFilename: 'report' }
  }, [reportType, agency, employees, courses, records,
      activeEmps, activeCourses, activeDateFrom, activeDateTo,
      selectedYear, complianceFilter, certStatusFilter, expiringDays, transcriptEmpId,
      customColumns, customScope, customSort])

  async function handleExport(fmt: 'excel' | 'pdf') {
    if (!agency || !rows.length) return
    setExporting(fmt)
    try {
      if (fmt === 'excel') exportExcel(reportTitle, headers, rows, exportFilename, agency.name)
      else await exportPDF(reportTitle, headers, rows, exportFilename, agency.name)
    } finally { setExporting(null) }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    )
  }

  const employeeOptions = employees.map(e => ({ id: e.id, label: e.name + (e.employee_number ? ` (${e.employee_number})` : '') }))
  const courseOptions   = courses.map(c => ({ id: c.id, label: c.name }))

  // ── Step 1: Report selection ─────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">
            Choose a report type to get started. You'll configure filters on the next screen.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_TYPES.map(({ id, label, icon: Icon, iconColor, iconBg, category, categoryColor, description, hint }) => (
            <button
              key={id}
              onClick={() => selectReport(id)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left hover:shadow-md hover:border-gray-300 transition-all group flex flex-col"
            >
              <div className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center mb-4 flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${categoryColor}`}>
                  {category}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1.5 leading-snug">{label}</h3>
              <p className="text-xs text-gray-500 leading-relaxed flex-1">{description}</p>
              {hint && (
                <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100 italic">{hint}</p>
              )}
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-black transition-colors">
                <span>Configure &amp; run</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 2: Configure + Run ──────────────────────────────────────────────────
  const currentReport = REPORT_TYPES.find(r => r.id === reportType)!
  const isCustom = reportType === 'custom_report'
  const showEmpToggle    = !isCustom && reportType !== 'employee_transcript'
  const showCourseToggle = !isCustom && reportType !== 'compliance_summary' && reportType !== 'employee_transcript'
  const showDateToggle   = !isCustom && reportType !== 'expiring_window' && reportType !== 'gap_report'

  function toggleCustomCol(id: string) {
    const def = CUSTOM_COLUMN_DEFS.find(c => c.id === id)
    if (def?.required) return
    setCustomColumns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const customColumnGroups = (['Employee', 'Course', 'Training Record'] as const).map(group => ({
    group,
    cols: CUSTOM_COLUMN_DEFS.filter(c => c.group === group),
  }))

  function statusColor(cell: string) {
    if (['Compliant', 'Valid', 'Never Expires'].includes(cell))         return 'text-green-700 font-medium'
    if (['Expired', 'Non-Compliant', 'Never Completed'].includes(cell)) return 'text-red-600 font-medium'
    if (cell.includes('Expiring') || cell.includes('overdue'))          return 'text-yellow-600 font-medium'
    return ''
  }

  const skeletonWidths = [72, 55, 85, 60, 40, 70, 50, 80]

  return (
    <div className="p-8 max-w-5xl">

      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          All Reports
        </button>

        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 ${currentReport.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <currentReport.icon className={`w-6 h-6 ${currentReport.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{currentReport.label}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${currentReport.categoryColor}`}>
                {currentReport.category}
              </span>
            </div>
            <p className="text-gray-500 text-sm">{currentReport.description}</p>
          </div>
        </div>
      </div>

      {/* ── Custom report builder ── */}
      {isCustom && (
        <div className="space-y-4 mb-4">

          {/* Column picker */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Choose Columns</h2>
                <p className="text-xs text-gray-400 mt-0.5">Select which fields to include. Name and Course are always included.</p>
              </div>
              <span className="text-xs text-gray-400">{customColumns.size} selected</span>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
              {customColumnGroups.map(({ group, cols }) => (
                <div key={group}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">{group}</p>
                  <div className="space-y-2">
                    {cols.map(col => (
                      <label
                        key={col.id}
                        className={`flex items-center gap-2.5 cursor-pointer group ${col.required ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={customColumns.has(col.id)}
                          onChange={() => toggleCustomCol(col.id)}
                          disabled={col.required}
                          className="accent-black w-4 h-4 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-black transition-colors">
                          {col.label}
                          {col.required && <span className="text-gray-400 text-xs ml-1">(required)</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Record scope */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Which Records</h2>
              <p className="text-xs text-gray-400 mt-0.5">Choose which training records to pull in.</p>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { value: 'all',             label: 'All records',                         sub: 'Every training completion in the system' },
                { value: 'latest_per_combo', label: 'Most recent per employee + course',  sub: 'One row per employee/course combination — latest only' },
                { value: 'with_cert',        label: 'Records with a certificate on file', sub: 'Only completions that have an uploaded certificate' },
                { value: 'expired_expiring', label: 'Expired or expiring certifications', sub: 'Only records where the cert has expired or is expiring soon' },
              ] as { value: CustomScope; label: string; sub: string }[]).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${customScope === opt.value ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name="customScope"
                    value={opt.value}
                    checked={customScope === opt.value}
                    onChange={() => setCustomScope(opt.value)}
                    className="accent-black mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Filters + sort */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Filters &amp; Sort</h2>
            </div>
            <div className="p-6 space-y-3">
              <FilterToggle
                label="Filter by specific employee(s)"
                subtext="Leave unchecked to include all employees"
                checked={filterByEmp}
                onChange={v => { setFilterByEmp(v); if (!v) setSelectedEmps([]) }}
              >
                <MultiPicker options={employeeOptions} selected={selectedEmps} onChange={setSelectedEmps} noun="employee" noun_plural="employees" />
              </FilterToggle>
              <FilterToggle
                label="Filter by specific course(s)"
                subtext="Leave unchecked to include all courses"
                checked={filterByCourse}
                onChange={v => { setFilterByCourse(v); if (!v) setSelectedCourses([]) }}
              >
                <MultiPicker options={courseOptions} selected={selectedCourses} onChange={setSelectedCourses} noun="course" noun_plural="courses" />
              </FilterToggle>
              <FilterToggle
                label="Filter by date range"
                subtext="Filter records by their completion date"
                checked={filterByDate}
                onChange={v => { setFilterByDate(v); if (!v) { setDateFrom(''); setDateTo('') } }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 font-medium">From</p>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 font-medium">To</p>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black" />
                  </div>
                </div>
              </FilterToggle>
              <div className="rounded-xl border border-gray-200 p-4">
                <label className="block text-sm font-medium text-gray-800 mb-2">Sort results by</label>
                <select
                  value={customSort}
                  onChange={e => setCustomSort(e.target.value as CustomSort)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black"
                >
                  <option value="emp_asc">Employee name (A → Z)</option>
                  <option value="emp_desc">Employee name (Z → A)</option>
                  <option value="date_desc">Completion date (newest first)</option>
                  <option value="date_asc">Completion date (oldest first)</option>
                  <option value="course_asc">Course name (A → Z)</option>
                  <option value="exp_date_asc">Expiration date (soonest first)</option>
                  <option value="status">Status (expired → valid)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter configuration (standard reports) ── */}
      {!isCustom && (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Configure Filters</h2>
          <p className="text-xs text-gray-400 mt-0.5">Check each filter you want to apply — leave unchecked to include all.</p>
        </div>
        <div className="p-6 space-y-3">

          {/* Transcript: required single employee */}
          {reportType === 'employee_transcript' && (
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-800 mb-2">Employee <span className="text-red-500">*</span></p>
              <select
                value={transcriptEmpId}
                onChange={e => setTranscriptEmpId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black"
              >
                <option value="">Select an employee…</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}{emp.employee_number ? ` (${emp.employee_number})` : ''}
                  </option>
                ))}
              </select>
              {!transcriptEmpId && (
                <p className="text-xs text-amber-600 mt-1.5">An employee is required to generate this report.</p>
              )}
            </div>
          )}

          {/* Employee toggle */}
          {showEmpToggle && (
            <FilterToggle
              label="Filter by specific employee(s)"
              subtext="Leave unchecked to include all employees"
              checked={filterByEmp}
              onChange={v => { setFilterByEmp(v); if (!v) setSelectedEmps([]) }}
            >
              <MultiPicker options={employeeOptions} selected={selectedEmps} onChange={setSelectedEmps} noun="employee" noun_plural="employees" />
            </FilterToggle>
          )}

          {/* Course toggle */}
          {showCourseToggle && (
            <FilterToggle
              label="Filter by specific course(s)"
              subtext={
                reportType === 'certification_status'
                  ? 'When selected, all employees shown — including those who never completed the course'
                  : reportType === 'gap_report'
                  ? 'Select course(s) to see who is missing them'
                  : 'Leave unchecked to include all courses'
              }
              checked={filterByCourse}
              onChange={v => { setFilterByCourse(v); if (!v) setSelectedCourses([]) }}
            >
              <MultiPicker options={courseOptions} selected={selectedCourses} onChange={setSelectedCourses} noun="course" noun_plural="courses" />
            </FilterToggle>
          )}

          {/* Date range toggle */}
          {showDateToggle && (
            <FilterToggle
              label="Filter by date range"
              subtext="Filter records by their completion date"
              checked={filterByDate}
              onChange={v => { setFilterByDate(v); if (!v) { setDateFrom(''); setDateTo('') } }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium">From</p>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1 font-medium">To</p>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black" />
                </div>
              </div>
            </FilterToggle>
          )}

          {/* Report-specific options */}
          {(reportType === 'compliance_summary' || reportType === 'certification_status' || reportType === 'expiring_window') && (
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-800">Report Options</p>

              {reportType === 'compliance_summary' && !isLicenseRenewal && yearOptions.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1">{periodTypeName(agency!.training_period)} Period</label>
                  <select value={selectedYear ?? ''} onChange={e => setSelectedYear(Number(e.target.value))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black">
                    {yearOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}

              {reportType === 'compliance_summary' && (
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1">Show employees</label>
                  <select value={complianceFilter} onChange={e => setComplianceFilter(e.target.value as any)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black">
                    <option value="all">All employees</option>
                    <option value="compliant">Compliant only</option>
                    <option value="non_compliant">Non-compliant only</option>
                  </select>
                </div>
              )}

              {reportType === 'certification_status' && (
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1">Show certifications</label>
                  <select value={certStatusFilter} onChange={e => setCertStatusFilter(e.target.value as any)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black">
                    <option value="all">All statuses</option>
                    <option value="valid">Valid / Never expires</option>
                    <option value="expiring">Expiring soon</option>
                    <option value="expired">Expired / Never completed</option>
                  </select>
                </div>
              )}

              {reportType === 'expiring_window' && (
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1">Show certs expiring within</label>
                  <select value={expiringDays} onChange={e => setExpiringDays(Number(e.target.value) as any)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black">
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>180 days (6 months)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1.5">Already-expired certifications are included in results.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Run button ── */}
      <button
        onClick={() => setHasRun(true)}
        disabled={(reportType === 'employee_transcript' && !transcriptEmpId) || (isCustom && customColumns.size === 0)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-black text-white rounded-xl font-semibold text-sm hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-6"
      >
        <Play className="w-4 h-4" />
        Run Report
      </button>

      {/* ── Preview area ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">
              {hasRun ? reportTitle || currentReport.label : 'Report Preview'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {hasRun
                ? `${rows.length} row${rows.length !== 1 ? 's' : ''} · ${agency?.name} · ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`
                : 'Configure filters above and click Run Report to generate results'}
            </p>
          </div>

          {/* Export — only after running */}
          {hasRun && rows.length > 0 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleExport('excel')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                PDF
              </button>
            </div>
          )}
        </div>

        {/* Before run: skeleton showing column structure */}
        {!hasRun && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {headers.length > 0
                    ? headers.map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">
                          {h}
                        </th>
                      ))
                    : ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5'].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-200 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">
                          {h}
                        </th>
                      ))
                  }
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[0, 1, 2, 3, 4].map(ri => (
                  <tr key={ri}>
                    {(headers.length > 0 ? headers : Array(5).fill('')).map((_, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <div
                          className="h-3 bg-gray-100 rounded animate-pulse"
                          style={{ width: `${skeletonWidths[(ri * 3 + ci) % skeletonWidths.length]}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4 text-center border-t border-gray-50">
              <p className="text-xs text-gray-300">Results will appear here after you click Run Report</p>
            </div>
          </div>
        )}

        {/* After run: real data */}
        {hasRun && rows.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <currentReport.icon className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No data matches these filters</p>
            <p className="text-xs mt-1 text-gray-300">
              {reportType === 'employee_transcript' && !transcriptEmpId
                ? 'Select an employee above'
                : 'Try adjusting your filters and running again'}
            </p>
          </div>
        )}

        {hasRun && rows.length > 0 && (
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-gray-50/60 transition-colors">
                    {row.map((cell, ci) => {
                      const isStatusCol = headers[ci] === 'Status' || headers[ci] === 'Days Remaining'
                      return (
                        <td key={ci} className={`px-4 py-2.5 text-gray-700 whitespace-nowrap text-xs ${isStatusCol ? statusColor(cell) : ''}`}>
                          {cell}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
