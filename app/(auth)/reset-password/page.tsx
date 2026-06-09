'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrainTrackIcon } from '@/components/traintrack-logo'
import { CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [stage, setStage] = useState<'verifying' | 'form' | 'done' | 'error'>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let resolved = false

    function resolve(success: boolean, msg = '') {
      if (resolved) return
      resolved = true
      if (success) {
        setStage('form')
      } else {
        setErrorMsg(msg || 'This reset link has expired or already been used. Please request a new one.')
        setStage('error')
      }
    }

    // Handle hash-fragment flow: Supabase fires PASSWORD_RECOVERY when it
    // processes #access_token=...&type=recovery from the email link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        resolve(true)
      }
    })

    // Also handle PKCE code flow (?code= in URL)
    async function tryCodeExchange() {
      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) return
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) resolve(true)
      } catch { /* let timeout handle it */ }
    }
    tryCodeExchange()

    // If nothing fires after 5 seconds the link is bad
    const timeout = setTimeout(() => resolve(false), 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return }
    setLoading(true)
    setErrorMsg('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setErrorMsg(error.message); return }
      setStage('done')
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">

        <div className="flex items-center gap-3 mb-10">
          <TrainTrackIcon size={36} dark />
          <div>
            <p className="font-bold text-sm leading-none text-black tracking-[0.08em] uppercase">
              TrackReady<span className="text-[#E24B4A]">PRO</span>
            </p>
            <p className="text-[#E24B4A] text-[10px] font-semibold tracking-[0.15em] uppercase mt-0.5">
              Compliance Tracker
            </p>
          </div>
        </div>

        {stage === 'verifying' && (
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying reset link…
          </div>
        )}

        {stage === 'error' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link not valid</h2>
            <p className="text-red-600 text-sm mb-6">{errorMsg}</p>
            <a
              href="/login"
              className="inline-block bg-black text-white font-medium py-2.5 px-6 rounded-lg hover:bg-gray-900 transition text-sm"
            >
              ← Back to sign in
            </a>
          </div>
        )}

        {stage === 'form' && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose a new password</h2>
            <p className="text-gray-500 mb-8">Must be at least 8 characters.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                />
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}

        {stage === 'done' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h2>
            <p className="text-gray-500">Redirecting you to your dashboard…</p>
          </div>
        )}

      </div>
    </div>
  )
}
