'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Library,
  AlertTriangle,
  Settings,
  LogOut,
  Upload,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { TrainTrackIcon } from '@/components/traintrack-logo'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/training-log', label: 'Training Log', icon: BookOpen },
  { href: '/courses', label: 'Course Library', icon: Library },
  { href: '/expiring-soon', label: 'Expiring Soon', icon: AlertTriangle },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/import', label: 'Import Data', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({
  agencyName,
  userEmail,
}: {
  agencyName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-black flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <TrainTrackIcon size={34} />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-none tracking-[0.08em] uppercase">TrackReady<span className="text-[#E24B4A]">PRO</span></p>
            <p className="text-[#E24B4A] text-[9px] font-semibold tracking-[0.15em] uppercase mt-0.5">Compliance Tracker</p>
            <p className="text-gray-400 text-[10px] mt-1 truncate leading-none">{agencyName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-white/15 text-white'
                  : 'text-gray-300 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-400'}`} />
              {label}
              {href === '/expiring-soon' && (
                <ExpiringBadge />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {getInitials(userEmail.split('@')[0])}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{userEmail}</p>
            <p className="text-gray-500 text-[10px]">Admin</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white transition p-1 rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

// Small async-rendered badge showing expiring cert count
function ExpiringBadge() {
  // Rendered client-side via useEffect in a parent or just a placeholder
  // Real count loaded per page — we'll keep sidebar stateless
  return null
}
