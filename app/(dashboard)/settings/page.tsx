'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, CheckCircle2, Trash2, AlertTriangle, Calendar, Clock, RotateCcw, Users, UserPlus, Crown, Eye, Loader2, X, Mail } from 'lucide-react'
import type { Agency } from '@/lib/types'
import type { TrainingPeriod } from '@/lib/training-period'
import { MONTH_NAMES } from '@/lib/training-period'
import { useUserRole } from '@/components/role-provider'

type TeamMember = { id: string; email: string; role: string }

const PERIOD_OPTIONS: { value: TrainingPeriod; label: string; description: string }[] = [
  {
    value: 'calendar_year',
    label: 'Calendar Year',
    description: 'Jan 1 – Dec 31 every year. Same period for all employees.',
  },
  {
    value: 'hire_date',
    label: 'Hire Date Anniversary',
    description: "Each employee's period runs 12 months from their hire date anniversary.",
  },
  {
    value: 'fiscal_year',
    label: 'Fiscal Year',
    description: 'Choose the month your fiscal year starts. Same period for all employees.',
  },
  {
    value: 'license_renewal',
    label: 'License Renewal Cycle',
    description: 'Compliance is based on individual certification expiration dates, not hours.',
  },
]

export default function SettingsPage() {
  const supabase = createClient()
  const userRole = useUserRole()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [name, setName] = useState('')
  const [requiredHours, setRequiredHours] = useState('24')
  const [trainingPeriod, setTrainingPeriod] = useState<TrainingPeriod>('calendar_year')
  const [fiscalStartMonth, setFiscalStartMonth] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClearModal, setShowClearModal]   = useState(false)
  const [clearing, setClearing]               = useState(false)
  const [clearError, setClearError]           = useState<string | null>(null)
  const [clearDone, setClearDone]             = useState(false)
  const [showUndoModal, setShowUndoModal]     = useState(false)
  const [undoingImport, setUndoingImport]     = useState(false)
  const [undoImportError, setUndoImportError] = useState<string | null>(null)
  const [undoImportDone, setUndoImportDone]   = useState(false)

  // Team management
  const [members, setMembers]         = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<'admin' | 'viewer'>('viewer')
  const [inviting, setInviting]       = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteDone, setInviteDone]   = useState(false)
  const [removingId, setRemovingId]   = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: profile } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
      if (!profile?.agency_id) return
      const { data: agencyData } = await supabase.from('agencies').select('*').eq('id', profile.agency_id).single()
      if (agencyData) {
        setAgency(agencyData)
        setName(agencyData.name)
        setRequiredHours(String(agencyData.required_hours))
        setTrainingPeriod(agencyData.training_period ?? 'calendar_year')
        setFiscalStartMonth(agencyData.fiscal_year_start_month ?? 1)
      }
    }
    init()
  }, [supabase])

  useEffect(() => {
    async function loadTeam() {
      setLoadingTeam(true)
      const res = await fetch('/api/team')
      const json = await res.json()
      setMembers(json.members ?? [])
      setLoadingTeam(false)
    }
    loadTeam()
  }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    })
    const json = await res.json()
    setInviting(false)
    if (!res.ok) { setInviteError(json.error ?? 'Failed to send invite'); return }
    setInviteDone(true)
    setInviteEmail('')
    setShowInvite(false)
    // Refresh list
    const teamRes = await fetch('/api/team')
    setMembers((await teamRes.json()).members ?? [])
    setTimeout(() => setInviteDone(false), 4000)
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this team member? They will lose access immediately.')) return
    setRemovingId(memberId)
    await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    setMembers(m => m.filter(x => x.id !== memberId))
    setRemovingId(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!agency) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: err } = await supabase
      .from('agencies')
      .update({
        name: name.trim(),
        required_hours: parseFloat(requiredHours),
        training_period: trainingPeriod,
        fiscal_year_start_month: fiscalStartMonth,
      })
      .eq('id', agency.id)

    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleClearAll() {
    if (!agency) return
    setClearing(true)
    setClearError(null)

    const { error: recErr } = await supabase
      .from('training_records').delete().eq('agency_id', agency.id)
    if (recErr) { setClearError(recErr.message); setClearing(false); return }

    const [{ error: empErr }, { error: courseErr }] = await Promise.all([
      supabase.from('employees').delete().eq('agency_id', agency.id),
      supabase.from('courses').delete().eq('agency_id', agency.id),
    ])
    if (empErr || courseErr) {
      setClearError(empErr?.message ?? courseErr?.message ?? 'Delete failed')
      setClearing(false)
      return
    }

    setClearing(false)
    setShowClearModal(false)
    setClearDone(true)
  }

  async function handleUndoLastImport() {
    if (!agency) return
    setUndoingImport(true)
    setUndoImportError(null)

    // Find most recent import batch — check employees first, then training_records
    let batchId: string | null = null

    const { data: recentEmp } = await supabase
      .from('employees').select('import_batch_id, created_at')
      .eq('agency_id', agency.id).not('import_batch_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1)
    batchId = recentEmp?.[0]?.import_batch_id ?? null

    if (!batchId) {
      const { data: recentRec } = await supabase
        .from('training_records').select('import_batch_id, created_at')
        .eq('agency_id', agency.id).not('import_batch_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1)
      batchId = recentRec?.[0]?.import_batch_id ?? null
    }

    if (!batchId) {
      setUndoImportError('No recent import found. Imports done before this feature was added cannot be undone here — use Clear All Data instead.')
      setUndoingImport(false)
      return
    }

    await supabase.from('training_records').delete().eq('import_batch_id', batchId)
    await Promise.all([
      supabase.from('employees').delete().eq('import_batch_id', batchId),
      supabase.from('courses').delete().eq('import_batch_id', batchId),
    ])

    setUndoingImport(false)
    setShowUndoModal(false)
    setUndoImportDone(true)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your organization settings</p>
      </div>

      {/* Agency Settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-black/10 rounded-lg flex items-center justify-center">
            <Settings className="w-4 h-4 text-black" />
          </div>
          <h2 className="font-semibold text-gray-900">Organization Settings</h2>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input max-w-md"
              placeholder="Your Organization Name"
            />
            <p className="text-xs text-gray-400 mt-1.5">Displayed in the sidebar and reports</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Required Training Hours
              {trainingPeriod === 'license_renewal' && (
                <span className="ml-2 text-xs font-normal text-gray-400">(not used in license renewal mode)</span>
              )}
            </label>
            <div className="flex items-center gap-3 max-w-xs">
              <input
                required
                type="number"
                min="1"
                step="1"
                value={requiredHours}
                onChange={(e) => setRequiredHours(e.target.value)}
                className={`input ${trainingPeriod === 'license_renewal' ? 'opacity-40' : ''}`}
                disabled={trainingPeriod === 'license_renewal'}
              />
              <span className="text-sm text-gray-500 whitespace-nowrap">hours / period</span>
            </div>
          </div>

          {/* Training Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-black" />
              Training Period
            </label>
            <div className="space-y-2">
              {PERIOD_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    trainingPeriod === opt.value
                      ? 'border-black bg-gray-100/50'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="training_period"
                    value={opt.value}
                    checked={trainingPeriod === opt.value}
                    onChange={() => setTrainingPeriod(opt.value)}
                    className="mt-0.5 accent-black"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                    {opt.value === 'fiscal_year' && trainingPeriod === 'fiscal_year' && (
                      <div className="mt-3 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-black" />
                        <label className="text-xs font-medium text-gray-700">Fiscal year starts in</label>
                        <select
                          value={fiscalStartMonth}
                          onChange={(e) => setFiscalStartMonth(Number(e.target.value))}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black"
                        >
                          {MONTH_NAMES.map((m, i) => (
                            <option key={i} value={i + 1}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4" /> Settings saved successfully
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={saving} className="btn-primary px-8">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Account */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Account</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Role</p>
              <p className="text-sm text-gray-500 mt-0.5">Administrator — full access to all features</p>
            </div>
            <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-black text-white">Admin</span>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black/10 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-black" />
            </div>
            <h2 className="font-semibold text-gray-900">Team Members</h2>
          </div>
          {userRole === 'admin' && (
            <button
              onClick={() => { setShowInvite(v => !v); setInviteError(null) }}
              className="flex items-center gap-1.5 text-sm font-medium text-black border border-gray-200 hover:border-black px-3 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Member
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInvite && userRole === 'admin' && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <form onSubmit={handleInvite} className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@organization.com"
                    className="input pl-9 text-sm"
                  />
                </div>
              </div>
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'admin' | 'viewer')}
                  className="input text-sm"
                >
                  <option value="viewer">Viewer — read only</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary text-sm px-3 py-2">
                  <X className="w-3.5 h-3.5" />
                </button>
                <button type="submit" disabled={inviting} className="btn-primary text-sm px-4 py-2">
                  {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Invite'}
                </button>
              </div>
            </form>
            {inviteError && <p className="text-red-600 text-xs mt-2">{inviteError}</p>}
          </div>
        )}

        {inviteDone && (
          <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" /> Invite sent! They'll receive an email to set up their account.
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {loadingTeam ? (
            <div className="px-6 py-4 text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading team…
            </div>
          ) : members.length === 0 ? (
            <div className="px-6 py-4 text-sm text-gray-400">No team members found.</div>
          ) : members.map(member => (
            <div key={member.id} className="px-6 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                {member.role === 'admin'
                  ? <Crown className="w-4 h-4 text-black" />
                  : <Eye className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{member.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {member.role === 'admin' ? 'Admin — full access' : 'Viewer — read only'}
                  {member.id === currentUserId && <span className="ml-1.5 text-gray-300">(you)</span>}
                </p>
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
                member.role === 'admin' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {member.role}
              </span>
              {userRole === 'admin' && member.id !== currentUserId && (
                <button
                  onClick={() => handleRemove(member.id)}
                  disabled={removingId === member.id}
                  className="text-gray-300 hover:text-red-500 transition p-1.5 rounded-lg hover:bg-red-50"
                  title="Remove member"
                >
                  {removingId === member.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-red-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <h2 className="font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* Undo last import */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-gray-900">Undo last import</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Removes only the employees, courses, and records created in the most recent import batch.
                Use this if a file imported incorrectly and you want to try again.
              </p>
              {undoImportDone && (
                <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Last import removed successfully.
                </p>
              )}
              {undoImportError && <p className="text-sm text-red-600 mt-2">{undoImportError}</p>}
            </div>
            <button
              onClick={() => { setShowUndoModal(true); setUndoImportDone(false); setUndoImportError(null) }}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Undo Last Import
            </button>
          </div>

          <div className="border-t border-gray-100" />

          {/* Clear all data */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-gray-900">Clear all data</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Permanently deletes every employee, course, and training record for this organization.
                This cannot be undone.
              </p>
              {clearDone && (
                <p className="text-sm text-green-700 font-medium mt-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> All data cleared successfully.
                </p>
              )}
              {clearError && <p className="text-sm text-red-600 mt-2">{clearError}</p>}
            </div>
            <button
              onClick={() => { setShowClearModal(true); setClearDone(false); setClearError(null) }}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear All Data
            </button>
          </div>
        </div>
      </div>

      {/* ── Undo Last Import Modal ── */}
      {showUndoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Undo last import?</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                This will find and delete every employee, course, and training record that was created
                in the most recent import. Data added manually or from earlier imports will not be affected.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUndoModal(false)}
                  disabled={undoingImport}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUndoLastImport}
                  disabled={undoingImport}
                  className="flex-1 bg-orange-500 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-orange-600 transition disabled:opacity-60 text-sm"
                >
                  {undoingImport ? 'Removing…' : 'Yes, undo import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear All Data Modal ── */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Delete all data?</h3>
              </div>
              <p className="text-sm text-gray-600 mb-1">This will permanently delete:</p>
              <ul className="text-sm text-gray-600 mb-5 mt-2 space-y-1 ml-2">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> All employees</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> All courses</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> All training records and certificates</li>
              </ul>
              <p className="text-xs text-red-600 font-medium mb-5">This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex-1 bg-red-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-red-700 transition disabled:opacity-60 text-sm"
                >
                  {clearing ? 'Deleting…' : 'Yes, delete everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
