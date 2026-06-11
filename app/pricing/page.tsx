'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Zap, ArrowLeft, Loader2 } from 'lucide-react'
import { PLANS, PLAN_ORDER, type PlanKey } from '@/lib/plans'
import { TrainTrackIcon } from '@/components/traintrack-logo'
import Link from 'next/link'

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function subscribe(planKey: PlanKey) {
    setLoading(planKey)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        setError(json.error ?? 'Something went wrong')
        return
      }
      window.location.href = json.url
    } finally {
      setLoading(null)
    }
  }

  const popular: PlanKey = 'professional'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-black px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <TrainTrackIcon size={32} />
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-[0.08em] uppercase">
              TrackReady<span className="text-[#E24B4A]">PRO</span>
            </p>
            <p className="text-[#E24B4A] text-[9px] font-semibold tracking-[0.15em] uppercase mt-0.5">
              Compliance Tracker
            </p>
          </div>
        </Link>
        <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-[#E24B4A]/10 text-[#E24B4A] text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
            <Zap className="w-3.5 h-3.5" />
            15-day free trial · No credit card required
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Choose the plan that fits your team. Start free for 15 days, cancel anytime.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {PLAN_ORDER.map((key) => {
            const plan = PLANS[key]
            const isPopular = key === popular
            return (
              <div
                key={key}
                className={`relative rounded-2xl overflow-hidden flex flex-col ${
                  isPopular
                    ? 'bg-black text-white shadow-2xl scale-105 ring-2 ring-[#E24B4A]'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}
              >
                {isPopular && (
                  <div className="bg-[#E24B4A] text-white text-[10px] font-bold uppercase tracking-widest text-center py-1.5">
                    Most Popular
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h3 className={`text-lg font-bold mb-1 ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h3>
                    <p className={`text-sm ${isPopular ? 'text-gray-400' : 'text-gray-400'}`}>
                      Up to {plan.maxEmployees === Infinity ? 'unlimited' : plan.maxEmployees} employees
                    </p>
                  </div>

                  <div className="mb-6">
                    <span className={`text-4xl font-bold ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                      ${plan.price}
                    </span>
                    <span className={`text-sm ml-1 ${isPopular ? 'text-gray-400' : 'text-gray-500'}`}>/mo</span>
                  </div>

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPopular ? 'text-[#E24B4A]' : 'text-green-500'}`} />
                        <span className={`text-sm ${isPopular ? 'text-gray-300' : 'text-gray-600'}`}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => subscribe(key)}
                    disabled={loading !== null}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 ${
                      isPopular
                        ? 'bg-[#E24B4A] hover:bg-[#c93d3d] text-white'
                        : 'bg-black hover:bg-gray-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {loading === key ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading === key ? 'Redirecting…' : 'Start free trial'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="text-center text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-md mx-auto">
            {error}
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-gray-400 text-sm mt-8">
          All plans include a 15-day free trial. No credit card required to start.
          Cancel anytime. Billed monthly.
        </p>

        {/* FAQ */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            { q: 'What counts as an employee?', a: 'Any active employee added to your TrackReady PRO account. You can archive employees who no longer need tracking without them counting toward your limit.' },
            { q: 'Can I upgrade or downgrade anytime?', a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your billing period. Stripe handles proration automatically.' },
            { q: 'What happens when my trial ends?', a: 'Your account is locked for read-only access. Add a payment method at any time to reactivate. Your data is never deleted.' },
          ].map(({ q, a }) => (
            <div key={q}>
              <h4 className="font-semibold text-gray-900 mb-2">{q}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
