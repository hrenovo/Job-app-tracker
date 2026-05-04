import { useEffect } from 'react'
import { Outlet, ScrollRestoration, createRootRoute } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth'

export const Route = createRootRoute({
  component: Root,
})

function Root() {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  return (
    <ThemeProvider defaultTheme="system" storageKey="cayuUiTheme">
      <AuthProvider>
        <ScrollRestoration />
        <div className="bg-background">
          <Outlet />
        </div>
        <Toaster position="top-right" />
      </AuthProvider>
    </ThemeProvider>
  )
}
