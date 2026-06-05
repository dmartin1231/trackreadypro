'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, X, Check, Loader2, Users, BookOpen,
  ClipboardList, AlertCircle, RotateCcw, FileSpreadsheet, Info, Undo2,
  ShieldCheck, FileText, Download, AlertTriangle,
} from 'lucide-react'

interface ExtractedEmployee {
  name: string
  employee_number: string | null
  hire_date: string | null
}

interface ExtractedCourse {
  name: string
  credit_hours: number
  expires_years: number | null
}

interface ExtractedRecord {
  employee_name: string
  course_name: string
  completed_date: string
  hours: number
}

interface ExtractedData {
  employees: ExtractedEmployee[]
  courses: ExtractedCourse[]
  training_records: ExtractedRecord[]
}

interface ImportResults {
  employeesCreated: number
  employeesSkipped: number
  coursesCreated: number
  coursesSkipped: number
  recordsCreated: number
  recordsSkipped: number
  errors: string[]
}

type Step = 'upload' | 'parsing' | 'review' | 'importing' | 'done'
type Tab = 'employees' | 'courses' | 'records'

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [data, setData] = useState<ExtractedData | null>(null)
  const [results, setResults] = useState<ImportResults | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('employees')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Batch tracking for undo
  const [lastBatchId, setLastBatchId] = useState<string | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)

  // Backup
  const [backupCounts, setBackupCounts] = useState<{ employees: number; courses: number; records: number } | null>(null)
  const [backingUp, setBackingUp] = useState<false | 'excel' | 'pdf'>(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [agencyName, setAgencyName] = useState('TrackReady PRO')
  const [agencyId, setAgencyId] = useState<string | null>(null)

  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
      const aid = profile?.agency_id
      if (!aid) return
      setAgencyId(aid)
      const [{ data: ag }, { count: ec }, { count: cc }, { count: rc }] = await Promise.all([
        supabase.from('agencies').select('name').eq('id', aid).single(),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('agency_id', aid),
        supabase.from('courses').select('*', { count: 'exact', head: true }).eq('agency_id', aid),
        supabase.from('training_records').select('*', { count: 'exact', head: true }).eq('agency_id', aid),
      ])
      if (ag?.name) setAgencyName(ag.name)
      setBackupCounts({ employees: ec ?? 0, courses: cc ?? 0, records: rc ?? 0 })
      setLastBackup(localStorage.getItem('trackreadypro_last_backup'))
    }
    loadMeta()
  }, [])

  async function handleBackup(fmt: 'excel' | 'pdf') {
    if (!agencyId) return
    setBackingUp(fmt)
    try {
      const supabase = createClient()
      const [{ data: emps }, { data: crs }, { data: recs }] = await Promise.all([
        supabase.from('employees').select('*').eq('agency_id', agencyId).order('name'),
        supabase.from('courses').select('*').eq('agency_id', agencyId).order('name'),
        supabase.from('training_records')
          .select('*, employee:employees(name), course:courses(name)')
          .eq('agency_id', agencyId)
          .order('completed_date', { ascending: false }),
      ])

      const slug = agencyName.replace(/\W+/g, '_')
      const dateSlug = new Date().toISOString().split('T')[0]
      const dateLabel = new Date().toLocaleDateString('en-US', { dateStyle: 'full' })

      if (fmt === 'excel') {
        const XLSX = await import('xlsx')
        const wb = XLSX.utils.book_new()

        const empRows = [
          ['Employee Name', 'Employee ID', 'Hire Date', 'Role'],
          ...(emps ?? []).map(e => [e.name, e.employee_number ?? '', e.hire_date ?? '', e.employee_type === 'admin' ? 'Admin' : 'Staff']),
        ]
        const ws1 = XLSX.utils.aoa_to_sheet(empRows)
        ws1['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 10 }]
        XLSX.utils.book_append_sheet(wb, ws1, 'Employees')

        const courseRows = [
          ['Course Name', 'Credit Hours', 'Expires Years'],
          ...(crs ?? []).map(c => [c.name, c.credit_hours, c.expires_years ?? '']),
        ]
        const ws2 = XLSX.utils.aoa_to_sheet(courseRows)
        ws2['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 14 }]
        XLSX.utils.book_append_sheet(wb, ws2, 'Courses')

        const recRows = [
          ['Employee Name', 'Course Name', 'Completion Date', 'Hours'],
          ...(recs ?? []).map((r: any) => [r.employee?.name ?? '', r.course?.name ?? '', r.completed_date, r.hours]),
        ]
        const ws3 = XLSX.utils.aoa_to_sheet(recRows)
        ws3['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 8 }]
        XLSX.utils.book_append_sheet(wb, ws3, 'Training Records')

        XLSX.writeFile(wb, `${slug}_backup_${dateSlug}.xlsx`)
      } else {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')
        const doc = new jsPDF({ orientation: 'landscape' })

        doc.setFontSize(20); doc.setFont('helvetica', 'bold')
        doc.text(agencyName, 14, 18)
        doc.setFontSize(13); doc.setFont('helvetica', 'normal')
        doc.text('Full Data Backup', 14, 27)
        doc.setFontSize(9); doc.setTextColor(120)
        doc.text(`Generated: ${dateLabel}`, 14, 34)
        doc.text(`${emps?.length ?? 0} employees · ${crs?.length ?? 0} courses · ${recs?.length ?? 0} training records`, 14, 41)
        doc.setTextColor(0)

        doc.setFontSize(11); doc.setFont('helvetica', 'bold')
        doc.text('Employees', 14, 52)
        autoTable(doc, { startY: 56, head: [['Name', 'Employee ID', 'Hire Date', 'Role']], body: (emps ?? []).map(e => [e.name, e.employee_number ?? '—', e.hire_date ?? '—', e.employee_type === 'admin' ? 'Admin' : 'Staff']), styles: { fontSize: 8 }, headStyles: { fillColor: [0, 0, 0], textColor: 255 }, alternateRowStyles: { fillColor: [248, 248, 248] }, margin: { left: 14, right: 14 } })

        doc.addPage()
        doc.setFontSize(11); doc.setFont('helvetica', 'bold')
        doc.text('Courses', 14, 18)
        autoTable(doc, { startY: 22, head: [['Course Name', 'Credit Hours', 'Expiration']], body: (crs ?? []).map(c => [c.name, `${c.credit_hours}h`, c.expires_years == null ? 'Never expires' : `${c.expires_years} yr${c.expires_years !== 1 ? 's' : ''}`]), styles: { fontSize: 8 }, headStyles: { fillColor: [0, 0, 0], textColor: 255 }, alternateRowStyles: { fillColor: [248, 248, 248] }, margin: { left: 14, right: 14 } })

        doc.addPage()
        doc.setFontSize(11); doc.setFont('helvetica', 'bold')
        doc.text('Training Records', 14, 18)
        autoTable(doc, { startY: 22, head: [['Employee', 'Course', 'Completion Date', 'Hours']], body: (recs ?? []).map((r: any) => [r.employee?.name ?? '—', r.course?.name ?? '—', r.completed_date, `${r.hours}h`]), styles: { fontSize: 7 }, headStyles: { fillColor: [0, 0, 0], textColor: 255 }, alternateRowStyles: { fillColor: [248, 248, 248] }, margin: { left: 14, right: 14 } })

        const n = (doc as any).internal.getNumberOfPages()
        for (let i = 1; i <= n; i++) {
          doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150)
          doc.text(`Page ${i} of ${n}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: 'right' })
        }
        doc.save(`${slug}_backup_${dateSlug}.pdf`)
      }

      const ts = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      localStorage.setItem('trackreadypro_last_backup', ts)
      setLastBackup(ts)
    } finally {
      setBackingUp(false)
    }
  }

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setParseError(null)
    setStep('parsing')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/import/parse', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to parse file')
      setData(json)
      setActiveTab('employees')
      setStep('review')
    } catch (err: any) {
      setParseError(err.message)
      setStep('upload')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const reset = () => {
    setStep('upload')
    setData(null)
    setResults(null)
    setParseError(null)
    setFileName('')
    setLastBatchId(null)
    setShowUndoConfirm(false)
  }

  const removeEmployee = (i: number) =>
    setData(d => d ? { ...d, employees: d.employees.filter((_, idx) => idx !== i) } : d)

  const removeCourse = (i: number) =>
    setData(d => d ? { ...d, courses: d.courses.filter((_, idx) => idx !== i) } : d)

  const removeRecord = (i: number) =>
    setData(d => d ? { ...d, training_records: d.training_records.filter((_, idx) => idx !== i) } : d)

  const handleImport = async () => {
    if (!data) return
    setStep('importing')

    const supabase = createClient()
    const batchId = crypto.randomUUID()
    const res: ImportResults = {
      employeesCreated: 0, employeesSkipped: 0,
      coursesCreated: 0, coursesSkipped: 0,
      recordsCreated: 0, recordsSkipped: 0,
      errors: [],
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setParseError('Not authenticated'); setStep('review'); return }

    const { data: profile } = await supabase
      .from('user_profiles').select('agency_id').eq('id', user.id).single()
    const agency_id = profile?.agency_id
    if (!agency_id) { setParseError('No agency found'); setStep('review'); return }

    // Fetch all existing data in 3 parallel queries — check duplicates in memory, not per-row
    const [
      { data: existingEmps },
      { data: existingCourses },
      { data: existingRecords },
    ] = await Promise.all([
      supabase.from('employees').select('id, name, employee_number').eq('agency_id', agency_id),
      supabase.from('courses').select('id, name').eq('agency_id', agency_id),
      supabase.from('training_records')
        .select('employee_id, course_id, completed_date')
        .eq('agency_id', agency_id)
        .limit(100000),
    ])

    const empMap = new Map<string, string>()
    existingEmps?.forEach(e => {
      empMap.set(e.name.toLowerCase().trim(), e.id)
      if (e.employee_number) empMap.set(e.employee_number.toLowerCase().trim(), e.id)
    })

    const courseMap = new Map<string, string>()
    existingCourses?.forEach(c => courseMap.set(c.name.toLowerCase().trim(), c.id))

    const existingRecordKeys = new Set<string>()
    existingRecords?.forEach(r => {
      existingRecordKeys.add(`${r.employee_id}|${r.course_id}|${r.completed_date}`)
    })

    // Batch insert employees — one query instead of N
    const newEmps = data.employees.filter(emp => {
      const nameKey = emp.name.toLowerCase().trim()
      const numKey = emp.employee_number?.toLowerCase().trim()
      return !empMap.has(nameKey) && !(numKey && empMap.has(numKey))
    })
    res.employeesSkipped = data.employees.length - newEmps.length

    if (newEmps.length > 0) {
      const { data: inserted, error: err } = await supabase
        .from('employees')
        .insert(newEmps.map(e => ({ agency_id, name: e.name, employee_number: e.employee_number, hire_date: e.hire_date, import_batch_id: batchId })))
        .select('id, name, employee_number')
      if (err) {
        res.errors.push(`Failed to insert employees: ${err.message}`)
      } else {
        inserted?.forEach(e => {
          empMap.set(e.name.toLowerCase().trim(), e.id)
          if (e.employee_number) empMap.set(e.employee_number.toLowerCase().trim(), e.id)
        })
        res.employeesCreated = inserted?.length ?? 0
      }
    }

    // Batch insert courses — one query instead of N
    const newCourses = data.courses.filter(c => !courseMap.has(c.name.toLowerCase().trim()))
    res.coursesSkipped = data.courses.length - newCourses.length

    if (newCourses.length > 0) {
      const { data: inserted, error: err } = await supabase
        .from('courses')
        .insert(newCourses.map(c => ({ agency_id, name: c.name, credit_hours: c.credit_hours, expires_years: c.expires_years, import_batch_id: batchId })))
        .select('id, name')
      if (err) {
        res.errors.push(`Failed to insert courses: ${err.message}`)
      } else {
        inserted?.forEach(c => courseMap.set(c.name.toLowerCase().trim(), c.id))
        res.coursesCreated = inserted?.length ?? 0
      }
    }

    // Build list of new training records — duplicate check is in-memory, not per-row queries
    const newRecords: Array<{ agency_id: string; employee_id: string; course_id: string; completed_date: string; hours: number; import_batch_id: string }> = []
    for (const record of data.training_records) {
      const employee_id = empMap.get(record.employee_name.toLowerCase().trim())
      const course_id = courseMap.get(record.course_name.toLowerCase().trim())
      if (!employee_id || !course_id) {
        res.errors.push(`Skipped: no match for "${record.employee_name}" / "${record.course_name}"`)
        continue
      }
      const key = `${employee_id}|${course_id}|${record.completed_date}`
      if (existingRecordKeys.has(key)) {
        res.recordsSkipped++
        continue
      }
      newRecords.push({ agency_id, employee_id, course_id, completed_date: record.completed_date, hours: record.hours, import_batch_id: batchId })
      existingRecordKeys.add(key) // prevent duplicates within this import batch
    }

    // Insert in chunks of 500 to stay within Supabase limits
    const CHUNK = 500
    for (let i = 0; i < newRecords.length; i += CHUNK) {
      const { error: err } = await supabase.from('training_records').insert(newRecords.slice(i, i + CHUNK))
      if (err) {
        res.errors.push(`Record batch ${Math.floor(i / CHUNK) + 1} failed: ${err.message}`)
      } else {
        res.recordsCreated += Math.min(CHUNK, newRecords.length - i)
      }
    }

    setResults(res)
    setLastBatchId(batchId)
    setStep('done')
  }

  async function handleUndoImport() {
    if (!lastBatchId) return
    setUndoing(true)
    const supabase = createClient()
    await supabase.from('training_records').delete().eq('import_batch_id', lastBatchId)
    await Promise.all([
      supabase.from('employees').delete().eq('import_batch_id', lastBatchId),
      supabase.from('courses').delete().eq('import_batch_id', lastBatchId),
    ])
    setUndoing(false)
    setShowUndoConfirm(false)
    reset()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* ── Undo confirmation modal ── */}
      {showUndoConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Undo this import?</h3>
            <p className="text-sm text-gray-500 mb-2">
              This will permanently delete the <strong>{results?.recordsCreated ?? 0} training records</strong>,{' '}
              <strong>{results?.employeesCreated ?? 0} employees</strong>, and{' '}
              <strong>{results?.coursesCreated ?? 0} courses</strong> that were just imported.
            </p>
            <p className="text-xs text-red-600 font-medium mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUndoConfirm(false)}
                disabled={undoing}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Keep the data
              </button>
              <button
                onClick={handleUndoImport}
                disabled={undoing}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {undoing ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing…</> : 'Yes, delete it all'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Import Training Data</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload your existing Excel or CSV training log — we'll automatically pull out your
          employees, courses, and training records so you don't have to type them in one by one.
        </p>
      </div>

      {/* ── Backup card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Data Backup</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {lastBackup ? `Last backup: ${lastBackup}` : 'No backup on record — save one now'}
            </p>
          </div>
          {lastBackup && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              Backed up
            </span>
          )}
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-4">
            Export everything — employees, courses, and all training records — into a single file.
            Save it somewhere safe. If data is ever lost or accidentally deleted, you can re-import
            the Excel backup to restore everything.
          </p>

          {backupCounts && (
            <div className="flex items-center gap-4 mb-5 text-sm">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <strong className="text-gray-900">{backupCounts.employees}</strong> employees
              </span>
              <span className="text-gray-200">|</span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                <strong className="text-gray-900">{backupCounts.courses}</strong> courses
              </span>
              <span className="text-gray-200">|</span>
              <span className="flex items-center gap-1.5 text-gray-600">
                <ClipboardList className="w-3.5 h-3.5 text-gray-400" />
                <strong className="text-gray-900">{backupCounts.records}</strong> training records
              </span>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => handleBackup('excel')}
              disabled={!!backingUp || !agencyId}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {backingUp === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Save Backup as Excel
            </button>
            <button
              onClick={() => handleBackup('pdf')}
              disabled={!!backingUp || !agencyId}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {backingUp === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Save Backup as PDF
            </button>
          </div>

          <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              <strong>Excel backup is re-importable.</strong> If you ever need to restore, just upload the Excel file using the import tool below.
              PDF is for printing and archival only.
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Import New Data</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'review', 'done'] as const).map((s, i) => {
          const labels = ['Upload File', 'Review Data', 'Import Complete']
          const stepOrder = { upload: 0, parsing: 0, review: 1, importing: 1, done: 2 }
          const current = stepOrder[step]
          const done = current > i
          const active = current === i
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 text-sm font-medium ${
                active ? 'text-black' : done ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? 'bg-green-100 text-green-600' :
                  active ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {labels[i]}
              </div>
              {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
            </div>
          )
        })}
      </div>

      {/* ── STEP: UPLOAD ── */}
      {(step === 'upload' || step === 'parsing') && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {parseError && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div><strong>Error:</strong> {parseError}</div>
            </div>
          )}

          {step === 'parsing' ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="w-10 h-10 text-black animate-spin" />
              <div className="text-center">
                <p className="font-medium text-gray-900">Analyzing your file…</p>
                <p className="text-sm text-gray-500 mt-1">Extracting employees, courses, and training records from <strong>{fileName}</strong></p>
              </div>
            </div>
          ) : (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
                  isDragging ? 'border-black bg-gray-100' : 'border-gray-300 hover:border-black hover:bg-gray-50'
                }`}
              >
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-black" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Drop your training log here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (.xlsx, .xlsm, .xls)
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
              />

              {/* Column name hint */}
              <div className="mt-5 bg-blue-50 border border-blue-100 rounded-lg p-4 text-left">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-800 mb-1">Recommended column headers</p>
                    <p className="text-xs text-blue-700">
                      We'll detect columns automatically. For best results, use headers similar to:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Employee Name', 'Employee ID', 'Hire Date', 'Course Name', 'Completion Date', 'Hours'].map(h => (
                        <code key={h} className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">{h}</code>
                      ))}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Variations like "Full Name", "Training", "Date Completed", "Credit Hours" also work.
                      Have a PDF? Export it to Excel first.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP: REVIEW ── */}
      {step === 'review' && data && (
        <div className="space-y-4">
          {/* Summary chips */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-sm">
              <Users className="w-4 h-4 text-black" />
              <span className="font-semibold text-black">{data.employees.length}</span>
              <span className="text-gray-600">employees found</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <span className="font-semibold text-blue-700">{data.courses.length}</span>
              <span className="text-gray-600">courses found</span>
            </div>
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-4 py-2 text-sm">
              <ClipboardList className="w-4 h-4 text-green-700" />
              <span className="font-semibold text-green-700">{data.training_records.length}</span>
              <span className="text-gray-600">training records found</span>
            </div>
            <button onClick={reset} className="ml-auto text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Start over
            </button>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {([
                { id: 'employees', label: 'Employees', count: data.employees.length, icon: Users },
                { id: 'courses', label: 'Courses', count: data.courses.length, icon: BookOpen },
                { id: 'records', label: 'Training Records', count: data.training_records.length, icon: ClipboardList },
              ] as const).map(({ id, label, count, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                    activeTab === id ? 'bg-gray-100 text-black' : 'bg-gray-100 text-gray-500'
                  }`}>{count}</span>
                </button>
              ))}
            </div>

            <div className="overflow-auto max-h-[400px]">
              {/* Employees tab */}
              {activeTab === 'employees' && (
                data.employees.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm">No employees — all removed</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Employee #</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Hire Date</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.employees.map((emp, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                          <td className="px-4 py-3 text-gray-500">{emp.employee_number ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500">{emp.hire_date ?? '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => removeEmployee(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* Courses tab */}
              {activeTab === 'courses' && (
                data.courses.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm">No courses — all removed</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Course Name</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Credit Hours</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.courses.map((course, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{course.name}</td>
                          <td className="px-4 py-3 text-gray-500">{course.credit_hours}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {course.expires_years == null ? 'Never' : `${course.expires_years} yr${course.expires_years !== 1 ? 's' : ''}`}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => removeCourse(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {/* Training records tab */}
              {activeTab === 'records' && (
                data.training_records.length === 0 ? (
                  <p className="text-center text-gray-400 py-12 text-sm">No training records — all removed</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Course</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Completed</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Hours</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.training_records.map((rec, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{rec.employee_name}</td>
                          <td className="px-4 py-3 text-gray-500">{rec.course_name}</td>
                          <td className="px-4 py-3 text-gray-500">{rec.completed_date}</td>
                          <td className="px-4 py-3 text-gray-500">{rec.hours}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => removeRecord(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-400">
              Review the extracted data above. Remove any rows that look incorrect before importing.
              Existing employees and courses with the same name will be skipped automatically.
            </p>
            <button
              onClick={handleImport}
              disabled={data.employees.length === 0 && data.courses.length === 0 && data.training_records.length === 0}
              className="ml-6 flex-shrink-0 bg-black text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Import All Data
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: IMPORTING ── */}
      {step === 'importing' && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-black animate-spin" />
          <div className="text-center">
            <p className="font-medium text-gray-900">Importing your data…</p>
            <p className="text-sm text-gray-500 mt-1">Creating employees, courses, and training records</p>
          </div>
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && results && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Import complete</p>
              <p className="text-sm text-gray-500">Your data has been imported successfully</p>
            </div>
            {/* Undo — opens confirmation modal */}
            <button
              onClick={() => setShowUndoConfirm(true)}
              className="flex items-center gap-2 text-sm text-orange-600 border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo Import
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <ResultCard
              icon={<Users className="w-5 h-5 text-black" />}
              label="Employees"
              created={results.employeesCreated}
              skipped={results.employeesSkipped}
              color="gray"
            />
            <ResultCard
              icon={<BookOpen className="w-5 h-5 text-blue-700" />}
              label="Courses"
              created={results.coursesCreated}
              skipped={results.coursesSkipped}
              color="blue"
            />
            <ResultCard
              icon={<ClipboardList className="w-5 h-5 text-green-700" />}
              label="Training Records"
              created={results.recordsCreated}
              skipped={results.recordsSkipped}
              color="green"
            />
          </div>

          {results.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {results.errors.length} item{results.errors.length !== 1 ? 's' : ''} could not be imported
              </p>
              <ul className="space-y-1">
                {results.errors.map((e, i) => (
                  <li key={i} className="text-xs text-yellow-700">• {e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <a href="/employees" className="bg-black text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-900 transition-colors">
              View Employees
            </a>
            <a href="/training-log" className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
              View Training Log
            </a>
            <button onClick={reset} className="ml-auto text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({
  icon, label, created, skipped, color,
}: {
  icon: React.ReactNode
  label: string
  created: number
  skipped: number
  color: 'gray' | 'blue' | 'green'
}) {
  const bg = { gray: 'bg-gray-100', blue: 'bg-blue-50', green: 'bg-green-50' }[color]
  const border = { gray: 'border-gray-200', blue: 'border-blue-100', green: 'border-green-100' }[color]
  const text = { gray: 'text-black', blue: 'text-blue-700', green: 'text-green-700' }[color]

  return (
    <div className={`${bg} ${border} border rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-sm font-medium text-gray-700">{label}</span></div>
      <p className={`text-2xl font-bold ${text}`}>{created}</p>
      <p className="text-xs text-gray-500 mt-0.5">created</p>
      {skipped > 0 && <p className="text-xs text-gray-400 mt-2">{skipped} already existed, skipped</p>}
    </div>
  )
}
