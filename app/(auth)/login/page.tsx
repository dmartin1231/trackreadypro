'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrainTrackIcon } from '@/components/traintrack-logo'
import { CheckCircle2, Clock, FileBarChart2 } from 'lucide-react'

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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
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

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 mb-8">Sign in to your admin account</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@agency.org"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            New agency?{' '}
            <a href="/setup" className="text-black font-medium hover:underline">
              Set up your account
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
