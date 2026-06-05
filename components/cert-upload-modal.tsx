'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  X, Upload, FileText, Plus, Search, Loader2, Check,
  ChevronDown, UserPlus, BookPlus,
} from 'lucide-react'
import type { Employee, Course } from '@/lib/types'

type Props = {
  agencyId: string
  employees: Employee[]
  courses: Course[]
  onClose: () => void
  onSaved: (newEmployees?: Employee[], newCourses?: Course[]) => void
}

// ── Smart search+create dropdown ─────────────────────────────────────────────
function SmartSelect({
  label,
  items,
  selectedId,
  onSelect,
  onCreateNew,
  placeholder,
  createLabel,
  required,
}: {
  label: string
  items: { id: string; label: string }[]
  selectedId: string
  onSelect: (id: string) => void
  onCreateNew: (name: string) => void
  placeholder: string
  createLabel: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = items.find(i => i.id === selectedId)
  const filtered = items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))

  function pick(id: string) {
    onSelect(id)
    setSearch('')
    setOpen(false)
  }

  function handleCreate() {
    const name = search.trim()
    if (!name) return
    onCreateNew(name)
    setSearch('')
    setOpen(false)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50) }}
          className={`input w-full flex items-center justify-between gap-2 text-left ${!selected ? 'text-gray-400' : 'text-gray-900'}`}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); filtered[0] ? pick(filtered[0].id) : handleCreate() } }}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${item.id === selectedId ? 'font-semibold text-black' : 'text-gray-700'}`}
                >
                  {item.id === selectedId && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  {item.id !== selectedId && <span className="w-3.5" />}
                  {item.label}
                </button>
              ))}
              {filtered.length === 0 && search.trim() === '' && (
                <p className="text-xs text-gray-400 px-4 py-3">Type to search…</p>
              )}
              {search.trim() !== '' && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full text-left px-4 py-2.5 text-sm text-black font-medium hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <Plus className="w-3.5 h-3.5 text-black flex-shrink-0" />
                  {createLabel} &ldquo;{search.trim()}&rdquo;
                </button>
              )}
              {filtered.length === 0 && search.trim() === '' && items.length === 0 && (
                <p className="text-xs text-gray-400 px-4 pb-3 text-center">None yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline new-employee mini-form ─────────────────────────────────────────────
function NewEmployeeForm({
  defaultName,
  onCancel,
  onCreate,
}: {
  defaultName: string
  onCancel: () => void
  onCreate: (emp: { name: string; employee_number: string | null; hire_date: string | null }) => void
}) {
  const [name, setName] = useState(defaultName)
  const [empNum, setEmpNum] = useState('')
  const [hireDate, setHireDate] = useState('')
  return (
    <div className="mt-2 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <UserPlus className="w-4 h-4 text-black" />
        <p className="text-sm font-semibold text-gray-900">New Employee</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input text-sm" placeholder="Jane Smith" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID <span className="text-gray-400">(optional)</span></label>
          <input value={empNum} onChange={e => setEmpNum(e.target.value)} className="input text-sm" placeholder="EMP001" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hire Date <span className="text-gray-400">(optional)</span></label>
          <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className="input text-sm" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => onCreate({ name: name.trim(), employee_number: empNum.trim() || null, hire_date: hireDate || null })}
          className="btn-primary flex-1 text-sm"
        >
          Add Employee
        </button>
      </div>
    </div>
  )
}

// ── Inline new-course mini-form ───────────────────────────────────────────────
function NewCourseForm({
  defaultName,
  onCancel,
  onCreate,
}: {
  defaultName: string
  onCancel: () => void
  onCreate: (c: { name: string; credit_hours: number; expires_years: number | null }) => void
}) {
  const [name, setName] = useState(defaultName)
  const [hours, setHours] = useState('')
  const [expires, setExpires] = useState('')
  return (
    <div className="mt-2 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <BookPlus className="w-4 h-4 text-black" />
        <p className="text-sm font-semibold text-gray-900">New Course</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Course Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input text-sm" placeholder="CPR / First Aid" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Credit Hours *</label>
          <input type="number" step="0.25" min="0" value={hours} onChange={e => setHours(e.target.value)} className="input text-sm" placeholder="2" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expires After <span className="text-gray-400">(years)</span></label>
          <input type="number" step="0.5" min="0" value={expires} onChange={e => setExpires(e.target.value)} className="input text-sm" placeholder="Never" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
        <button
          type="button"
          disabled={!name.trim() || !hours}
          onClick={() => onCreate({
            name: name.trim(),
            credit_hours: parseFloat(hours),
            expires_years: expires ? parseFloat(expires) : null,
          })}
          className="btn-primary flex-1 text-sm"
        >
          Add Course
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function CertUploadModal({ agencyId, employees: initialEmployees, courses: initialCourses, onClose, onSaved }: Props) {
  const supabase = createClient()

  const [step, setStep] = useState<'upload' | 'details'>('upload')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local copies that can gain newly-created items
  const [employees, setEmployees] = useState(initialEmployees)
  const [courses, setCourses] = useState(initialCourses)

  // Form state
  const [empId, setEmpId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().split('T')[0])
  const [hours, setHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Inline create state
  const [creatingEmpName, setCreatingEmpName] = useState<string | null>(null)
  const [creatingCourseName, setCreatingCourseName] = useState<string | null>(null)

  const empOptions = employees.map(e => ({ id: e.id, label: e.name + (e.employee_number ? ` (${e.employee_number})` : '') }))
  const courseOptions = courses.map(c => ({ id: c.id, label: `${c.name} (${c.credit_hours}h)` }))

  function handleFile(f: File) {
    setFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function selectCourse(id: string) {
    setCourseId(id)
    const c = courses.find(c => c.id === id)
    if (c) setHours(String(c.credit_hours))
  }

  async function createEmployee(data: { name: string; employee_number: string | null; hire_date: string | null }) {
    const { data: emp, error: err } = await supabase
      .from('employees')
      .insert({ agency_id: agencyId, ...data, employee_type: 'employee' })
      .select()
      .single()
    if (err || !emp) { setError(err?.message ?? 'Failed to create employee'); return }
    const updated = [...employees, emp as Employee]
    setEmployees(updated)
    setEmpId(emp.id)
    setCreatingEmpName(null)
  }

  async function createCourse(data: { name: string; credit_hours: number; expires_years: number | null }) {
    const { data: course, error: err } = await supabase
      .from('courses')
      .insert({ agency_id: agencyId, ...data })
      .select()
      .single()
    if (err || !course) { setError(err?.message ?? 'Failed to create course'); return }
    const updated = [...courses, course as Course]
    setCourses(updated)
    selectCourse(course.id)
    setCreatingCourseName(null)
  }

  const handleSave = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !empId || !courseId || !completedDate || !hours) return
    setSaving(true)
    setError(null)

    const payload = {
      agency_id: agencyId,
      employee_id: empId,
      course_id: courseId,
      completed_date: completedDate,
      hours: parseFloat(hours),
    }

    const { data: record, error: insertErr } = await supabase
      .from('training_records')
      .insert(payload)
      .select()
      .single()

    if (insertErr || !record) {
      setSaving(false)
      setError(insertErr?.message ?? 'Failed to save record')
      return
    }

    // Upload certificate
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${agencyId}/${empId}/${record.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('certificates').upload(path, file)
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('certificates').getPublicUrl(path)
      await supabase.from('training_records').update({ certificate_url: publicUrl }).eq('id', record.id)
    }

    setSaving(false)
    setDone(true)
    onSaved(employees, courses)
  }, [file, empId, courseId, completedDate, hours, agencyId, supabase, onSaved, employees, courses])

  const isImage = file && file.type.startsWith('image/')
  const isPdf = file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-lg mb-1">Record Saved</h3>
          <p className="text-gray-500 text-sm mb-6">
            The training record and certificate have been added successfully.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Done</button>
            <button
              onClick={() => { setStep('upload'); setFile(null); setEmpId(''); setCourseId(''); setHours(''); setDone(false) }}
              className="btn-primary flex-1"
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">Upload Certificate</h3>
            <div className="flex items-center gap-1">
              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${step === 'upload' ? 'bg-black text-white' : 'bg-green-500 text-white'}`}>
                {step === 'upload' ? '1' : <Check className="w-3 h-3" />}
              </span>
              <div className="w-6 h-px bg-gray-200" />
              <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${step === 'details' ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'}`}>
                2
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-5">
              Upload the certificate file — you'll choose the employee and course on the next screen.
            </p>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-black bg-gray-50 scale-[1.01]'
                  : file
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  {isImage
                    ? <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 mx-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      </div>
                    : <div className="w-16 h-16 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
                        <FileText className="w-8 h-8 text-red-400" />
                      </div>
                  }
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Drop your certificate here</p>
                    <p className="text-sm text-gray-400 mt-1">or click to browse · JPG, PNG, PDF</p>
                  </div>
                </div>
              )}
            </div>
            <button
              disabled={!file}
              onClick={() => setStep('details')}
              className="btn-primary w-full mt-5 disabled:opacity-40"
            >
              Next: Add Details →
            </button>
          </div>
        )}

        {/* ── Step 2: Details ── */}
        {step === 'details' && (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            {/* File recap */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              {isImage
                ? <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={URL.createObjectURL(file!)} alt="" className="w-full h-full object-cover" />
                  </div>
                : <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-red-400" />
                  </div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file?.name}</p>
                <button type="button" onClick={() => setStep('upload')} className="text-xs text-gray-400 hover:text-black transition">
                  ← Change file
                </button>
              </div>
            </div>

            {/* Employee */}
            <div>
              <SmartSelect
                label="Employee"
                items={empOptions}
                selectedId={empId}
                onSelect={setEmpId}
                onCreateNew={name => setCreatingEmpName(name)}
                placeholder="Search or select employee…"
                createLabel="Add new employee"
                required
              />
              {creatingEmpName !== null && (
                <NewEmployeeForm
                  defaultName={creatingEmpName}
                  onCancel={() => setCreatingEmpName(null)}
                  onCreate={createEmployee}
                />
              )}
            </div>

            {/* Course */}
            <div>
              <SmartSelect
                label="Course / Certification"
                items={courseOptions}
                selectedId={courseId}
                onSelect={selectCourse}
                onCreateNew={name => setCreatingCourseName(name)}
                placeholder="Search or select course…"
                createLabel="Add new course"
                required
              />
              {creatingCourseName !== null && (
                <NewCourseForm
                  defaultName={creatingCourseName}
                  onCancel={() => setCreatingCourseName(null)}
                  onCreate={createCourse}
                />
              )}
            </div>

            {/* Date + Hours */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Completion Date *</label>
                <input
                  required
                  type="date"
                  value={completedDate}
                  onChange={e => setCompletedDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours *</label>
                <input
                  required
                  type="number"
                  step="0.25"
                  min="0"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  className="input"
                  placeholder="Auto-filled from course"
                />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep('upload')} className="btn-secondary flex-1">
                ← Back
              </button>
              <button
                type="submit"
                disabled={saving || !empId || !courseId || !completedDate || !hours || creatingEmpName !== null || creatingCourseName !== null}
                className="btn-primary flex-1"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </span>
                ) : 'Save Record'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
