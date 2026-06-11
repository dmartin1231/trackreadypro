'use client'

import Link from 'next/link'
import { X, Zap } from 'lucide-react'
import { getPlanName } from '@/lib/plans'

export default function PlanLimitModal({
  currentPlan,
  maxEmployees,
  onClose,
}: {
  currentPlan: string | null
  maxEmployees: number
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="w-14 h-14 bg-[#E24B4A]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Zap className="w-7 h-7 text-[#E24B4A]" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Plan limit reached</h3>
        <p className="text-gray-500 text-sm mb-6">
          Your <span className="font-semibold">{getPlanName(currentPlan)}</span> plan supports up to{' '}
          <span className="font-semibold">{maxEmployees} employees</span>.
          Upgrade your plan to add more team members.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <Link href="/pricing" className="btn-primary flex-1 text-center">
            Upgrade plan →
          </Link>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
