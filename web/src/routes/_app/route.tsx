import { useEffect } from 'react'
import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    // Fast sync check — if no token, redirect immediately
    if (!localStorage.getItem('access_token')) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuth()

  // Reactive guard: handle token expiry mid-session
  useEffect(() => {
    if (!isLoading && !user) {
      queryClient.clear()
      navigate({ to: '/login' })
    }
  }, [isLoading, user, navigate, queryClient])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return null

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="flex flex-col">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
