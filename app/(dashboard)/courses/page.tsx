'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Library, X } from 'lucide-react'
import { expiresYearsLabel } from '@/lib/utils'
import type { Course } from '@/lib/types'

type CourseForm = {
  name: string
  credit_hours: string
  expires_years: string // '' = never
}

const emptyForm: CourseForm = { name: '', credit_hours: '', expires_years: '' }

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '0.5', label: '6 months' },
  { value: '1', label: '1 year' },
  { value: '2', label: '2 years' },
  { value: '3', label: '3 years' },
]

export default function CoursesPage() {
  const supabase = createClient()
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Course | null>(null)
  const [form, setForm] = useState<CourseForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCourses = useCallback(async (aid: string) => {
    setLoading(true)
    const { data } = await supabase.from('courses').select('*').eq('agency_id', aid).order('name')
    setCourses(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
      if (data?.agency_id) {
        setAgencyId(data.agency_id)
        fetchCourses(data.agency_id)
      }
    }
    init()
  }, [supabase, fetchCourses])

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm)
    setError(null)
    setShowModal(true)
  }

  function openEdit(course: Course) {
    setEditTarget(course)
    setForm({
      name: course.name,
      credit_hours: String(course.credit_hours),
      expires_years: course.expires_years !== null ? String(course.expires_years) : '',
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
      name: form.name.trim(),
      credit_hours: parseFloat(form.credit_hours),
      expires_years: form.expires_years !== '' ? parseFloat(form.expires_years) : null,
    }

    let err
    if (editTarget) {
      ;({ error: err } = await supabase.from('courses').update(payload).eq('id', editTarget.id))
    } else {
      ;({ error: err } = await supabase.from('courses').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false)
    fetchCourses(agencyId)
  }

  async function handleDelete(id: string) {
    if (!agencyId || !confirm('Delete this course? Existing training records will remain.')) return
    await supabase.from('courses').delete().eq('id', id)
    fetchCourses(agencyId)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Course Library</h1>
          <p className="text-gray-500 text-sm mt-1">{courses.length} courses</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-900 transition"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
            <Library className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No courses yet</p>
            <p className="text-sm mt-1">Add courses to start logging training</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Course Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Credit Hours</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiration</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black/10 rounded-lg flex items-center justify-center">
                          <Library className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-medium text-sm text-gray-900">{course.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {course.credit_hours}h
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        course.expires_years === null
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {expiresYearsLabel(course.expires_years)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(course)}
                          className="text-gray-400 hover:text-black transition p-1.5 rounded-lg hover:bg-gray-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="text-gray-400 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editTarget ? 'Edit Course' : 'Add Course'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                  placeholder="e.g. CPR / First Aid"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Credit Hours *</label>
                <input
                  required
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={form.credit_hours}
                  onChange={(e) => setForm({ ...form, credit_hours: e.target.value })}
                  className="input"
                  placeholder="e.g. 2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiration Period</label>
                <select
                  value={form.expires_years}
                  onChange={(e) => setForm({ ...form, expires_years: e.target.value })}
                  className="input"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
