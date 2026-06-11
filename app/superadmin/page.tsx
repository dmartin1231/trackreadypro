'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Users, Building2, DollarSign, AlertTriangle,
  Search, RefreshCw, ChevronDown, Mail, Trash2,
  ShieldOff, ShieldCheck, Loader2, Bell, XCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { getPlanName } from '@/lib/plans'
import { differenceInDays, parseISO } from 'date-fns'

type Agency = {
  id: string; name: string; owner_email: string
  plan_type: string | null; subscription_status: string | null
  trial_ends_at: string | null; employee_count: number; record_count: number
  created_at: string; stripe_customer_id: string | null; stripe_subscription_id: string | null
}
type Stats = {
  totalAgencies: number; activeAgencies: number; trialAgencies: number
  canceledAgencies: number; newThisMonth: number; newThisWeek: number
  totalEmployees: number; totalRecords: number; conversionRate: number
  expiringTrials: Array<{ id: string; name: string; trial_ends_at: string }>
}
type Revenue = {
  mrr: number; arr: number; months: Array<{ month: string; revenue: number }>
  thisMonth: number; lastMonth: number; change: number; failedThisMonth: number
}

function StatCard({ label, value, sub, color = 'white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-400', red: 'text-red-400', white: 'text-white', gray: 'text-gray-400',
  }
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function statusBadge(status: string | null) {
  const map: Record<string, string> = {
    active: 'bg-green-900/60 text-green-400',
    trialing: 'bg-blue-900/60 text-blue-400',
    past_due: 'bg-red-900/60 text-red-400',
    canceled: 'bg-gray-800 text-gray-500',
  }
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${map[status ?? ''] ?? 'bg-gray-800 text-gray-500'}`}>
      {status ?? '—'}
    </span>
  )
}

export default function SuperAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [statsRes, revRes, agRes] = await Promise.all([
      fetch('/api/superadmin/stats'),
      fetch('/api/superadmin/revenue'),
      fetch('/api/superadmin/agencies'),
    ])
    setStats(await statsRes.json())
    setRevenue(await revRes.json())
    const { agencies: ags } = await agRes.json()
    setAgencies(ags ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function doAction(action: string, agencyId: string, extra?: Record<string, unknown>) {
    setActionLoading(`${action}-${agencyId}`)
    await fetch('/api/superadmin/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, agencyId, ...extra }),
    })
    await load()
    setActionLoading(null)
  }

  const filtered = agencies.filter(a => {
    const q = search.toLowerCase()
    const matchQ = !q || a.name.toLowerCase().includes(q) || a.owner_email.toLowerCase().includes(q)
    const matchPlan = !filterPlan || a.plan_type === filterPlan
    const matchStatus = !filterStatus || a.subscription_status === filterStatus
    return matchQ && matchPlan && matchStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Super Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Platform overview · TrackReady PRO</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm border border-gray-700 px-3 py-2 rounded-lg transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Monthly Recurring Revenue" value={`$${(revenue?.mrr ?? 0).toLocaleString()}`} color="green"
          sub={`ARR: $${((revenue?.arr ?? 0)).toLocaleString()}`} />
        <StatCard label="Revenue This Month" value={`$${(revenue?.thisMonth ?? 0).toLocaleString()}`} color="green"
          sub={revenue?.change !== undefined ? `${revenue.change >= 0 ? '+' : ''}${revenue.change}% vs last month` : ''} />
        <StatCard label="Failed Payments" value={revenue?.failedThisMonth ?? 0} color="red" sub="This month" />
        <StatCard label="Conversion Rate" value={`${stats?.conversionRate ?? 0}%`} color="green" sub="Trial → paid" />
      </div>

      {/* Revenue chart */}
      {revenue?.months && revenue.months.length > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-5">Revenue — Last 12 Months</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue.months} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#f9fafb' }}
                formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Agencies" value={stats?.totalAgencies ?? 0} />
        <StatCard label="Active (Paying)" value={stats?.activeAgencies ?? 0} color="green" />
        <StatCard label="On Trial" value={stats?.trialAgencies ?? 0} color="white" />
        <StatCard label="Canceled" value={stats?.canceledAgencies ?? 0} color="red" />
        <StatCard label="New This Month" value={stats?.newThisMonth ?? 0} />
        <StatCard label="New This Week" value={stats?.newThisWeek ?? 0} />
        <StatCard label="Total Employees" value={(stats?.totalEmployees ?? 0).toLocaleString()} />
        <StatCard label="Training Records" value={(stats?.totalRecords ?? 0).toLocaleString()} />
      </div>

      {/* Notifications */}
      {(stats?.expiringTrials ?? []).length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-yellow-300">Trials expiring within 3 days</h2>
          </div>
          <div className="space-y-2">
            {stats!.expiringTrials.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-yellow-200">{t.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-500 text-xs">
                    {Math.max(0, differenceInDays(parseISO(t.trial_ends_at), new Date()))}d left
                  </span>
                  <button
                    onClick={() => doAction('extend_trial', t.id, { days: 7 })}
                    disabled={!!actionLoading}
                    className="text-xs text-yellow-400 hover:text-yellow-200 border border-yellow-700/50 px-2 py-1 rounded-lg transition"
                  >
                    +7 days
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agency table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <Building2 className="w-5 h-5 text-[#E24B4A]" />
            <h2 className="font-semibold text-white">All Agencies</h2>
            <span className="text-gray-500 text-sm">({filtered.length})</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search agencies…"
                className="pl-8 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-600 w-52"
              />
            </div>
            <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
              className="text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 focus:outline-none">
              <option value="">All plans</option>
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="agency">Agency</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 focus:outline-none">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Agency', 'Owner', 'Plan', 'Status', 'Trial End', 'Employees', 'Records', 'Signed Up', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.map(agency => {
                const isLoading = (s: string) => actionLoading === `${s}-${agency.id}`
                return (
                  <tr key={agency.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{agency.name}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{agency.owner_email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-300 text-xs">{getPlanName(agency.plan_type)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{statusBadge(agency.subscription_status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {agency.trial_ends_at ? formatDate(agency.trial_ends_at.split('T')[0]) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-center">{agency.employee_count}</td>
                    <td className="px-4 py-3 text-gray-300 text-center">{agency.record_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(agency.created_at.split('T')[0])}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Extend trial */}
                        <button
                          onClick={() => doAction('extend_trial', agency.id, { days: 7 })}
                          disabled={!!actionLoading}
                          title="+7 days trial"
                          className="text-blue-400 hover:text-blue-300 p-1.5 rounded hover:bg-blue-900/20 transition"
                        >
                          {isLoading('extend_trial') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </button>
                        {/* Suspend / unsuspend */}
                        {agency.subscription_status === 'canceled' ? (
                          <button onClick={() => doAction('unsuspend', agency.id)} disabled={!!actionLoading}
                            title="Unsuspend" className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-green-900/20 transition">
                            {isLoading('unsuspend') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <button onClick={() => doAction('suspend', agency.id)} disabled={!!actionLoading}
                            title="Suspend" className="text-orange-400 hover:text-orange-300 p-1.5 rounded hover:bg-orange-900/20 transition">
                            {isLoading('suspend') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {/* Delete */}
                        <button
                          onClick={() => { if (confirm(`Delete "${agency.name}" and ALL their data? This cannot be undone.`)) doAction('delete', agency.id) }}
                          disabled={!!actionLoading}
                          title="Delete agency"
                          className="text-red-500 hover:text-red-400 p-1.5 rounded hover:bg-red-900/20 transition"
                        >
                          {isLoading('delete') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-600">No agencies found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
