'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrainTrackIcon } from '@/components/traintrack-logo'
import { CheckCircle2, Clock, FileBarChart2, ArrowLeft, Mail } from 'lucide-react'

const features = [
  {
    icon: CheckCircle2,
    title: 'Track completions & hours',
    desc: 'Log training records for every employee and watch compliance build in real time.',
  },
  {
    icon: Clock,
    title: 'Never miss an expiration',
    desc: 'Automatic alerts before certifications lapse so renewals never slip through the cracks.',
  },
  {
    icon: FileBarChart2,
    title: 'Audit-ready reports',
    desc: 'Generate compliance summaries, transcripts, and gap reports in seconds.',
  },
]

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}
    >
      {children}
    </div>
  )
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'Incorrect email or password. Please try again.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email address before signing in.'
  if (m.includes('too many requests') || m.includes('rate limit'))
    return 'Too many attempts. Please wait a few minutes and try again.'
  if (m.includes('user not found'))
    return 'No account found with that email address.'
  if (m.includes('network') || m.includes('fetch'))
    return 'Connection error. Please check your internet and try again.'
  return msg
}

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'forgot' | 'forgot_sent'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Show error if password reset link expired
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'link_expired') {
      setError('Your reset link has expired. Please request a new one.')
      setMode('forgot')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(friendlyError(authError.message))
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (resetError) {
        setError(friendlyError(resetError.message))
        return
      }
      setMode('forgot_sent')
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-12">
        <FadeUp delay={0}>
          <div className="flex items-center gap-3">
            <TrainTrackIcon size={38} />
            <div>
              <p className="text-white font-bold text-sm leading-none tracking-[0.08em] uppercase">
                TrackReady<span className="text-[#E24B4A]">PRO</span>
              </p>
              <p className="text-[#E24B4A] text-[10px] font-semibold tracking-[0.15em] uppercase mt-0.5">
                Compliance Tracker
              </p>
            </div>
          </div>
        </FadeUp>

        <div className="space-y-6">
          <FadeUp delay={150}>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Employee Training<br />Compliance,<br />Simplified.
            </h1>
          </FadeUp>

          <FadeUp delay={300}>
            <p className="text-gray-300 text-lg leading-relaxed">
              TrackReady PRO helps organizations manage staff training records,
              monitor certification deadlines, and stay audit-ready — all in one place.
            </p>
          </FadeUp>

          <div className="space-y-4 pt-2">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <FadeUp key={title} delay={450 + i * 130}>
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-[#E24B4A]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-gray-400 text-sm leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>

        <FadeUp delay={900}>
          <p className="text-gray-600 text-xs">
            Secure · Multi-tenant · Built for compliance-driven teams
          </p>
        </FadeUp>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
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

          {/* ── Sign in ── */}
          {mode === 'login' && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-gray-500 mb-8">Sign in to your account</p>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@organization.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null) }}
                      className="text-xs text-gray-400 hover:text-black transition"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                New organization?{' '}
                <a href="/setup" className="text-black font-medium hover:underline">
                  Set up your account
                </a>
              </p>
            </>
          )}

          {/* ── Forgot password ── */}
          {mode === 'forgot' && (
            <>
              <button
                onClick={() => { setMode('login'); setError(null) }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-black transition mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-1">Reset your password</h2>
              <p className="text-gray-500 mb-8">
                Enter your email and we&apos;ll send you a link to choose a new password.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@organization.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-900 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          {/* ── Email sent ── */}
          {mode === 'forgot_sent' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 mb-2">
                We sent a password reset link to:
              </p>
              <p className="font-semibold text-gray-900 mb-6">{email}</p>
              <p className="text-sm text-gray-400 mb-8">
                Didn&apos;t get it? Check your spam folder, or{' '}
                <button
                  onClick={() => { setMode('forgot'); setError(null) }}
                  className="text-black underline hover:no-underline"
                >
                  try again
                </button>
                .
              </p>
              <button
                onClick={() => { setMode('login'); setError(null) }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-black transition mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
