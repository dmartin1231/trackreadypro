'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { formatDate, getExpirationDate } from '@/lib/utils'
import { addYears, differenceInDays, parseISO } from 'date-fns'
import type { Employee, Course, TrainingRecord } from '@/lib/types'

type ExpiringRecord = TrainingRecord & {
  employee: Employee
  course: Course
  expiration_date: string
  days_until_expiry: number
}

export default function ExpiringSoonPage() {
  const supabase = createClient()
  const router = useRouter()
  const [expired, setExpired] = useState<ExpiringRecord[]>([])
  const [expiring30, setExpiring30] = useState<ExpiringRecord[]>([])
  const [expiring60, setExpiring60] = useState<ExpiringRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('user_profiles').select('agency_id').eq('id', user.id).single()
    if (!profile?.agency_id) return

    const { data: records } = await supabase
      .from('training_records')
      .select('*, employee:employees(*), course:courses(*)')
      .eq('agency_id', profile.agency_id)

    const today = new Date()
    const exp: ExpiringRecord[] = []
    const e30: ExpiringRecord[] = []
    const e60: ExpiringRecord[] = []

    // Keep only the latest record per employee+course so a renewed cert
    // doesn't also show the old expired completion as a problem
    const sorted = [...(records ?? [])].sort((a, b) =>
      b.completed_date.localeCompare(a.completed_date)
    )
    const seen = new Set<string>()
    const latestRecords = sorted.filter((r: any) => {
      const key = `${r.employee_id}|${r.course_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    latestRecords.forEach((rec: TrainingRecord & { employee: Employee; course: Course }) => {
      if (!rec.course || rec.course.expires_years === null || rec.course.track_expiration === false) return
      const expDate = addYears(parseISO(rec.completed_date), rec.course.expires_years)
      const days = differenceInDays(expDate, today)
      const enriched: ExpiringRecord = {
        ...rec,
        expiration_date: expDate.toISOString().split('T')[0],
        days_until_expiry: days,
      }

      if (days < 0) exp.push(enriched)
      else if (days <= 30) e30.push(enriched)
      else if (days <= 60) e60.push(enriched)
    })

    setExpired(exp.sort((a, b) => a.days_until_expiry - b.days_until_expiry))
    setExpiring30(e30.sort((a, b) => a.days_until_expiry - b.days_until_expiry))
    setExpiring60(e60.sort((a, b) => a.days_until_expiry - b.days_until_expiry))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function handleRenew(rec: ExpiringRecord) {
    router.push(
      `/training-log?employee_id=${rec.employee_id}&course_id=${rec.course_id}`
    )
  }

  const totalCount = expired.length + expiring30.length + expiring60.length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Expiring Soon</h1>
        <p className="text-gray-500 text-sm mt-1">
          {totalCount === 0 ? 'All certifications are current' : `${totalCount} certifications need attention`}
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-green-500" />
          </div>
          <p className="font-semibold text-gray-900">All clear!</p>
          <p className="text-sm mt-1">No certifications are expiring within 60 days.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            title="Expired"
            icon={<AlertCircle className="w-5 h-5 text-red-500" />}
            color="red"
            records={expired}
            onRenew={handleRenew}
            daysLabel={(days) => `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`}
          />
          <Section
            title="Expiring Within 30 Days"
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
            color="orange"
            records={expiring30}
            onRenew={handleRenew}
            daysLabel={(days) => `${days} day${days !== 1 ? 's' : ''} left`}
          />
          <Section
            title="Expiring Within 60 Days"
            icon={<Clock className="w-5 h-5 text-yellow-500" />}
            color="yellow"
            records={expiring60}
            onRenew={handleRenew}
            daysLabel={(days) => `${days} day${days !== 1 ? 's' : ''} left`}
          />
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  color,
  records,
  onRenew,
  daysLabel,
}: {
  title: string
  icon: React.ReactNode
  color: 'red' | 'orange' | 'yellow'
  records: ExpiringRecord[]
  onRenew: (rec: ExpiringRecord) => void
  daysLabel: (days: number) => string
}) {
  if (records.length === 0) return null

  const borderColors = {
    red: 'border-red-200',
    orange: 'border-orange-200',
    yellow: 'border-yellow-200',
  }
  const headerColors = {
    red: 'bg-red-50 border-red-100',
    orange: 'bg-orange-50 border-orange-100',
    yellow: 'bg-yellow-50 border-yellow-100',
  }
  const badgeColors = {
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${borderColors[color]}`}>
      <div className={`px-6 py-4 border-b flex items-center gap-3 ${headerColors[color]}`}>
        {icon}
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <span className={`ml-auto inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeColors[color]}`}>
          {records.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {records.map((rec) => (
          <div key={rec.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
            <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {rec.employee.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900">{rec.employee.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {rec.course.name} · Expires {formatDate(rec.expiration_date)}
              </p>
            </div>
            <div className="text-right mr-4">
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColors[color]}`}>
                {daysLabel(rec.days_until_expiry)}
              </span>
            </div>
            <button
              onClick={() => onRenew(rec)}
              className="flex items-center gap-1.5 text-xs font-medium text-black hover:text-gray-900 border border-black/30 hover:border-black px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              <RefreshCw className="w-3 h-3" />
              Renew
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
