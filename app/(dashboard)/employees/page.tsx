'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Search, Edit2, X, User, BookOpen, ShieldCheck } from 'lucide-react'
import { formatDate, getInitials, getExpirationStatus, getStatusBadge } from '@/lib/utils'
import type { Employee, TrainingRecord, Course } from '@/lib/types'
import { useUserRole } from '@/components/role-provider'
import PlanLimitModal from '@/components/plan-limit-modal'
import { getPlanMaxEmployees } from '@/lib/plans'

type EmployeeForm = {
  name: string
  employee_number: string
  hire_date: string
  employee_type: 'employee' | 'admin'
}

const emptyForm: EmployeeForm = { name: '', employee_number: '', hire_date: '', employee_type: 'employee' }

export default function EmployeesPage() {
  const supabase = createClient()
  const router = useRouter()
  const isAdmin = useUserRole() === 'admin'
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [agencyPlan, setAgencyPlan] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)

  // Training history modal
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null)
  const [historyRecords, setHistoryRecords] = useState<(TrainingRecord & { course?: Course })[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchAgency = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single()
    if (data?.agency_id) {
      const { data: ag } = await supabase.from('agencies').select('plan_type').eq('id', data.agency_id).single()
      setAgencyPlan(ag?.plan_type ?? null)
    }
    setAgencyId(data?.agency_id ?? null)
  }, [supabase])

  const fetchEmployees = useCallback(async (aid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('agency_id', aid)
      .order('name')
    setEmployees(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAgency()
  }, [fetchAgency])

  useEffect(() => {
    if (agencyId) fetchEmployees(agencyId)
  }, [agencyId, fetchEmployees])

  async function openHistory(emp: Employee) {
    setHistoryEmployee(emp)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('training_records')
      .select('*, course:courses(*)')
      .eq('employee_id', emp.id)
      .order('completed_date', { ascending: false })
    setHistoryRecords(data ?? [])
    setHistoryLoading(false)
  }

  function openAdd() {
    const max = getPlanMaxEmployees(agencyPlan)
    if (employees.length >= max) { setShowLimitModal(true); return }
    setEditTarget(null)
    setForm(emptyForm)
    setError(null)
    setShowModal(true)
  }

  function openEdit(emp: Employee, e: React.MouseEvent) {
    e.stopPropagation()
    setEditTarget(emp)
    setForm({
      name: emp.name,
      employee_number: emp.employee_number ?? '',
      hire_date: emp.hire_date ?? '',
      employee_type: emp.employee_type ?? 'employee',
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
      employee_number: form.employee_number.trim() || null,
      hire_date: form.hire_date || null,
      employee_type: form.employee_type,
    }

    let err
    if (editTarget) {
      ;({ error: err } = await supabase.from('employees').update(payload).eq('id', editTarget.id))
    } else {
      ;({ error: err } = await supabase.from('employees').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false)
    fetchEmployees(agencyId)
  }

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_number ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">{employees.length} total employees</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-black text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-900 transition"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or employee ID…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'No matches found' : 'No employees yet'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee ID</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hire Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((emp) => (
                <tr
                  key={emp.id}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/employees/${emp.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{getInitials(emp.name)}</span>
                      </div>
                      <span className="font-medium text-sm text-gray-900">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.employee_number ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(emp.hire_date)}</td>
                  <td className="px-6 py-4">
                    {emp.employee_type === 'admin' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                        <User className="w-3 h-3" /> Staff
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={(e) => openEdit(emp, e)}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black border border-gray-200 hover:border-black px-2.5 py-1.5 rounded-lg transition"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openHistory(emp) }}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black border border-gray-200 hover:border-black px-2.5 py-1.5 rounded-lg transition"
                      >
                        <BookOpen className="w-3 h-3" /> History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal title={editTarget ? 'Edit Employee' : 'Add Employee'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Full Name *">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Employee ID">
              <input
                value={form.employee_number}
                onChange={(e) => setForm({ ...form, employee_number: e.target.value })}
                className="input"
                placeholder="EMP001"
              />
            </Field>
            <Field label="Hire Date">
              <input
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Role">
              <div className="flex gap-3">
                {(['employee', 'admin'] as const).map((type) => (
                  <label
                    key={type}
                    className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                      form.employee_type === type
                        ? 'border-black bg-gray-100'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="employee_type"
                      value={type}
                      checked={form.employee_type === type}
                      onChange={() => setForm({ ...form, employee_type: type })}
                      className="accent-black"
                    />
                    <span className="text-sm font-medium capitalize text-gray-700">
                      {type === 'employee' ? 'Staff' : 'Admin'}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Training History Modal */}
      {historyEmployee && (
        <Modal
          title={`${historyEmployee.name} — Training History`}
          onClose={() => setHistoryEmployee(null)}
          wide
        >
          {historyLoading ? (
            <div className="py-8 text-center text-gray-400">Loading…</div>
          ) : historyRecords.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <p>No training records yet.</p>
              <a href="/training-log" className="text-black text-sm hover:underline mt-2 block">
                Log training →
              </a>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-gray-100">
              {historyRecords.map((r) => {
                const status = r.course
                  ? getExpirationStatus(r.completed_date, r.course.expires_years)
                  : 'never'
                const badge = getStatusBadge(status)
                return (
                  <div key={r.id} className="py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{r.course?.name ?? 'Unknown Course'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Completed: {formatDate(r.completed_date)} · {r.hours}h
                      </p>
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {showLimitModal && (
        <PlanLimitModal
          currentPlan={agencyPlan}
          maxEmployees={getPlanMaxEmployees(agencyPlan)}
          onClose={() => setShowLimitModal(false)}
        />
      )}
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
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
