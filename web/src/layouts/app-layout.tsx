import type { ReactNode } from 'react'

// Superseded by routes/_app/route.tsx which handles auth + sidebar.
export function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
