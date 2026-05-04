import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type DashboardStats } from '@/lib/api'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  BriefcaseIcon,
  TrendingUpIcon,
  CalendarIcon,
  TrophyIcon,
  ActivityIcon,
  SparklesIcon,
  RefreshCwIcon,
} from 'lucide-react'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-blue-500',
  screening: 'bg-indigo-500',
  technical: 'bg-violet-500',
  hr_interview: 'bg-purple-500',
  final_round: 'bg-fuchsia-500',
  offer: 'bg-emerald-500',
  rejected: 'bg-red-400',
  withdrawn: 'bg-gray-400',
}

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  technical: 'Technical',
  hr_interview: 'HR Interview',
  final_round: 'Final Round',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  hr: 'HR',
  on_site: 'On Site',
  final_round: 'Final Round',
  take_home: 'Take Home',
  other: 'Other',
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  color = 'text-primary',
}: {
  title: string
  value: string | number
  icon: React.ElementType
  sub?: string
  color?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="size-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAiTips, setShowAiTips] = useState(false)

  const { data: stats, isPending } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/tracker-stats/'),
  })

  const aiMutation = useMutation({
    mutationFn: (message: string) =>
      api.post<{ reply: string }>('/ai/chat/', {
        message,
        conversation_history: [],
      }),
  })

  const handleGetAiTips = () => {
    if (!stats) return
    setShowAiTips(true)
    const count = stats.upcoming_interviews_list.length
    const companies = stats.upcoming_interviews_list.map((i) => i.company).join(', ')
    const msg = count > 0
      ? `I have ${count} upcoming interviews${companies ? ` at ${companies}` : ''}. Give me 3 concise preparation tips as a bulleted list.`
      : `I have ${stats.total_applications} job applications in progress. Give me 3 tips to improve my job search.`
    aiMutation.mutate(msg)
  }

  const offerRate =
    stats && stats.total_applications > 0
      ? ((stats.offers / stats.total_applications) * 100).toFixed(1)
      : '0.0'

  const PIPELINE_STAGES = ['applied', 'screening', 'technical', 'hr_interview', 'final_round', 'offer']
  const maxPipelineCount = stats
    ? Math.max(...PIPELINE_STAGES.map((s) => stats.pipeline_breakdown[s] ?? 0), 1)
    : 1

  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Separator orientation="vertical" className="h-4 mr-3" />
        <h1 className="font-semibold text-lg">Dashboard</h1>
        <div className="ml-auto flex items-center gap-3">
          {stats && stats.upcoming_interviews > 0 && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
              🗓 {stats.upcoming_interviews} Upcoming Interview{stats.upcoming_interviews !== 1 ? 's' : ''}
            </Badge>
          )}
          <Button size="sm" onClick={() => navigate({ to: '/applications' })}>
            + New Application
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6 min-w-0">
        {/* Stats row */}
        {isPending ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Applications"
              value={stats?.total_applications ?? 0}
              icon={BriefcaseIcon}
            />
            <StatCard
              title="Active Pipeline"
              value={stats?.in_pipeline ?? 0}
              icon={ActivityIcon}
              sub="non-archived"
              color="text-violet-600"
            />
            <StatCard
              title="Upcoming Interviews"
              value={stats?.upcoming_interviews ?? 0}
              icon={CalendarIcon}
              sub="next 14 days"
              color="text-blue-600"
            />
            <StatCard
              title="Offers Received"
              value={stats?.offers ?? 0}
              icon={TrophyIcon}
              color="text-emerald-600"
            />
            <StatCard
              title="Response Rate"
              value={`${stats?.response_rate ?? 0}%`}
              icon={TrendingUpIcon}
              sub={`Offer rate: ${offerRate}%`}
              color="text-primary"
            />
          </div>
        )}

        {/* Two columns: Upcoming + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Interviews */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Upcoming Interviews</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : stats?.upcoming_interviews_list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming interviews scheduled.{' '}
                  <button
                    onClick={() => navigate({ to: '/interviews' })}
                    className="text-primary hover:underline"
                  >
                    Schedule one →
                  </button>
                </p>
              ) : (
                <div className="space-y-2">
                  {stats?.upcoming_interviews_list.map((iv) => (
                    <div
                      key={iv.id}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
                    >
                      <div className={`size-2 rounded-full ${STAGE_COLORS['technical']} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{iv.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{iv.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-xs mb-1">
                          {INTERVIEW_TYPE_LABELS[iv.interview_type] ?? iv.interview_type}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(iv.scheduled_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : stats?.recent_activity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No activity yet. Add an application to get started.</p>
              ) : (
                <div className="space-y-2">
                  {stats?.recent_activity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className={`size-2 rounded-full ${STAGE_COLORS[item.stage] ?? 'bg-gray-400'} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.role}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="secondary" className="text-xs mb-1">
                          {STAGE_LABELS[item.stage] ?? item.stage}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(item.last_activity), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Two columns: Pipeline Funnel + AI Prep */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Funnel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Pipeline Funnel</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isPending ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const count = stats?.pipeline_breakdown[stage] ?? 0
                    const pct = Math.round((count / maxPipelineCount) * 100)
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0 text-right">
                          {STAGE_LABELS[stage]}
                        </span>
                        <div className="flex-1 bg-secondary rounded-full h-6 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${STAGE_COLORS[stage] ?? 'bg-gray-400'} flex items-center px-2`}
                            style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                          >
                            {count > 0 && (
                              <span className="text-white text-xs font-medium">{count}</span>
                            )}
                          </div>
                        </div>
                        {count === 0 && (
                          <span className="text-xs text-muted-foreground w-4">0</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Prep Suggestions */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <SparklesIcon className="size-4 text-primary" />
                AI Prep Suggestions
              </CardTitle>
              {!showAiTips && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGetAiTips}
                  disabled={aiMutation.isPending}
                  className="text-xs"
                >
                  {aiMutation.isPending ? (
                    <RefreshCwIcon className="size-3 mr-1 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-3 mr-1" />
                  )}
                  Get Tips
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {!showAiTips && (
                <div className="text-center py-6 text-muted-foreground">
                  <SparklesIcon className="size-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Click "Get Tips" for AI-powered interview preparation advice.</p>
                </div>
              )}
              {aiMutation.isPending && (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              )}
              {aiMutation.isSuccess && aiMutation.data && (
                <div className="space-y-3">
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {aiMutation.data.reply}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={handleGetAiTips}
                  >
                    <RefreshCwIcon className="size-3 mr-1" />
                    Refresh Tips
                  </Button>
                </div>
              )}
              {aiMutation.isError && (
                <p className="text-sm text-destructive text-center py-4">
                  AI service not configured. Set it up in Settings.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
