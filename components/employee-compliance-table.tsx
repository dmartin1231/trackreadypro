'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Users, CalendarClock, AlertTriangle, ChevronRight,
  ShieldCheck, User, Search, X, CalendarPlus, BookMarked,
  Check, Loader2, ClipboardList, Upload, ImageIcon,
} from 'lucide-react'
import type { TrainingPeriod } from '@/lib/training-period'
import type { Course } from '@/lib/types'

type EmployeeRow = {
  emp: { id: string; name: string; employee_number: string | null }
  hours: number
  percent: number
  compliant: boolean
  empAssignments: { overdue: number; dueSoon: Array<{ name: string; daysLeft: number }> }
  expiring: number
  periodLabel: string
  employeeType: 'employee' | 'admin'
}

type StatusFilter = 'all' | 'compliant' | 'non_compliant' | 'assignments_due' | 'all_clear'
type TypeFilter = 'all' | 'employee' | 'admin'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',             label: 'All' },
  { key: 'compliant',       label: 'Compliant' },
  { key: 'non_compliant',   label: 'Non-Compliant' },
  { key: 'assignments_due', label: 'Assignments Due' },
  { key: 'all_clear',       label: 'All Clear' },
]

const TYPE_FILTERS: { key: TypeFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all',      label: 'Everyone', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'employee', label: 'Staff',    icon: <User className="w-3.5 h-3.5" /> },
  { key: 'admin',    label: 'Admins',   icon: <ShieldCheck className="w-3.5 h-3.5" /> },
]

function matchesStatus(r: EmployeeRow, f: StatusFilter) {
  const hasPending = r.empAssignments.overdue > 0 || r.empAssignments.dueSoon.length > 0
  switch (f) {
    case 'compliant':       return r.compliant
    case 'non_compliant':   return !r.compliant
    case 'assignments_due': return hasPending
    case 'all_clear':       return r.compliant && !hasPending && r.expiring === 0
    default:                return true
  }
}

// ── Modal shell ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function EmployeeComplianceTable({
  rows,
  requiredHours,
  trainingPeriod,
  isLicenseRenewal,
  courses,
  agencyId,
}: {
  rows: EmployeeRow[]
  requiredHours: number
  trainingPeriod?: TrainingPeriod
  isLicenseRenewal?: boolean
  courses: Course[]
  agencyId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all')

  // ── Assign modal ──────────────────────────────────────────────────────────
  const [showAssign, setShowAssign]   = useState(false)
  const [assignEmpId, setAssignEmpId] = useState('')
  const [assignCourseId, setAssignCourseId] = useState('')
  const [assignDue, setAssignDue]     = useState('')
  const [assignNotes, setAssignNotes] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignDone, setAssignDone]   = useState(false)

  function openAssign(empId = '') {
    setAssignEmpId(empId)
    setAssignCourseId('')
    setAssignDue('')
    setAssignNotes('')
    setAssignError(null)
    setAssignDone(false)
    setShowAssign(true)
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    setAssignSaving(true)
    setAssignError(null)
    const { error } = await supabase.from('training_assignments').insert({
      agency_id: agencyId,
      employee_id: assignEmpId,
      course_id: assignCourseId,
      assigned_date: new Date().toISOString().split('T')[0],
      due_date: assignDue,
      notes: assignNotes.trim() || null,
    })
    setAssignSaving(false)
    if (error) { setAssignError(error.message); return }
    setAssignDone(true)
    router.refresh()
    setTimeout(() => setShowAssign(false), 1200)
  }

  // ── Log training modal ───────────────────────────────────────────────────
  const [showLog, setShowLog]         = useState(false)
  const [logEmpId, setLogEmpId]       = useState('')
  const [logCourseId, setLogCourseId] = useState('')
  const [logDate, setLogDate]         = useState(new Date().toISOString().split('T')[0])
  const [logHours, setLogHours]       = useState('1')
  const [logCertFile, setLogCertFile] = useState<File | null>(null)
  const [logSaving, setLogSaving]     = useState(false)
  const [logError, setLogError]       = useState<string | null>(null)
  const [logDone, setLogDone]         = useState(false)

  function openLog(empId = '') {
    setLogEmpId(empId)
    setLogCourseId('')
    setLogDate(new Date().toISOString().split('T')[0])
    setLogHours('1')
    setLogCertFile(null)
    setLogError(null)
    setLogDone(false)
    setShowLog(true)
  }

  function onLogCourseChange(courseId: string) {
    setLogCourseId(courseId)
    const course = courses.find(c => c.id === courseId)
    if (course) setLogHours(String(course.credit_hours))
  }

  async function handleLog(e: React.FormEvent) {
    e.preventDefault()
    setLogSaving(true)
    setLogError(null)
    const { data: record, error } = await supabase
      .from('training_records')
      .insert({ agency_id: agencyId, employee_id: logEmpId, course_id: logCourseId, completed_date: logDate, hours: parseFloat(logHours) })
      .select().single()
    if (error) { setLogError(error.message); setLogSaving(false); return }

    if (logCertFile && record) {
      const ext = logCertFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${agencyId}/${logEmpId}/${record.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('certificates').upload(path, logCertFile)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path)
        await supabase.from('training_records').update({ certificate_url: publicUrl }).eq('id', record.id)
      }
    }

    setLogSaving(false)
    setLogDone(true)
    router.refresh()
    setTimeout(() => setShowLog(false), 1200)
  }

  // ── Add course modal ──────────────────────────────────────────────────────
  const [showCourse, setShowCourse]       = useState(false)
  const [courseName, setCourseName]       = useState('')
  const [courseHours, setCourseHours]     = useState('1')
  const [courseExpires, setCourseExpires] = useState('')
  const [courseSaving, setCourseSaving]   = useState(false)
  const [courseError, setCourseError]     = useState<string | null>(null)
  const [courseDone, setCourseDone]       = useState(false)

  function openCourse() {
    setCourseName('')
    setCourseHours('1')
    setCourseExpires('')
    setCourseError(null)
    setCourseDone(false)
    setShowCourse(true)
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault()
    setCourseSaving(true)
    setCourseError(null)
    const { error } = await supabase.from('courses').insert({
      agency_id: agencyId,
      name: courseName.trim(),
      credit_hours: parseFloat(courseHours),
      expires_years: courseExpires ? parseFloat(courseExpires) : null,
    })
    setCourseSaving(false)
    if (error) { setCourseError(error.message); return }
    setCourseDone(true)
    router.refresh()
    setTimeout(() => setShowCourse(false), 1200)
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  const hasAdmins = rows.some(r => r.employeeType === 'admin')
  const hasStaff  = rows.some(r => r.employeeType === 'employee')
  const showTypeFilter = hasAdmins && hasStaff

  const filtered = rows.filter(r => {
    if (search && !r.emp.name.toLowerCase().includes(search.toLowerCase()) &&
        !(r.emp.employee_number ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (!matchesStatus(r, statusFilter)) return false
    if (typeFilter !== 'all' && r.employeeType !== typeFilter) return false
    return true
  })

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900 flex-shrink-0">All Personnel</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openLog()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-black hover:bg-gray-900 rounded-lg transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Log Training
              </button>
              <button
                onClick={() => openAssign()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black border border-black/30 hover:border-black hover:bg-gray-100 rounded-lg transition-colors"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                Assign
              </button>
              <button
                onClick={openCourse}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:border-gray-400 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <BookMarked className="w-3.5 h-3.5" />
                Add Course
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or employee ID…"
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type filter */}
          {showTypeFilter && (
            <div className="flex gap-1.5">
              {TYPE_FILTERS.map(({ key, label, icon }) => {
                const count = key === 'all' ? rows.length : rows.filter(r => r.employeeType === key).length
                const active = typeFilter === key
                return (
                  <button key={key} onClick={() => setTypeFilter(key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      active ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-black/40 hover:text-black'
                    }`}>
                    {icon} {label}
                    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(({ key, label }) => {
              const base = rows.filter(r => typeFilter === 'all' || r.employeeType === typeFilter)
              const count = key === 'all' ? base.length : base.filter(r => matchesStatus(r, key)).length
              const active = statusFilter === key
              return (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    active ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-black/40 hover:text-black'
                  }`}>
                  {label}
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
                </button>
              )
            })}
            {!isLicenseRenewal && (
              <span className="ml-auto text-xs text-gray-400 self-center hidden sm:block">
                {requiredHours}h required · Click row to view profile
              </span>
            )}
          </div>
        </div>

        {/* ── Rows ── */}
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">
              {search ? `No employees matching "${search}"` : 'No employees match this filter'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(({ emp, hours, percent, compliant, empAssignments, expiring, periodLabel, employeeType }) => (
              <div
                key={emp.id}
                onClick={() => router.push(`/employees/${emp.id}`)}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/70 transition-colors cursor-pointer group"
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  employeeType === 'admin' ? 'bg-gray-700' : 'bg-black'
                }`}>
                  <span className="text-white text-xs font-bold">
                    {emp.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </span>
                </div>

                {/* Name + ID + type */}
                <div className="w-44 flex-shrink-0 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-gray-900 group-hover:text-black transition-colors truncate">
                      {emp.name}
                    </p>
                    {employeeType === 'admin' && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                        <ShieldCheck className="w-2.5 h-2.5" /> Admin
                      </span>
                    )}
                  </div>
                  {emp.employee_number && <p className="text-xs text-gray-400">{emp.employee_number}</p>}
                  {trainingPeriod === 'hire_date' && periodLabel && (
                    <p className="text-[10px] text-gray-300 mt-0.5 truncate">{periodLabel}</p>
                  )}
                </div>

                {/* Hours + progress */}
                {isLicenseRenewal ? (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{hours.toFixed(1)}h logged (all-time)</p>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{hours.toFixed(1)}h</span>
                      <span className="text-xs text-gray-400">/ {requiredHours}h</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${compliant ? 'bg-green-500' : percent >= 75 ? 'bg-yellow-400' : 'bg-red-400'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Badges */}
                <div className="w-44 flex-shrink-0 flex flex-wrap gap-1.5 justify-end">
                  {empAssignments.overdue > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <CalendarClock className="w-3 h-3" /> {empAssignments.overdue} overdue
                    </span>
                  )}
                  {empAssignments.dueSoon.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                      <CalendarClock className="w-3 h-3" />
                      {a.daysLeft === 0 ? 'Due today' : `Due in ${a.daysLeft}d`}
                    </span>
                  ))}
                  {expiring > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      <AlertTriangle className="w-3 h-3" /> {expiring} expiring
                    </span>
                  )}
                  {empAssignments.overdue === 0 && empAssignments.dueSoon.length === 0 && expiring === 0 && (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>

                {/* Compliance badge */}
                <div className="w-28 flex-shrink-0 flex justify-end">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isLicenseRenewal ? (compliant ? 'Certs Current' : 'Certs Expired') : (compliant ? 'Compliant' : 'Non-Compliant')}
                  </span>
                </div>

                {/* Per-row quick actions (appear on hover) */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openLog(emp.id)}
                    title="Log training"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-all"
                  >
                    <ClipboardList className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openAssign(emp.id)}
                    title="Assign training"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-all"
                  >
                    <CalendarPlus className="w-4 h-4" />
                  </button>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-black flex-shrink-0 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Log Training Modal ── */}
      {showLog && (
        <Modal title="Log Training" onClose={() => setShowLog(false)}>
          {logDone ? (
            <div className="py-8 flex flex-col items-center gap-3 text-green-600">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <p className="font-semibold text-gray-900">Training logged!</p>
            </div>
          ) : (
            <form onSubmit={handleLog} className="space-y-4">
              <Field label="Employee *">
                <select required value={logEmpId} onChange={e => setLogEmpId(e.target.value)} className="input">
                  <option value="">Select employee…</option>
                  {rows.map(r => (
                    <option key={r.emp.id} value={r.emp.id}>{r.emp.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Course *">
                <select required value={logCourseId} onChange={e => onLogCourseChange(e.target.value)} className="input">
                  <option value="">Select course…</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.credit_hours}h)</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Completion Date *">
                  <input required type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="input" />
                </Field>
                <Field label="Hours *">
                  <input required type="number" min="0.25" step="0.25" value={logHours} onChange={e => setLogHours(e.target.value)} className="input" />
                </Field>
              </div>
              <Field label="Certificate (optional)">
                {logCertFile ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                    <ImageIcon className="w-4 h-4 text-black flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate flex-1">{logCertFile.name}</span>
                    <button type="button" onClick={() => setLogCertFile(null)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-black hover:bg-gray-50/30 transition-colors">
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Click to upload image or PDF</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setLogCertFile(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </Field>
              {logError && <p className="text-red-600 text-sm">{logError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowLog(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={logSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {logSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Record'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ── Assign Training Modal ── */}
      {showAssign && (
        <Modal title="Assign Training" onClose={() => setShowAssign(false)}>
          {assignDone ? (
            <div className="py-8 flex flex-col items-center gap-3 text-green-600">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <p className="font-semibold text-gray-900">Assignment saved!</p>
            </div>
          ) : (
            <form onSubmit={handleAssign} className="space-y-4">
              <Field label="Employee *">
                <select
                  required
                  value={assignEmpId}
                  onChange={e => setAssignEmpId(e.target.value)}
                  className="input"
                >
                  <option value="">Select employee…</option>
                  {rows.map(r => (
                    <option key={r.emp.id} value={r.emp.id}>{r.emp.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Course *">
                <select
                  required
                  value={assignCourseId}
                  onChange={e => setAssignCourseId(e.target.value)}
                  className="input"
                >
                  <option value="">Select course…</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.credit_hours}h)</option>
                  ))}
                </select>
              </Field>
              <Field label="Due Date *">
                <input
                  required
                  type="date"
                  value={assignDue}
                  onChange={e => setAssignDue(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  value={assignNotes}
                  onChange={e => setAssignNotes(e.target.value)}
                  className="input resize-none"
                  rows={2}
                  placeholder="Optional…"
                />
              </Field>
              {assignError && <p className="text-red-600 text-sm">{assignError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAssign(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={assignSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {assignSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Assign Training'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ── Add Course Modal ── */}
      {showCourse && (
        <Modal title="Add Course" onClose={() => setShowCourse(false)}>
          {courseDone ? (
            <div className="py-8 flex flex-col items-center gap-3 text-green-600">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <p className="font-semibold text-gray-900">Course added!</p>
            </div>
          ) : (
            <form onSubmit={handleAddCourse} className="space-y-4">
              <Field label="Course Name *">
                <input
                  required
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="input"
                  placeholder="e.g. CPR / First Aid"
                />
              </Field>
              <Field label="Credit Hours *">
                <input
                  required
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={courseHours}
                  onChange={e => setCourseHours(e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Expiration">
                <select
                  value={courseExpires}
                  onChange={e => setCourseExpires(e.target.value)}
                  className="input"
                >
                  <option value="">Never expires</option>
                  <option value="0.5">6 months</option>
                  <option value="1">1 year</option>
                  <option value="2">2 years</option>
                  <option value="3">3 years</option>
                </select>
              </Field>
              {courseError && <p className="text-red-600 text-sm">{courseError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCourse(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={courseSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {courseSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Add Course'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  )
}
