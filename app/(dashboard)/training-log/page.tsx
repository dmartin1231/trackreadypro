'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Edit2, Trash2, BookOpen, X, Upload, ImageIcon,
  FileText, ChevronRight, Search, Users,
} from 'lucide-react'
import { formatDate, getExpirationDate, getExpirationStatus, getStatusBadge } from '@/lib/utils'
import type { Employee, Course, TrainingRecord } from '@/lib/types'
import CertUploadModal from '@/components/cert-upload-modal'
import { useUserRole } from '@/components/role-provider'

type RecordWithJoins = TrainingRecord & { employee?: Employee; course?: Course }

type RecordForm = {
  employee_id: string
  course_id: string
  completed_date: string
  hours: string
}

const emptyForm: RecordForm = { employee_id: '', course_id: '', completed_date: '', hours: '' }

export default function TrainingLogPage() {
  const supabase = createClient()
  const userRole = useUserRole()
  const isAdmin = userRole === 'admin'
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [records, setRecords] = useState<RecordWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'course' | 'employee'>('course')
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set())

  const [showModal, setShowModal] = useState(false)
  const [showCertUpload, setShowCertUpload] = useState(false)
  const [editTarget, setEditTarget] = useState<RecordWithJoins | null>(null)
  const [form, setForm] = useState<RecordForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [viewingCert, setViewingCert] = useState<string | null>(null)

  const fetchData = useCallback(async (aid: string) => {
    setLoading(true)
    const [{ data: recs }, { data: emps }, { data: crs }] = await Promise.all([
      supabase
        .from('training_records')
        .select('*, employee:employees(*), course:courses(*)')
        .eq('agency_id', aid)
        .order('completed_date', { ascending: false }),
      supabase.from('employees').select('*').eq('agency_id', aid).order('name'),
      supabase.from('courses').select('*').eq('agency_id', aid).order('name'),
    ])
    setRecords(recs ?? [])
    setEmployees(emps ?? [])
    setCourses(crs ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
      if (data?.agency_id) {
        setAgencyId(data.agency_id)
        fetchData(data.agency_id)
      }
    }
    init()
  }, [supabase, fetchData])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const empId = params.get('employee_id')
    const courseId = params.get('course_id')
    if (empId || courseId) {
      const course = courseId ? courses.find(c => c.id === courseId) : null
      setForm({
        employee_id: empId ?? '',
        course_id: courseId ?? '',
        completed_date: new Date().toISOString().split('T')[0],
        hours: course ? String(course.credit_hours) : '',
      })
      setShowModal(true)
    }
  }, [courses])

  function onCourseChange(courseId: string) {
    const course = courses.find(c => c.id === courseId)
    setForm(f => ({ ...f, course_id: courseId, hours: course ? String(course.credit_hours) : f.hours }))
  }

  function openAdd(prefill?: Partial<RecordForm>) {
    setEditTarget(null)
    setCertFile(null)
    const merged = { ...emptyForm, ...prefill }
    setForm(merged)
    if (merged.course_id) onCourseChange(merged.course_id)
    setError(null)
    setShowModal(true)
  }

  function openEdit(rec: RecordWithJoins) {
    setEditTarget(rec)
    setForm({
      employee_id: rec.employee_id,
      course_id: rec.course_id,
      completed_date: rec.completed_date,
      hours: String(rec.hours),
    })
    setError(null)
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!agencyId) return
    setSaving(true)
    setError(null)

    const payload = {
      agency_id: agencyId,
      employee_id: form.employee_id,
      course_id: form.course_id,
      completed_date: form.completed_date,
      hours: parseFloat(form.hours),
    }

    if (editTarget) {
      const { error: err } = await supabase.from('training_records').update(payload).eq('id', editTarget.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      const { data: record, error: err } = await supabase.from('training_records').insert(payload).select().single()
      if (err) { setSaving(false); setError(err.message); return }

      if (certFile && record) {
        const ext = certFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${agencyId}/${record.employee_id}/${record.id}.${ext}`
        const { error: upErr } = await supabase.storage.from('certificates').upload(path, certFile)
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path)
          await supabase.from('training_records').update({ certificate_url: publicUrl }).eq('id', record.id)
        }
      }
      setSaving(false)
    }

    setShowModal(false)
    fetchData(agencyId)
  }

  async function handleDelete(id: string) {
    if (!agencyId || !confirm('Delete this training record?')) return
    await supabase.from('training_records').delete().eq('id', id)
    fetchData(agencyId)
  }

  function toggleCourse(courseId: string) {
    setExpandedCourses(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      return next
    })
  }

  function toggleEmployee(empId: string) {
    setExpandedEmployees(prev => {
      const next = new Set(prev)
      if (next.has(empId)) next.delete(empId)
      else next.add(empId)
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? records.filter(r =>
          r.course?.name.toLowerCase().includes(q) ||
          r.employee?.name.toLowerCase().includes(q)
        )
      : records
  }, [records, search])

  const grouped = useMemo(() => {
    const map = new Map<string, { course: Course; records: RecordWithJoins[] }>()
    for (const rec of filtered) {
      if (!rec.course) continue
      if (!map.has(rec.course_id)) map.set(rec.course_id, { course: rec.course, records: [] })
      map.get(rec.course_id)!.records.push(rec)
    }
    return Array.from(map.values()).sort((a, b) => a.course.name.localeCompare(b.course.name))
  }, [filtered])

  const groupedByEmployee = useMemo(() => {
    const map = new Map<string, { employee: Employee; records: RecordWithJoins[] }>()
    for (const rec of filtered) {
      if (!rec.employee) continue
      if (!map.has(rec.employee_id)) map.set(rec.employee_id, { employee: rec.employee, records: [] })
      map.get(rec.employee_id)!.records.push(rec)
    }
    return Array.from(map.values()).sort((a, b) => a.employee.name.localeCompare(b.employee.name))
  }, [filtered])

  const isEmpty = viewMode === 'course' ? grouped.length === 0 : groupedByEmployee.length === 0

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training Log</h1>
          <p className="text-gray-500 text-sm mt-1">
            {records.length} records · {employees.length} employee{employees.length !== 1 ? 's' : ''} · {courses.length} course{courses.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCertUpload(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:border-gray-400 hover:text-black transition"
            >
              <Upload className="w-4 h-4" />
              Upload Certificate
            </button>
            <button
              onClick={() => openAdd()}
              className="flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-900 transition"
            >
              <Plus className="w-4 h-4" />
              Log Training
            </button>
          </div>
        )}
      </div>

      {/* Search + view toggle */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by course or employee name…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition"
          />
        </div>
        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          <button
            onClick={() => setViewMode('course')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'course' ? 'bg-black text-white' : 'text-gray-500 hover:text-black hover:bg-gray-50'}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            By Course
          </button>
          <button
            onClick={() => setViewMode('employee')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${viewMode === 'employee' ? 'bg-black text-white' : 'text-gray-500 hover:text-black hover:bg-gray-50'}`}
          >
            <Users className="w-3.5 h-3.5" />
            By Employee
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : isEmpty ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? 'No matches found' : 'No training records yet'}</p>
          {!search && (
            <button onClick={() => openAdd()} className="text-black text-sm hover:underline mt-2 block mx-auto">
              Log first training →
            </button>
          )}
        </div>
      ) : viewMode === 'course' ? (
        /* ── By Course ── */
        <div className="space-y-2">
          {grouped.map(({ course, records: courseRecords }) => {
            const isExpanded = expandedCourses.has(course.id)
            const latestDate = courseRecords[0]?.completed_date
            const statuses = courseRecords.map(r => getExpirationStatus(r.completed_date, course.expires_years))
            const expiredCount  = statuses.filter(s => s === 'expired').length
            const expiringCount = statuses.filter(s => s === 'expiring_30' || s === 'expiring_60').length

            return (
              <div key={course.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleCourse(course.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <div className="w-9 h-9 bg-black/[0.06] rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-black/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{course.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {latestDate ? `Latest: ${formatDate(latestDate)}` : 'No completions'}
                      {course.expires_years
                        ? ` · Expires after ${course.expires_years === 0.5 ? '6 months' : `${course.expires_years}yr`}`
                        : ' · Never expires'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {expiredCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{expiredCount} expired</span>}
                    {expiringCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{expiringCount} expiring</span>}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {courseRecords.length} record{courseRecords.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); openAdd({ course_id: course.id }) }}
                      className="ml-1 flex items-center gap-1 text-xs text-gray-500 hover:text-black border border-gray-200 hover:border-black px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3 h-3" /> Log
                    </button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="pl-16 pr-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Employee</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Completed</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Hours</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Expires</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cert</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {courseRecords.map(rec => {
                          const expDate = getExpirationDate(rec.completed_date, course.expires_years)
                          const status  = getExpirationStatus(rec.completed_date, course.expires_years)
                          const badge   = getStatusBadge(status)
                          return (
                            <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="pl-16 pr-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-[10px] font-bold">
                                      {(rec.employee?.name ?? '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">{rec.employee?.name ?? '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(rec.completed_date)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{rec.hours}h</td>
                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{expDate ? formatDate(expDate) : '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                              </td>
                              <td className="px-4 py-3">
                                {rec.certificate_url ? (
                                  <button
                                    onClick={() => rec.certificate_url!.toLowerCase().includes('.pdf')
                                      ? window.open(rec.certificate_url!, '_blank')
                                      : setViewingCert(rec.certificate_url!)}
                                    className="w-9 h-9 rounded overflow-hidden border border-gray-200 hover:border-black transition-colors block"
                                  >
                                    {rec.certificate_url.toLowerCase().includes('.pdf')
                                      ? <div className="w-full h-full bg-red-50 flex items-center justify-center"><FileText className="w-4 h-4 text-red-400" /></div>
                                      // eslint-disable-next-line @next/next/no-img-element
                                      : <img src={rec.certificate_url} alt="cert" className="w-full h-full object-cover" />}
                                  </button>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openEdit(rec)} className="text-gray-400 hover:text-black transition p-1.5 rounded-lg hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDelete(rec.id)} className="text-gray-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── By Employee ── */
        <div className="space-y-2">
          {groupedByEmployee.map(({ employee, records: empRecords }) => {
            const isExpanded = expandedEmployees.has(employee.id)
            const latestDate = empRecords[0]?.completed_date
            const statuses = empRecords.map(r => getExpirationStatus(r.completed_date, r.course?.expires_years ?? null))
            const expiredCount  = statuses.filter(s => s === 'expired').length
            const expiringCount = statuses.filter(s => s === 'expiring_30' || s === 'expiring_60').length
            const initials = employee.name.split(' ').map(n => n[0]).slice(0, 2).join('')

            return (
              <div key={employee.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleEmployee(employee.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors text-left"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {employee.name}
                      {employee.employee_number && <span className="ml-2 text-xs text-gray-400 font-normal">#{employee.employee_number}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {latestDate ? `Latest: ${formatDate(latestDate)}` : 'No completions'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {expiredCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{expiredCount} expired</span>}
                    {expiringCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{expiringCount} expiring</span>}
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {empRecords.length} record{empRecords.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); openAdd({ employee_id: employee.id }) }}
                      className="ml-1 flex items-center gap-1 text-xs text-gray-500 hover:text-black border border-gray-200 hover:border-black px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3 h-3" /> Log
                    </button>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="pl-16 pr-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Course</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Completed</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Hours</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Expires</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cert</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {empRecords.map(rec => {
                          const expiresYears = rec.course?.expires_years ?? null
                          const expDate = getExpirationDate(rec.completed_date, expiresYears)
                          const status  = getExpirationStatus(rec.completed_date, expiresYears)
                          const badge   = getStatusBadge(status)
                          return (
                            <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="pl-16 pr-4 py-3">
                                <p className="text-sm font-medium text-gray-900">{rec.course?.name ?? '—'}</p>
                                {rec.course?.expires_years
                                  ? <p className="text-[10px] text-gray-400 mt-0.5">Expires after {rec.course.expires_years === 0.5 ? '6 months' : `${rec.course.expires_years}yr`}</p>
                                  : <p className="text-[10px] text-gray-400 mt-0.5">Never expires</p>}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(rec.completed_date)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{rec.hours}h</td>
                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{expDate ? formatDate(expDate) : '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                              </td>
                              <td className="px-4 py-3">
                                {rec.certificate_url ? (
                                  <button
                                    onClick={() => rec.certificate_url!.toLowerCase().includes('.pdf')
                                      ? window.open(rec.certificate_url!, '_blank')
                                      : setViewingCert(rec.certificate_url!)}
                                    className="w-9 h-9 rounded overflow-hidden border border-gray-200 hover:border-black transition-colors block"
                                  >
                                    {rec.certificate_url.toLowerCase().includes('.pdf')
                                      ? <div className="w-full h-full bg-red-50 flex items-center justify-center"><FileText className="w-4 h-4 text-red-400" /></div>
                                      // eslint-disable-next-line @next/next/no-img-element
                                      : <img src={rec.certificate_url} alt="cert" className="w-full h-full object-cover" />}
                                  </button>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {isAdmin && (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openEdit(rec)} className="text-gray-400 hover:text-black transition p-1.5 rounded-lg hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleDelete(rec.id)} className="text-gray-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editTarget ? 'Edit Training Record' : 'Log Training'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee *</label>
                <select required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="input">
                  <option value="">Select employee…</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Course *</label>
                <select required value={form.course_id} onChange={e => onCourseChange(e.target.value)} className="input">
                  <option value="">Select course…</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.credit_hours}h)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Completion Date *</label>
                <input required type="date" value={form.completed_date} onChange={e => setForm({ ...form, completed_date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours *</label>
                <input required type="number" step="0.25" min="0" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className="input" placeholder="Auto-filled from course" />
              </div>
              {!editTarget && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Certificate <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  {certFile ? (
                    <div className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-200 rounded-lg">
                      <ImageIcon className="w-4 h-4 text-black flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate flex-1">{certFile.name}</span>
                      <button type="button" onClick={() => setCertFile(null)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-black hover:bg-gray-50/30 transition-colors">
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Click to upload image or PDF</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
                    </label>
                  )}
                </div>
              )}
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Log Training'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCertUpload && agencyId && (
        <CertUploadModal
          agencyId={agencyId}
          employees={employees}
          courses={courses}
          onClose={() => setShowCertUpload(false)}
          onSaved={(newEmps, newCourses) => {
            if (newEmps) setEmployees(newEmps)
            if (newCourses) setCourses(newCourses)
            fetchData(agencyId)
          }}
        />
      )}

      {viewingCert && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" onClick={() => setViewingCert(null)}>
          <button onClick={() => setViewingCert(null)} className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewingCert} alt="Certificate" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
