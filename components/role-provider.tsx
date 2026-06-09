'use client'

import { createContext, useContext } from 'react'

type Role = 'admin' | 'viewer'
const RoleContext = createContext<Role>('viewer')

export function RoleProvider({ role, children }: { role: string; children: React.ReactNode }) {
  return (
    <RoleContext.Provider value={(role as Role) ?? 'viewer'}>
      {children}
    </RoleContext.Provider>
  )
}

export function useUserRole(): Role {
  return useContext(RoleContext)
}
