'use client'

import Link from 'next/link'
import { AlertTriangle, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { differenceInDays, parseISO } from 'date-fns'

type Props = {
  trialEndsAt: string | null
  planType: string | null
  subscriptionStatus: string | null
}

export default function TrialBanner({ trialEndsAt, planType, subscriptionStatus }: Props) {
  const [dismissed, setDismissed] = useState(false)

  // Don't show if active paid subscription
  const isPaid = subscriptionStatus === 'active' && planType !== 'trial'
  if (isPaid || dismissed) return null

  const isExpiredLock = planType === 'trial' && subscriptionStatus === 'canceled'

  let daysLeft = 0
  if (trialEndsAt) {
    daysLeft = differenceInDays(parseISO(trialEndsAt), new Date())
  } else if (planType === 'trial' && !trialEndsAt) {
    // No trial end date set yet — still show a generic trial banner
  }

  const isUrgent = daysLeft <= 2 && daysLeft >= 0
  const isExpired = daysLeft < 0 || isExpiredLock

  if (isExpired) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">
          Your trial has ended. Add a payment method to restore full access.
        </p>
        <Link
          href="/pricing"
          className="flex-shrink-0 bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
        >
          Choose a plan →
        </Link>
      </div>
    )
  }

  if (isUrgent) {
    return (
      <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">
          <span className="font-bold">Trial ending soon!</span>{' '}
          {daysLeft === 0 ? 'Your trial expires today.' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left.`}{' '}
          Add a payment method now to avoid losing access.
        </p>
        <Link
          href="/pricing"
          className="flex-shrink-0 bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
        >
          Upgrade now →
        </Link>
        <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  // Normal trial banner
  return (
    <div className="bg-black text-white px-4 py-2.5 flex items-center gap-3">
      <Zap className="w-3.5 h-3.5 text-[#E24B4A] flex-shrink-0" />
      <p className="text-sm flex-1">
        <span className="font-semibold">Free trial</span>
        {trialEndsAt && daysLeft >= 0
          ? ` — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
          : ''}
        <span className="text-gray-400 ml-1.5">· No credit card required during trial</span>
      </p>
      <Link
        href="/pricing"
        className="flex-shrink-0 text-[#E24B4A] text-xs font-bold hover:text-red-400 transition whitespace-nowrap"
      >
        View plans →
      </Link>
      <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-white ml-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
