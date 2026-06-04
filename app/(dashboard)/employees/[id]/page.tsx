'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, CalendarClock, Plus, Trash2,
  Clock, BookOpen, X, Edit2, AlertTriangle,
  ChevronDown, ChevronUp, ShieldCheck,
  ClipboardList, Check, Loader2, Upload, FileText, ImageIcon,
} from 'lucide-react'
import { formatDate, getInitials, getExpirationDate, getExpirationStatus, getStatusBadge } from '@/lib/utils'
import { differenceInDays, parseISO } from 'date-fns'
import type { Employee, Course, TrainingRecord, TrainingAssignment, Agency } from '@/lib/types'
import type { ExpirationStatus } from '@/lib/types'
import { getAllPastPeriods, type HistoricalPeriod } from '@/lib/training-period'

type RecordWithCourse = TrainingRecord & { course?: Course }

type AssignmentForm = {
  course_id: string
  assigned_date: string
  due_date: string
  notes: string
}

const emptyAssignmentForm: AssignmentForm = {
  course_id: '',
  assigned_date: new Date().toISOString().split('T')[0],
  due_date: '',
  notes: '',
}

// ── Certificate upload helper ───────────────────────────────────────────────
async function uploadCertificate(
  supabase: ReturnType<typeof createClient>,
  agencyId: string,
  employeeId: string,
  recordId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${agencyId}/${employeeId}/${recordId}.${ext}`
  const { error } = await supabase.storage
    .from('certificates')
    .upload(path, file, { upsert: true })
  if (error) { console.error('Upload error:', error.message); return null }
  const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path)
  return publicUrl
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CertThumb({
  url,
  onView,
  onUpload,
  uploading,
}: {
  url: string | null
  onView: (url: string) => void
  onUpload: (file: File) => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isPDF = url?.toLowerCase().includes('.pdf')

  return (
    <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center relative group/cert">
      {url ? (
        isPDF ? (
          <button
            onClick={() => window.open(url, '_blank')}
            className="w-full h-full flex flex-col items-center justify-center gap-0.5 hover:bg-gray-200 transition-colors"
            title="View PDF certificate"
          >
            <FileText className="w-5 h-5 text-red-400" />
            <span className="text-[9px] text-gray-400 font-medium">PDF</span>
          </button>
        ) : (
          <button onClick={() => onView(url)} className="w-full h-full" title="View certificate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Certificate" className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
          </button>
        )
      ) : (
        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors gap-0.5" title="Upload certificate">
          {uploading
            ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            : <Upload className="w-5 h-5 text-gray-400 group-hover/cert:text-black transition-colors" />}
          <span className="text-[9px] text-gray-400 font-medium">{uploading ? '…' : 'Upload'}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
          />
        </label>
      )}
    </div>
  )
}

function CertLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
      >
        <X className="w-5 h-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Certificate"
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [agencyId, setAgencyId]     = useState<string | null>(null)
  const [agency, setAgency]         = useState<Agency | null>(null)
  const [employee, setEmployee]     = useState<Employee | null>(null)
  const [courses, setCourses]       = useState<Course[]>([])
  const [records, setRecords]       = useState<RecordWithCourse[]>([])
  const [assignments, setAssignments] = useState<(TrainingAssignment & { course?: Course })[]>([])
  const [loading, setLoading]       = useState(true)

  // Certificate state
  const [viewingCert, setViewingCert]           = useState<string | null>(null)
  const [uploadingRecordId, setUploadingRecordId] = useState<string | null>(null)

  // Period progress bars
  const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set([0]))

  // Course groups — which are expanded (all start open)
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  // Assignment modal
  const [showAssignModal, setShowAssignModal]   = useState(false)
  const [assignForm, setAssignForm]             = useState<AssignmentForm>(emptyAssignmentForm)
  const [editAssignment, setEditAssignment]     = useState<TrainingAssignment | null>(null)
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState<string | null>(null)

  // Log training modal
  const [showLogModal, setShowLogModal] = useState(false)
  const [logCourseId, setLogCourseId]   = useState('')
  const [logDate, setLogDate]           = useState(new Date().toISOString().split('T')[0])
  const [logHours, setLogHours]         = useState('1')
  const [logCertFile, setLogCertFile]   = useState<File | null>(null)
  const [logSaving, setLogSaving]       = useState(false)
  const [logError, setLogError]         = useState<string | null>(null)
  const [logDone, setLogDone]           = useState(false)

  const fetchAll = useCallback(async (aid: string, empId: string) => {
    const [{ data: emp }, { data: recs }, { data: assigns }, { data: crs }, { data: ag }] = await Promise.all([
      supabase.from('employees').select('*').eq('id', empId).single(),
      supabase.from('training_records').select('*, course:courses(*)').eq('employee_id', empId).order('completed_date', { ascending: false }),
      supabase.from('training_assignments').select('*, course:courses(*)').eq('employee_id', empId).order('due_date'),
      supabase.from('courses').select('*').eq('agency_id', aid).order('name'),
      supabase.from('agencies').select('*').eq('id', aid).single(),
    ])
    setEmployee(emp)
    setRecords(recs ?? [])
    setAssignments(assigns ?? [])
    setCourses(crs ?? [])
    setAgency(ag)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
      if (profile?.agency_id) {
        setAgencyId(profile.agency_id)
        fetchAll(profile.agency_id, id)
      }
    }
    init()
  }, [id, supabase, fetchAll])

  const requiredHours = agency?.required_hours ?? 24
  const today = new Date()
  const isLicenseRenewal = agency?.training_period === 'license_renewal'

  // Period progress bars
  const periods = useMemo<HistoricalPeriod[]>(() => {
    if (!agency || !employee) return []
    return getAllPastPeriods(agency, employee, today).reverse()
  }, [agency, employee])

  const hoursPerPeriod = useMemo(() => {
    const map: Record<number, number> = {}
    periods.forEach(p => {
      map[p.yearIndex] = records
        .filter(r => { const d = parseISO(r.completed_date); return d >= p.start && d <= p.end })
        .reduce((sum, r) => sum + Number(r.hours), 0)
    })
    return map
  }, [periods, records])

  const recordsByPeriod = useMemo(() => {
    const map: Record<number, RecordWithCourse[]> = {}
    periods.forEach(p => {
      map[p.yearIndex] = records.filter(r => {
        const d = parseISO(r.completed_date)
        return d >= p.start && d <= p.end
      })
    })
    return map
  }, [periods, records])

  // Course groups — group all records by course, show all years within each group
  const courseGroups = useMemo(() => {
    const map = new Map<string, {
      courseId: string
      courseName: string
      records: RecordWithCourse[]
      latestStatus: ExpirationStatus
    }>()

    records.forEach(r => {
      const courseId = r.course_id
      const courseName = r.course?.name ?? 'Unknown Course'
      if (!map.has(courseId)) {
        map.set(courseId, { courseId, courseName, records: [], latestStatus: 'never' })
      }
      map.get(courseId)!.records.push(r)
    })

    map.forEach(group => {
      group.records.sort((a, b) => b.completed_date.localeCompare(a.completed_date))
      const latest = group.records[0]
      group.latestStatus = latest?.course
        ? getExpirationStatus(latest.completed_date, latest.course.expires_years ?? null)
        : 'never'
    })

    const statusOrder: Record<ExpirationStatus, number> = { expired: 3, expiring_30: 2, expiring_60: 1, valid: 0, never: 0 }
    return Array.from(map.values()).sort((a, b) => {
      const diff = (statusOrder[b.latestStatus] ?? 0) - (statusOrder[a.latestStatus] ?? 0)
      if (diff !== 0) return diff
      return (b.records[0]?.completed_date ?? '').localeCompare(a.records[0]?.completed_date ?? '')
    })
  }, [records])

  function toggleCourse(courseId: string) {
    setExpandedCourses(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      return next
    })
  }

  function togglePeriod(yearIndex: number) {
    setExpandedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(yearIndex)) next.delete(yearIndex)
      else next.add(yearIndex)
      return next
    })
  }

  // Certificate upload for existing records
  async function handleCertificateUpload(recordId: string, file: File) {
    if (!agencyId) return
    setUploadingRecordId(recordId)
    const url = await uploadCertificate(supabase, agencyId, id, recordId, file)
    if (url) {
      await supabase.from('training_records').update({ certificate_url: url }).eq('id', recordId)
      fetchAll(agencyId, id)
    } else {
      alert('Certificate upload failed. Make sure the "certificates" storage bucket exists in Supabase.')
    }
    setUploadingRecordId(null)
  }

  // Log training modal handlers
  function openLogModal() {
    setLogCourseId('')
    setLogDate(new Date().toISOString().split('T')[0])
    setLogHours('1')
    setLogCertFile(null)
    setLogError(null)
    setLogDone(false)
    setShowLogModal(true)
  }

  function onLogCourseChange(courseId: string) {
    setLogCourseId(courseId)
    const course = courses.find(c => c.id === courseId)
    if (course) setLogHours(String(course.credit_hours))
  }

  async function handleLogTraining(e: React.FormEvent) {
    e.preventDefault()
    if (!agencyId) return
    setLogSaving(true)
    setLogError(null)

    const { data: record, error: recErr } = await supabase
      .from('training_records')
      .insert({ agency_id: agencyId, employee_id: id, course_id: logCourseId, completed_date: logDate, hours: parseFloat(logHours) })
      .select()
      .single()

    if (recErr) { setLogError(recErr.message); setLogSaving(false); return }

    if (logCertFile && record) {
      const url = await uploadCertificate(supabase, agencyId, id, record.id, logCertFile)
      if (url) await supabase.from('training_records').update({ certificate_url: url }).eq('id', record.id)
    }

    setLogSaving(false)
    setLogDone(true)
    fetchAll(agencyId, id)
    setTimeout(() => setShowLogModal(false), 1200)
  }

  // Assignment handlers
  async function handleSaveAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!agencyId || !id) return
    setSaving(true)
    setError(null)
    const payload = { agency_id: agencyId, employee_id: id, course_id: assignForm.course_id, assigned_date: assignForm.assigned_date, due_date: assignForm.due_date, notes: assignForm.notes.trim() || null }
    let err
    if (editAssignment) {
      ;({ error: err } = await supabase.from('training_assignments').update(payload).eq('id', editAssignment.id))
    } else {
      ;({ error: err } = await supabase.from('training_assignments').insert(payload))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowAssignModal(false)
    fetchAll(agencyId, id)
  }

  async function handleDeleteAssignment(assignId: string) {
    if (!agencyId || !confirm('Delete this assignment?')) return
    await supabase.from('training_assignments').delete().eq('id', assignId)
    fetchAll(agencyId, id)
  }

  const currentPeriod = periods.find(p => p.isCurrent)
  const currentHours = currentPeriod ? (hoursPerPeriod[currentPeriod.yearIndex] ?? 0) : 0

  // For license renewal compliance, only the latest completion per course counts —
  // a renewed CPR makes the old expired one irrelevant
  const latestPerCourse = useMemo(() => {
    const map = new Map<string, RecordWithCourse>()
    records.forEach(r => { if (!map.has(r.course_id)) map.set(r.course_id, r) })
    return Array.from(map.values())
  }, [records])

  const isCompliant = isLicenseRenewal
    ? latestPerCourse.every(r => {
        if (!r.course || r.course.expires_years === null) return true
        const exp = new Date(parseISO(r.completed_date))
        exp.setFullYear(exp.getFullYear() + r.course.expires_years)
        return exp >= today
      })
    : currentHours >= requiredHours

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>
  if (!employee) return <div className="p-8 text-gray-400">Employee not found.</div>

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${employee.employee_type === 'admin' ? 'bg-gray-700' : 'bg-black'}`}>
          <span className="text-white text-xl font-bold">{getInitials(employee.name)}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
            {employee.employee_type === 'admin' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            {employee.employee_number && <span>ID: {employee.employee_number}</span>}
            {employee.hire_date && <span>Hired: {formatDate(employee.hire_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openLogModal} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors">
            <ClipboardList className="w-4 h-4" /> Log Training
          </button>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${isCompliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isLicenseRenewal ? (isCompliant ? '✓ Certs Current' : '✗ Certs Expired') : (isCompliant ? '✓ Compliant' : '✗ Non-Compliant')}
          </span>
        </div>
      </div>

      {/* Period progress bars */}
      {!isLicenseRenewal && periods.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-black" />
            <h2 className="font-semibold text-gray-900">Training Hours by Period</h2>
            <span className="ml-auto text-xs text-gray-400">{requiredHours}h required each period</span>
          </div>
          <div className="divide-y divide-gray-50">
            {periods.map((period) => {
              const hrs = hoursPerPeriod[period.yearIndex] ?? 0
              const pct = Math.min((hrs / requiredHours) * 100, 100)
              const met = hrs >= requiredHours
              const inProgress = period.isCurrent && !met
              const expanded = expandedPeriods.has(period.yearIndex)
              const periodRecords = recordsByPeriod[period.yearIndex] ?? []

              return (
                <div key={period.yearIndex}>
                  <button onClick={() => togglePeriod(period.yearIndex)} className={`w-full px-5 py-4 text-left hover:bg-gray-50/60 transition-colors ${period.isCurrent ? 'bg-gray-50/30' : ''}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-sm font-semibold ${period.isCurrent ? 'text-black' : 'text-gray-700'}`}>
                        {period.shortLabel}
                        {period.isCurrent && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-black text-white px-1.5 py-0.5 rounded">Current</span>}
                      </span>
                      <span className="text-xs text-gray-400 font-normal">{period.label.replace(`${period.shortLabel} · `, '')}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <span className={`text-xs font-semibold ${met ? 'text-green-600' : inProgress ? 'text-black' : 'text-red-500'}`}>{hrs.toFixed(1)} / {requiredHours}h</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${met ? 'bg-green-100 text-green-700' : inProgress ? 'bg-blue-50 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                          {met ? 'Met' : inProgress ? 'In Progress' : 'Not Met'}
                        </span>
                        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${met ? 'bg-green-500' : pct >= 75 ? 'bg-yellow-400' : pct >= 40 ? 'bg-orange-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100 bg-gray-50/40">
                      {periodRecords.length === 0 ? (
                        <p className="px-6 py-3 text-xs text-gray-400 italic">No training records in this period.</p>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {periodRecords.map(rec => {
                            const badge = getStatusBadge(getExpirationStatus(rec.completed_date, rec.course?.expires_years ?? null))
                            return (
                              <div key={rec.id} className="px-6 py-2.5 flex items-center gap-3">
                                {/* Mini cert indicator */}
                                <div className="w-8 h-8 rounded flex-shrink-0 bg-gray-200 flex items-center justify-center overflow-hidden">
                                  {rec.certificate_url ? (
                                    rec.certificate_url.includes('.pdf')
                                      ? <FileText className="w-4 h-4 text-red-400" />
                                      // eslint-disable-next-line @next/next/no-img-element
                                      : <img src={rec.certificate_url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setViewingCert(rec.certificate_url!)} />
                                  ) : <ImageIcon className="w-4 h-4 text-gray-300" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-800 font-medium truncate">{rec.course?.name ?? '—'}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(rec.completed_date)} · {rec.hours}h</p>
                                </div>
                                <span className={`flex-shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Training History — grouped by course */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-black" />
          <h2 className="font-semibold text-gray-900">Training History</h2>
          <span className="text-xs text-gray-400">{courseGroups.length} course{courseGroups.length !== 1 ? 's' : ''} · {records.length} total records</span>
          <button onClick={openLogModal} className="ml-auto flex items-center gap-1 text-xs font-medium text-black hover:text-gray-900 border border-black/30 hover:border-black px-2.5 py-1 rounded-lg transition">
            <Plus className="w-3 h-3" /> Log
          </button>
        </div>

        {courseGroups.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">No training records yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {courseGroups.map(group => {
              const badge = getStatusBadge(group.latestStatus)
              const isExpanded = expandedCourses.has(group.courseId)
              return (
                <div key={group.courseId}>
                  {/* Course header */}
                  <button
                    onClick={() => toggleCourse(group.courseId)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-sm text-gray-900 truncate">{group.courseName}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{group.records.length} record{group.records.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">Latest: {formatDate(group.records[0]?.completed_date)}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {/* Individual records under this course */}
                  {isExpanded && (
                    <div className="bg-gray-50/40 border-t border-gray-100 divide-y divide-gray-100">
                      {group.records.map(rec => {
                        const expDate = getExpirationDate(rec.completed_date, rec.course?.expires_years ?? null)
                        const recStatus = getExpirationStatus(rec.completed_date, rec.course?.expires_years ?? null)
                        const recBadge = getStatusBadge(recStatus)
                        return (
                          <div key={rec.id} className="px-5 py-3 flex items-center gap-4">
                            {/* Certificate thumbnail */}
                            <CertThumb
                              url={rec.certificate_url}
                              onView={setViewingCert}
                              onUpload={(file) => handleCertificateUpload(rec.id, file)}
                              uploading={uploadingRecordId === rec.id}
                            />

                            {/* Record info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900">{formatDate(rec.completed_date)}</p>
                                <span className="text-xs text-gray-400">·</span>
                                <p className="text-sm text-gray-600">{rec.hours}h</p>
                              </div>
                              {expDate ? (
                                <p className="text-xs text-gray-400 mt-0.5">Expires {formatDate(expDate)}</p>
                              ) : (
                                <p className="text-xs text-gray-300 mt-0.5">Never expires</p>
                              )}
                              {rec.certificate_url && (
                                <button
                                  onClick={() => rec.certificate_url!.includes('.pdf')
                                    ? window.open(rec.certificate_url!, '_blank')
                                    : setViewingCert(rec.certificate_url!)}
                                  className="text-xs text-black hover:underline mt-0.5"
                                >
                                  {rec.certificate_url.includes('.pdf') ? 'View PDF' : 'View certificate'}
                                </button>
                              )}
                            </div>

                            {/* Status + replace cert */}
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${recBadge.className}`}>{recBadge.label}</span>
                              {rec.certificate_url && (
                                <label className="text-[10px] text-gray-400 hover:text-black cursor-pointer transition-colors">
                                  Replace cert
                                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCertificateUpload(rec.id, f) }} />
                                </label>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Assignments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-black" />
          <h2 className="font-semibold text-gray-900">Training Assignments</h2>
          <button
            onClick={() => { setEditAssignment(null); setAssignForm(emptyAssignmentForm); setError(null); setShowAssignModal(true) }}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-black hover:text-gray-900 border border-black/30 hover:border-black px-2.5 py-1 rounded-lg transition"
          >
            <Plus className="w-3 h-3" /> Assign
          </button>
        </div>
        {assignments.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No assignments yet.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {assignments.map((a) => {
              const daysLeft = differenceInDays(parseISO(a.due_date), today)
              const isOverdue = daysLeft < 0
              const isDueSoon = !isOverdue && daysLeft <= 30
              return (
                <div key={a.id} className={`px-5 py-3 flex items-start gap-3 ${isOverdue ? 'bg-red-50/50' : isDueSoon ? 'bg-yellow-50/50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900 truncate">{(a as any).course?.name ?? '—'}</p>
                      {(isOverdue || isDueSoon) && <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${isOverdue ? 'text-red-500' : 'text-yellow-500'}`} />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Assigned {formatDate(a.assigned_date)} · Due {formatDate(a.due_date)}</p>
                    {a.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{a.notes}</p>}
                    <p className={`text-xs font-medium mt-0.5 ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditAssignment(a); setAssignForm({ course_id: a.course_id, assigned_date: a.assigned_date, due_date: a.due_date, notes: a.notes ?? '' }); setError(null); setShowAssignModal(true) }} className="text-gray-400 hover:text-black transition p-1 rounded hover:bg-gray-100">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteAssignment(a.id)} className="text-gray-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Certificate lightbox */}
      {viewingCert && <CertLightbox url={viewingCert} onClose={() => setViewingCert(null)} />}

      {/* Log Training Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Log Training — {employee.name}</h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5">
              {logDone ? (
                <div className="py-8 flex flex-col items-center gap-3 text-green-600">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><Check className="w-6 h-6" /></div>
                  <p className="font-semibold text-gray-900">Training logged!</p>
                </div>
              ) : (
                <form onSubmit={handleLogTraining} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Course *</label>
                    <select required value={logCourseId} onChange={e => onLogCourseChange(e.target.value)} className="input">
                      <option value="">Select course…</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.credit_hours}h)</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Completion Date *</label>
                      <input required type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours *</label>
                      <input required type="number" min="0.25" step="0.25" value={logHours} onChange={e => setLogHours(e.target.value)} className="input" />
                    </div>
                  </div>
                  {/* Certificate upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Certificate <span className="text-gray-400 font-normal">(optional)</span></label>
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
                  </div>
                  {logError && <p className="text-red-600 text-sm">{logError}</p>}
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setShowLogModal(false)} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" disabled={logSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                      {logSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Record'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editAssignment ? 'Edit Assignment' : 'Assign Training'}</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveAssignment} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Course *</label>
                <select required value={assignForm.course_id} onChange={e => setAssignForm({ ...assignForm, course_id: e.target.value })} className="input">
                  <option value="">Select course…</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date Assigned *</label>
                <input required type="date" value={assignForm.assigned_date} onChange={e => setAssignForm({ ...assignForm, assigned_date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date *</label>
                <input required type="date" value={assignForm.due_date} onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })} className="input" />
                <p className="text-xs text-gray-400 mt-1">A warning appears on the dashboard when due within 30 days</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea value={assignForm.notes} onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })} className="input resize-none" rows={2} placeholder="Optional notes…" />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : editAssignment ? 'Save Changes' : 'Assign Training'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
