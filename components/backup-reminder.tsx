'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, X } from 'lucide-react'

const STORAGE_KEY   = 'trackreadypro_last_backup'
const DISMISS_KEY   = 'trackreadypro_backup_dismissed_at'
const WEEK_MS       = 7 * 24 * 60 * 60 * 1000
const DISMISS_MS    = 24 * 60 * 60 * 1000  // re-show after 24 h if still overdue

export default function BackupReminder() {
  const [show, setShow] = useState(false)
  const [label, setLabel] = useState('')

  useEffect(() => {
    const lastBackup   = localStorage.getItem(STORAGE_KEY)
    const dismissedAt  = localStorage.getItem(DISMISS_KEY)

    const now          = Date.now()
    const backupAge    = lastBackup  ? now - new Date(lastBackup).getTime()  : Infinity
    const dismissedAge = dismissedAt ? now - new Date(dismissedAt).getTime() : Infinity

    const isDue        = backupAge > WEEK_MS
    const wasDismissed = dismissedAge < DISMISS_MS

    if (!isDue || wasDismissed) return

    if (!lastBackup) {
      setLabel('You have never saved a backup.')
    } else {
      const days = Math.floor(backupAge / (24 * 60 * 60 * 1000))
      setLabel(`Your last backup was ${days} day${days !== 1 ? 's' : ''} ago.`)
    }
    setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <ShieldCheck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
      <p className="text-sm text-indigo-800 font-medium flex-1">
        {label}{' '}
        <span className="font-normal text-indigo-700">Regular backups protect against accidental data loss.</span>
      </p>
      <Link
        href="/import"
        className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 whitespace-nowrap border border-indigo-300 hover:border-indigo-500 px-2.5 py-1 rounded-lg transition-colors"
      >
        Back up now →
      </Link>
      <button onClick={dismiss} className="text-indigo-400 hover:text-indigo-700 transition-colors ml-1" title="Dismiss for today">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
