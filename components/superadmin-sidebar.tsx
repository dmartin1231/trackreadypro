'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, LogOut, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TrainTrackIcon } from '@/components/traintrack-logo'

const navItems = [
  { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/superadmin/agencies', label: 'Agencies', icon: Building2 },
]

export default function SuperAdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-black flex flex-col h-full border-r border-[#E24B4A]/30">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#E24B4A]/30">
        <div className="flex items-center gap-2.5">
          <TrainTrackIcon size={32} />
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-[0.08em] uppercase">
              TrackReady<span className="text-[#E24B4A]">PRO</span>
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <ShieldAlert className="w-3 h-3 text-[#E24B4A]" />
              <p className="text-[#E24B4A] text-[9px] font-bold tracking-[0.15em] uppercase">Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[#E24B4A]/60 text-[10px] font-semibold uppercase tracking-widest px-3 mb-2">
          Admin Panel
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/superadmin' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-[#E24B4A]/20 text-[#E24B4A]'
                  : 'text-gray-400 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#E24B4A]' : 'text-gray-500'}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[#E24B4A]/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E24B4A]/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-4 h-4 text-[#E24B4A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{userEmail}</p>
            <p className="text-[#E24B4A] text-[10px] font-semibold">Super Admin</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-white transition p-1 rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
