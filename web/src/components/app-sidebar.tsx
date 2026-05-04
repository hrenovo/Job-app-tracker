import {
  BarChart3Icon,
  BriefcaseIcon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageSquareIcon,
  SettingsIcon,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { NavMain } from '@/components/nav-main'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/lib/auth'
import type { User } from '@/lib/api'

interface AppSidebarProps {
  user: User
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { logout } = useAuth()
  const queryClient = useQueryClient()

  const navMain = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboardIcon },
    { title: 'Applications', url: '/applications', icon: BriefcaseIcon },
    { title: 'Interviews', url: '/interviews', icon: MessageSquareIcon },
    { title: 'Calendar', url: '/calendar', icon: CalendarDaysIcon },
    { title: 'Insights', url: '/insights', icon: BarChart3Icon },
    { title: 'Settings', url: '/settings', icon: SettingsIcon },
  ]

  const handleLogout = async () => {
    await logout()
    queryClient.clear()
    window.location.replace('/login')
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2 cursor-default">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BriefcaseIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-sidebar-foreground">Job Tracker</span>
                  <span className="truncate text-xs text-sidebar-foreground/60">Career Manager</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1">
          <div className="group-data-[collapsible=icon]:hidden mb-2 px-2">
            <p className="text-xs font-medium text-sidebar-foreground/80 truncate">{user.username}</p>
            {user.email && (
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
            )}
          </div>
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:justify-center">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group-data-[collapsible=icon]:px-2"
              title="Sign out"
            >
              <LogOutIcon className="size-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
