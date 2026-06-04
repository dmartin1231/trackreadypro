'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, Clock } from 'lucide-react'
import { TrainTrackIcon } from '@/components/traintrack-logo'
import type { SupabaseClient } from '@supabase/supabase-js'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'account' | 'agency'>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [requiredHours, setRequiredHours] = useState('24')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Single client instance shared across both steps so session persists
  const supabaseRef = useRef<SupabaseClient | null>(null)
  function getClient(): SupabaseClient {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = getClient()
    const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }

    // If signUp didn't return a session, sign in to get one
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError('Check your email for a confirmation link, then return to sign in.')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    setStep('agency')
  }

  async function handleCreateAgency(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Get the current session token to pass to the API route
    const { data: { session } } = await getClient().auth.getSession()
    if (!session) {
      setError('Session expired — please go back to step 1 and sign in again.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agencyName, requiredHours, accessToken: session.access_token }),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1740] via-black to-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <TrainTrackIcon size={52} />
          </div>
          <h1 className="text-white font-bold text-xl tracking-[0.08em] uppercase">TrackReady<span className="text-[#E24B4A]">PRO</span></h1>
          <p className="text-[#E24B4A] text-xs font-semibold tracking-[0.18em] uppercase mt-1">Compliance Tracker</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex-1 h-1.5 rounded-full bg-white" />
          <div className={`flex-1 h-1.5 rounded-full ${step === 'agency' ? 'bg-white' : 'bg-white/30'}`} />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {step === 'account' ? (
            <>
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="font-bold text-lg text-gray-900">Create your account</h2>
                <p className="text-gray-500 text-sm mt-0.5">Step 1 of 2 — Admin credentials</p>
              </div>
              <form onSubmit={handleCreateAccount} className="px-6 py-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="admin@agency.org"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="Min 8 characters"
                  />
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Creating account…' : 'Continue →'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="font-bold text-lg text-gray-900">Set up your agency</h2>
                <p className="text-gray-500 text-sm mt-0.5">Step 2 of 2 — Agency details</p>
              </div>
              <form onSubmit={handleCreateAgency} className="px-6 py-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Building2 className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                    Agency Name *
                  </label>
                  <input
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="input"
                    placeholder="e.g. Cascade Support Services"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Clock className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                    Required Training Hours / Year *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={requiredHours}
                    onChange={(e) => setRequiredHours(e.target.value)}
                    className="input"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Oregon I/DD standard is 24 hours</p>
                </div>
                {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Setting up…' : 'Launch ClearPath →'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-white font-medium hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
