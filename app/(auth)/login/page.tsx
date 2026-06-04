'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TrainTrackIcon } from '@/components/traintrack-logo'

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
        <div className="flex items-center gap-3">
          <TrainTrackIcon size={38} />
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-[0.08em] uppercase">TrackReady<span className="text-[#E24B4A]">PRO</span></p>
            <p className="text-[#E24B4A] text-[10px] font-semibold tracking-[0.15em] uppercase mt-0.5">Compliance Tracker</p>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            DSP Training<br />Compliance,<br />Simplified.
          </h1>
          <p className="text-gray-300 text-lg">
            Track certifications, manage training hours, and keep your team compliant — all in one place.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Required Hours', value: '24/yr' },
            { label: 'Cert Tracking', value: '100%' },
            { label: 'Agencies', value: 'OR I/DD' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 rounded-xl p-4">
              <p className="text-white font-bold text-2xl">{stat.value}</p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <TrainTrackIcon size={36} dark />
            <div>
              <p className="font-bold text-sm leading-none text-black tracking-[0.08em] uppercase">TrackReady<span className="text-[#E24B4A]">PRO</span></p>
              <p className="text-[#E24B4A] text-[10px] font-semibold tracking-[0.15em] uppercase mt-0.5">Compliance Tracker</p>
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
