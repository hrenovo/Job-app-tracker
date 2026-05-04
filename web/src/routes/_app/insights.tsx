import { useState, useRef, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { SendIcon, BotIcon, UserIcon, SparklesIcon, BarChart3Icon } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type InsightsData } from '@/lib/api'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/insights')({
  component: InsightsPage,
})

// ── Chart colors (JS values, not CSS vars — Recharts SVG can't resolve CSS vars) ──

const CHART_COLORS = {
  primary: '#7c3aed',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
}

const STAGE_COLORS: Record<string, string> = {
  applied: CHART_COLORS.blue,
  screening: '#6366f1',
  technical: CHART_COLORS.primary,
  hr_interview: '#a855f7',
  final_round: '#d946ef',
  offer: CHART_COLORS.green,
  rejected: CHART_COLORS.red,
  withdrawn: CHART_COLORS.gray,
}

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied', screening: 'Screening', technical: 'Technical',
  hr_interview: 'HR Interview', final_round: 'Final Round',
  offer: 'Offer', rejected: 'Rejected', withdrawn: 'Withdrawn',
}

const SOURCE_COLORS = [
  CHART_COLORS.primary, CHART_COLORS.blue, CHART_COLORS.green,
  CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.gray,
]

// ── AI Chat ───────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  { icon: '💡', label: 'Coach me', prompt: 'Give me 3 actionable tips to improve my job search strategy based on typical patterns.' },
  { icon: '📊', label: 'My stats', prompt: 'Analyze my job search progress and tell me what the data suggests.' },
  { icon: '🧠', label: 'Interview tips', prompt: 'What are the most important things to prepare for a technical interview?' },
]

function AIChatPanel({ settings }: { settings?: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const mutation = useMutation({
    mutationFn: (msg: string) =>
      api.post<{ reply: string }>('/ai/chat/', {
        message: msg,
        conversation_history: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'AI service not configured. Please set up your AI provider in Settings.' },
      ])
    },
  })

  const sendMessage = (text: string) => {
    if (!text.trim()) return
    const msg = text.trim()
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setInput('')
    mutation.mutate(msg)
  }

  const providerLabel = settings ? settings.charAt(0).toUpperCase() + settings.slice(1) : 'Not configured'
  const providerConnected = !!settings && settings !== ''

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <BotIcon className="size-5 text-primary" />
          <span className="font-semibold">AI Job Coach</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`size-2 rounded-full ${providerConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
          <span className="text-xs text-muted-foreground">{providerLabel}</span>
          <Link to="/settings" className="text-xs text-primary hover:underline ml-1">
            {providerConnected ? 'Change' : 'Set up →'}
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <SparklesIcon className="size-12 mx-auto mb-3 text-primary/30" />
            <p className="text-sm text-muted-foreground">Ask your AI Job Coach anything about your job search.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <BotIcon className="size-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="size-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                <UserIcon className="size-4" />
              </div>
            )}
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex gap-2 justify-start">
            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <BotIcon className="size-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => sendMessage(q.prompt)}
              className="text-xs px-3 py-1.5 rounded-full border bg-background hover:bg-accent transition-colors"
            >
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Suggested prompt */}
      <div className="px-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => sendMessage('How many interviews did I schedule this month and what was my pass rate?')}
          className="w-full text-xs px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:opacity-90 transition-opacity text-left"
        >
          💬 How many interviews did I schedule this month and what was my pass rate?
        </button>
      </div>

      {/* Input */}
      <div className="p-4 border-t shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your AI coach…"
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={mutation.isPending || !input.trim()}>
            <SendIcon className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

// ── Charts Section ────────────────────────────────────────────────────────────

function ChartsSection({ data }: { data: InsightsData }) {
  const funnelData = ['applied', 'screening', 'technical', 'hr_interview', 'final_round', 'offer'].map((stage) => ({
    stage: STAGE_LABELS[stage] ?? stage,
    count: data.by_stage[stage] ?? 0,
    fill: STAGE_COLORS[stage] ?? CHART_COLORS.gray,
  }))

  const sourceData = Object.entries(data.applications_by_source)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({
      name: source.charAt(0).toUpperCase() + source.slice(1).replace('_', ' '),
      value: count,
    }))

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Response Rate', value: `${data.response_rate}%`, icon: '📨' },
          { label: 'Interview Pass Rate', value: `${data.interview_pass_rate}%`, icon: '🎯' },
          { label: 'Avg Days to First Interview', value: `${data.avg_days_to_first_interview}d`, icon: '⏱️' },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-2xl font-bold text-primary">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Application Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Application Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(128,128,128,0.15)" />
              <XAxis type="number" tick={{ fill: CHART_COLORS.gray, fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fill: CHART_COLORS.gray, fontSize: 11 }} width={80} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(128,128,128,0.05)' }} />
              <Bar dataKey="count" name="Applications" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source + Outcomes side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Applications by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No source data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 11, color: CHART_COLORS.gray }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Interview Outcomes by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {data.outcomes_by_month.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No interview data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.outcomes_by_month}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                  <XAxis dataKey="month" tick={{ fill: CHART_COLORS.gray, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_COLORS.gray, fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="passed" name="Passed" stackId="a" fill={CHART_COLORS.green} />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill={CHART_COLORS.amber} />
                  <Bar dataKey="failed" name="Failed" stackId="a" fill={CHART_COLORS.red} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Self-Rating Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Self-Rating Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.self_rating_by_month.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No rating data yet. Add debrief notes after interviews.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data.self_rating_by_month}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="month" tick={{ fill: CHART_COLORS.gray, fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fill: CHART_COLORS.gray, fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="avg_rating"
                  name="Avg Rating"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.primary, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top Weak Areas */}
      {data.top_weak_areas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">⚠️ Top Improvement Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.top_weak_areas.slice(0, 8).map((area, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                  <span className="text-muted-foreground leading-snug">{area}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function InsightsPage() {
  const { data: insights, isPending } = useQuery<InsightsData>({
    queryKey: ['insights'],
    queryFn: () => api.get('/insights/'),
  })

  const { data: aiSettings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.get<{ provider: string }>('/ai-settings/'),
  })

  return (
    <div className="flex flex-col min-w-0 flex-1 h-screen overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Separator orientation="vertical" className="h-4 mr-3" />
        <h1 className="font-semibold text-lg">Insights</h1>
      </header>

      {/* 2/3 + 1/3 layout */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* Charts — left 2/3 */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6">
          {isPending ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : insights && insights.total_applications > 0 ? (
            <ChartsSection data={insights} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BarChart3Icon className="size-16 text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-2">No data yet</h3>
              <p className="text-muted-foreground mb-4">Add some job applications to see your insights here.</p>
              <Link to="/applications">
                <Button>Add Applications</Button>
              </Link>
            </div>
          )}
        </div>

        {/* AI Chat — right 1/3 */}
        <div className="w-[360px] shrink-0 border-l flex flex-col">
          <AIChatPanel settings={(aiSettings as any)?.provider} />
        </div>
      </div>
    </div>
  )
}
