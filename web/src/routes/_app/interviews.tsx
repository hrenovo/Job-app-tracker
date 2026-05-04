import { useState, useRef, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO, addMinutes } from 'date-fns'
import { toast } from 'sonner'
import {
  PlusIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DownloadIcon,
  XIcon,
  CheckIcon,
  PlusCircleIcon,
  SparklesIcon,
  RefreshCwIcon,
  Trash2Icon,
  EditIcon,
  MoreHorizontalIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { DateTimePicker } from '@/components/date-time-picker'
import { api, apiDownload, type Interview, type InterviewNotes, type InterviewPrep, type PaginatedResponse } from '@/lib/api'
import type { ComponentType } from 'react'

export const Route = createFileRoute('/_app/interviews')({
  component: InterviewsPage,
})

// ── Constants ─────────────────────────────────────────────────────────────────

const INTERVIEW_TYPES = [
  { value: 'phone_screen', label: 'Phone Screen' },
  { value: 'technical', label: 'Technical' },
  { value: 'hr', label: 'HR' },
  { value: 'on_site', label: 'On Site' },
  { value: 'final_round', label: 'Final Round' },
  { value: 'take_home', label: 'Take Home' },
  { value: 'other', label: 'Other' },
]
const FORMATS = [
  { value: 'video', label: 'Video' },
  { value: 'phone', label: 'Phone' },
  { value: 'in_person', label: 'In Person' },
  { value: 'take_home', label: 'Take Home' },
]
const STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]
const OUTCOMES = [
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  no_show: 'bg-red-100 text-red-700 border-red-200',
}
const OUTCOME_BADGE: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  withdrawn: 'bg-gray-100 text-gray-600 border-gray-200',
}

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({
  value = 0,
  max = 5,
  onChange,
  label,
}: {
  value: number
  max?: number
  onChange: (v: number) => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium w-24">{label}</span>}
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={`text-xl transition-colors leading-none ${
              i < value ? 'text-amber-400' : 'text-muted-foreground/25 hover:text-amber-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-xs text-muted-foreground">{value}/{max}</span>
      )}
    </div>
  )
}

// ── Add/Edit Interview Modal ──────────────────────────────────────────────────

const ivSchema = z.object({
  application: z.number({ required_error: 'Application is required' }),
  interview_type: z.string().min(1),
  round_number: z.coerce.number().min(1).max(10),
  scheduled_at: z.string().min(1, 'Date/time required'),
  duration_minutes: z.coerce.number().optional(),
  format: z.string().optional(),
  platform: z.string().optional(),
  interviewer_name: z.string().optional(),
  interviewer_role: z.string().optional(),
  status: z.string().min(1),
  outcome: z.string().min(1),
  follow_up_sent: z.boolean(),
})
type IvFormData = z.infer<typeof ivSchema>

function InterviewModal({
  open,
  onClose,
  existing,
}: {
  open: boolean
  onClose: () => void
  existing?: Interview
}) {
  const queryClient = useQueryClient()

  const { data: appsData } = useQuery<PaginatedResponse<{ id: number; company: string; role: string }>>({
    queryKey: ['applications-list'],
    queryFn: () => api.get('/applications/?page_size=100'),
    enabled: open,
  })
  const apps = appsData?.results ?? []

  const form = useForm<IvFormData>({
    resolver: zodResolver(ivSchema),
    defaultValues: {
      application: existing?.application,
      interview_type: existing?.interview_type ?? 'technical',
      round_number: existing?.round_number ?? 1,
      scheduled_at: existing?.scheduled_at ?? '',
      duration_minutes: existing?.duration_minutes,
      format: existing?.format ?? '',
      platform: existing?.platform ?? '',
      interviewer_name: existing?.interviewer_name ?? '',
      interviewer_role: existing?.interviewer_role ?? '',
      status: existing?.status ?? 'scheduled',
      outcome: existing?.outcome ?? 'pending',
      follow_up_sent: existing?.follow_up_sent ?? false,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: IvFormData) => {
      const payload = {
        ...data,
        format: data.format || null,
        platform: data.platform || null,
        interviewer_name: data.interviewer_name || null,
        interviewer_role: data.interviewer_role || null,
      }
      return existing
        ? api.patch<Interview>(`/interviews/${existing.id}/`, payload)
        : api.post<Interview>('/interviews/', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(existing ? 'Interview updated' : 'Interview added')
      onClose()
    },
    onError: () => toast.error('Failed to save interview'),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <DialogContent className="max-w-[95vw] md:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Interview' : 'Add Interview'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="application" render={({ field }) => (
              <FormItem>
                <FormLabel>Application *</FormLabel>
                <Select
                  name="application"
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select application" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.company} — {a.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="interview_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select name="interview_type" value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {INTERVIEW_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="round_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Round</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="scheduled_at" render={({ field }) => (
              <FormItem>
                <FormLabel>Date & Time *</FormLabel>
                <FormControl>
                  <DateTimePicker value={field.value || undefined} onChange={(v) => field.onChange(v ?? '')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="duration_minutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (min)</FormLabel>
                  <FormControl><Input type="number" min={15} step={15} placeholder="60" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="format" render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <Select name="format" value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="platform" render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <FormControl><Input placeholder="Zoom, Teams…" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select name="status" value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="interviewer_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Interviewer Name</FormLabel>
                  <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="interviewer_role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Interviewer Role</FormLabel>
                  <FormControl><Input placeholder="Engineering Manager" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Add Interview'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Panel Tabs ────────────────────────────────────────────────────────────────

function OverviewTab({ iv }: { iv: Interview }) {
  const gcalLink = (() => {
    const start = parseISO(iv.scheduled_at)
    const end = iv.duration_minutes ? addMinutes(start, iv.duration_minutes) : addMinutes(start, 60)
    const fmt = (d: Date) => format(d, "yyyyMMdd'T'HHmmss")
    const title = encodeURIComponent(`Interview at ${iv.application_company}`)
    const details = encodeURIComponent(`${iv.application_role} · ${iv.interview_type} Round ${iv.round_number}`)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`
  })()

  const rows: [string, string][] = [
    ['Type', INTERVIEW_TYPES.find((t) => t.value === iv.interview_type)?.label ?? iv.interview_type],
    ['Round', `Round ${iv.round_number}`],
    ['Date', format(parseISO(iv.scheduled_at), 'PPP p')],
    ['Duration', iv.duration_minutes ? `${iv.duration_minutes} min` : '—'],
    ['Format', FORMATS.find((f) => f.value === iv.format)?.label ?? '—'],
    ['Platform', iv.platform ?? '—'],
    ['Interviewer', iv.interviewer_name ? `${iv.interviewer_name}${iv.interviewer_role ? ` (${iv.interviewer_role})` : ''}` : '—'],
  ]

  return (
    <div className="space-y-4">
      <dl className="grid gap-3">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <a href={gcalLink} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="gap-2">
          <ExternalLinkIcon className="size-3.5" />
          Add to Google Calendar
        </Button>
      </a>
    </div>
  )
}

function PrepTab({ iv }: { iv: Interview }) {
  const queryClient = useQueryClient()
  const prep = iv.prep

  const [topics, setTopics] = useState<string[]>(prep?.topics_to_study ?? [])
  const [topicInput, setTopicInput] = useState('')
  const [checklist, setChecklist] = useState<{ text: string; checked: boolean }[]>(prep?.checklist ?? [])
  const [checkInput, setCheckInput] = useState('')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(prep?.useful_links ?? [])
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const saveMutation = useMutation({
    mutationFn: (data: Partial<InterviewPrep>) =>
      api.patch<InterviewPrep>(`/interviews/${iv.id}/prep/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interview-detail', iv.id] }),
    onError: () => toast.error('Failed to save'),
  })

  const save = useCallback((data: Partial<InterviewPrep>) => saveMutation.mutate(data), [saveMutation])

  const addTopic = () => {
    if (!topicInput.trim()) return
    const next = [...topics, topicInput.trim()]
    setTopics(next)
    setTopicInput('')
    save({ topics_to_study: next })
  }
  const removeTopic = (i: number) => {
    const next = topics.filter((_, idx) => idx !== i)
    setTopics(next)
    save({ topics_to_study: next })
  }
  const toggleCheck = (i: number) => {
    const next = checklist.map((c, idx) => idx === i ? { ...c, checked: !c.checked } : c)
    setChecklist(next)
    save({ checklist: next })
  }
  const addCheckItem = () => {
    if (!checkInput.trim()) return
    const next = [...checklist, { text: checkInput.trim(), checked: false }]
    setChecklist(next)
    setCheckInput('')
    save({ checklist: next })
  }
  const addLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return
    const next = [...links, { label: linkLabel.trim(), url: linkUrl.trim() }]
    setLinks(next)
    setLinkLabel('')
    setLinkUrl('')
    save({ useful_links: next })
  }
  const removeLink = (i: number) => {
    const next = links.filter((_, idx) => idx !== i)
    setLinks(next)
    save({ useful_links: next })
  }

  return (
    <div className="space-y-5">
      {/* Topics */}
      <div>
        <p className="text-sm font-semibold mb-2">Topics to Study</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {topics.map((t, i) => (
            <Badge key={i} variant="secondary" className="gap-1 pr-1">
              {t}
              <button type="button" onClick={() => removeTopic(i)} className="hover:text-destructive ml-0.5">
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add topic…"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
            className="flex-1"
          />
          <Button size="sm" variant="outline" onClick={addTopic}><PlusCircleIcon className="size-4" /></Button>
        </div>
      </div>

      {/* Questions to ask */}
      <div>
        <p className="text-sm font-semibold mb-1.5">Questions to Ask</p>
        <Textarea
          defaultValue={prep?.questions_to_ask ?? ''}
          placeholder="What does success look like in this role?"
          rows={3}
          onBlur={(e) => save({ questions_to_ask: e.target.value })}
        />
      </div>

      {/* Questions expected */}
      <div>
        <p className="text-sm font-semibold mb-1.5">Questions I Expect</p>
        <Textarea
          defaultValue={prep?.questions_expected ?? ''}
          placeholder="Tell me about yourself…"
          rows={3}
          onBlur={(e) => save({ questions_expected: e.target.value })}
        />
      </div>

      {/* Prep checklist */}
      <div>
        <p className="text-sm font-semibold mb-2">Prep Checklist</p>
        <div className="space-y-1.5 mb-2">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => toggleCheck(i)}
                id={`check-${i}`}
              />
              <label
                htmlFor={`check-${i}`}
                className={`text-sm flex-1 ${item.checked ? 'line-through text-muted-foreground' : ''}`}
              >
                {item.text}
              </label>
              <button type="button" onClick={() => { const n = checklist.filter((_, idx) => idx !== i); setChecklist(n); save({ checklist: n }) }}>
                <XIcon className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add checklist item…"
            value={checkInput}
            onChange={(e) => setCheckInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheckItem())}
            className="flex-1"
          />
          <Button size="sm" variant="outline" onClick={addCheckItem}><PlusCircleIcon className="size-4" /></Button>
        </div>
      </div>

      {/* Useful links */}
      <div>
        <p className="text-sm font-semibold mb-2">Useful Links</p>
        <div className="space-y-1.5 mb-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex-1 truncate">
                {l.label}
              </a>
              <button type="button" onClick={() => removeLink(i)}>
                <XIcon className="size-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <Input placeholder="Label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} className="flex-1" />
          <Input placeholder="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="flex-1" />
          <Button size="sm" variant="outline" onClick={addLink}><PlusCircleIcon className="size-4" /></Button>
        </div>
      </div>

      {/* Free notes */}
      <div>
        <p className="text-sm font-semibold mb-1.5">Free Notes</p>
        <Textarea
          defaultValue={prep?.free_notes ?? ''}
          placeholder="Anything else to note…"
          rows={3}
          onBlur={(e) => save({ free_notes: e.target.value })}
        />
      </div>
    </div>
  )
}

function DebriefTab({ iv }: { iv: Interview }) {
  const queryClient = useQueryClient()
  const notes = iv.notes

  const [selfRating, setSelfRating] = useState(notes?.self_rating ?? 0)
  const [diffRating, setDiffRating] = useState(notes?.difficulty_rating ?? 0)
  const [salaryDiscussed, setSalaryDiscussed] = useState(notes?.salary_discussed ?? false)
  const [wouldDiff, setWouldDiff] = useState<boolean | null>(notes?.would_prepare_differently ?? null)
  const [aiResponse, setAiResponse] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: (data: Partial<InterviewNotes>) =>
      api.patch<InterviewNotes>(`/interviews/${iv.id}/notes/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interview-detail', iv.id] }),
    onError: () => toast.error('Failed to save'),
  })

  const aiMutation = useMutation({
    mutationFn: (msg: string) =>
      api.post<{ reply: string }>('/ai/chat/', { message: msg, conversation_history: [] }),
    onSuccess: (data) => setAiResponse(data.reply),
    onError: () => toast.error('AI service not configured. Set it up in Settings.'),
  })

  const save = (data: Partial<InterviewNotes>) => saveMutation.mutate(data)

  const handleGetAiSuggestions = () => {
    const content = [
      notes?.went_well && `Went well: ${notes.went_well}`,
      notes?.improve && `To improve: ${notes.improve}`,
      notes?.dont_repeat && `Don't repeat: ${notes.dont_repeat}`,
      notes?.key_learnings && `Key learnings: ${notes.key_learnings}`,
    ].filter(Boolean).join('\n')
    aiMutation.mutate(
      `I just completed an interview at ${iv.application_company} for ${iv.application_role}. Here are my notes:\n${content || 'No notes yet.'}\n\nGive me 3 specific coaching tips to improve for my next interview.`
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <StarRating label="Self Rating" value={selfRating} onChange={(v) => { setSelfRating(v); save({ self_rating: v }) }} />
        <StarRating label="Difficulty" value={diffRating} onChange={(v) => { setDiffRating(v); save({ difficulty_rating: v }) }} />
      </div>
      {[
        { key: 'went_well', icon: '✅', label: 'What went well', val: notes?.went_well },
        { key: 'improve', icon: '⚠️', label: 'What to improve', val: notes?.improve },
        { key: 'dont_repeat', icon: '❌', label: "What NOT to do again", val: notes?.dont_repeat },
        { key: 'key_learnings', icon: '💡', label: 'Key learnings', val: notes?.key_learnings },
      ].map(({ key, icon, label, val }) => (
        <div key={key}>
          <p className="text-sm font-semibold mb-1.5">{icon} {label}</p>
          <Textarea
            defaultValue={val ?? ''}
            placeholder={`${label}…`}
            rows={2}
            onBlur={(e) => save({ [key]: e.target.value })}
          />
        </div>
      ))}
      <div>
        <p className="text-sm font-semibold mb-2">Would you prepare differently?</p>
        <div className="flex gap-2 mb-2">
          {[true, false].map((v) => (
            <Button
              key={String(v)}
              size="sm"
              variant={wouldDiff === v ? 'default' : 'outline'}
              onClick={() => { setWouldDiff(v); save({ would_prepare_differently: v }) }}
            >
              {v ? 'Yes' : 'No'}
            </Button>
          ))}
        </div>
        {wouldDiff && (
          <Textarea
            defaultValue={notes?.prepare_differently_note ?? ''}
            placeholder="How would you prepare differently?"
            rows={2}
            onBlur={(e) => save({ prepare_differently_note: e.target.value })}
          />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold mb-1.5">Company Impression</p>
        <Textarea
          defaultValue={notes?.company_impression ?? ''}
          placeholder="Your overall impression of the company…"
          rows={2}
          onBlur={(e) => save({ company_impression: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={salaryDiscussed}
          onCheckedChange={(v) => { setSalaryDiscussed(v); save({ salary_discussed: v }) }}
          id="salary-switch"
        />
        <label htmlFor="salary-switch" className="text-sm font-medium">Salary discussed</label>
      </div>
      {salaryDiscussed && (
        <div>
          <p className="text-sm font-semibold mb-1.5">Salary Amount</p>
          <Input
            defaultValue={notes?.salary_amount ?? ''}
            placeholder="$120,000"
            onBlur={(e) => save({ salary_amount: e.target.value })}
          />
        </div>
      )}
      <Separator />
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleGetAiSuggestions}
        disabled={aiMutation.isPending}
      >
        {aiMutation.isPending ? <RefreshCwIcon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
        ✨ Get AI Suggestions
      </Button>
      {aiResponse && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
        </div>
      )}
    </div>
  )
}

function FollowUpTab({ iv }: { iv: Interview }) {
  const queryClient = useQueryClient()
  const [followUpSent, setFollowUpSent] = useState(iv.follow_up_sent)

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Interview>) =>
      api.patch<Interview>(`/interviews/${iv.id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['interview-detail', iv.id] })
    },
    onError: () => toast.error('Failed to save'),
  })

  const notesMutation = useMutation({
    mutationFn: (data: Partial<InterviewNotes>) =>
      api.patch<InterviewNotes>(`/interviews/${iv.id}/notes/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interview-detail', iv.id] }),
    onError: () => toast.error('Failed to save'),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Switch
          checked={followUpSent}
          onCheckedChange={(v) => { setFollowUpSent(v); saveMutation.mutate({ follow_up_sent: v }) }}
          id="followup-switch"
        />
        <label htmlFor="followup-switch" className="text-sm font-medium">Follow-up sent</label>
        {followUpSent && <CheckIcon className="size-4 text-emerald-500" />}
      </div>
      <div>
        <p className="text-sm font-semibold mb-1.5">Recruiter Response Notes</p>
        <Textarea
          defaultValue={iv.notes?.quick_notes ?? ''}
          placeholder="Note any response from recruiter…"
          rows={4}
          onBlur={(e) => notesMutation.mutate({ quick_notes: e.target.value })}
        />
      </div>
    </div>
  )
}

// ── Quick Notes ───────────────────────────────────────────────────────────────

function QuickNotes({ iv }: { iv: Interview }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: Partial<InterviewNotes>) =>
      api.patch<InterviewNotes>(`/interviews/${iv.id}/notes/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interview-detail', iv.id] }),
  })

  return (
    <div className="border-t mt-auto">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
      >
        📝 Quick Notes
        <ChevronRightIcon className={`size-4 ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <Textarea
            defaultValue={iv.notes?.quick_notes ?? ''}
            placeholder="Quick freeform scratchpad…"
            rows={3}
            onBlur={(e) => mutation.mutate({ quick_notes: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

// ── Interview Panel ───────────────────────────────────────────────────────────

const STAGE_BADGE: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700',
  screening: 'bg-indigo-100 text-indigo-700',
  technical: 'bg-violet-100 text-violet-700',
  hr_interview: 'bg-purple-100 text-purple-700',
  final_round: 'bg-fuchsia-100 text-fuchsia-700',
  offer: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
}

function InterviewPanel({
  ivId,
  onClose,
}: {
  ivId: number
  onClose: () => void
}) {
  const [panelOpen, setPanelOpen] = useState(true)

  const { data: iv, isPending } = useQuery<Interview>({
    queryKey: ['interview-detail', ivId],
    queryFn: () => api.get(`/interviews/${ivId}/`),
  })

  const handleDownload = async () => {
    try {
      await apiDownload(`/interviews/${ivId}/download-notes/`, `interview-${ivId}-notes.md`)
      toast.success('Notes downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  return (
    <div
      className="relative border-l bg-card flex flex-col shrink-0 transition-[width] duration-300 overflow-hidden"
      style={{ width: panelOpen ? '560px' : '40px' }}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setPanelOpen((p) => !p)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 bg-background border rounded-full p-0.5 shadow-sm hover:shadow-md transition-shadow"
        title={panelOpen ? 'Collapse panel' : 'Expand panel'}
      >
        {panelOpen
          ? <ChevronRightIcon className="size-3.5" />
          : <ChevronLeftIcon className="size-3.5" />}
      </button>

      {panelOpen && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Panel header */}
          {isPending ? (
            <div className="p-4 border-b space-y-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          ) : iv ? (
            <div className="flex items-start gap-2 p-4 border-b shrink-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{iv.application_company}</p>
                <p className="text-sm text-muted-foreground truncate">{iv.application_role}</p>
              </div>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleDownload} title="Download notes">
                <DownloadIcon className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : null}

          {/* Tabs */}
          {isPending ? (
            <div className="flex-1 p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : iv ? (
            <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="mx-4 mt-3 shrink-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="prep">Preparation</TabsTrigger>
                <TabsTrigger value="debrief">Debrief</TabsTrigger>
                <TabsTrigger value="followup">Follow-up</TabsTrigger>
              </TabsList>
              <div className="flex-1 overflow-y-auto p-4">
                <TabsContent value="overview" className="mt-0"><OverviewTab iv={iv} /></TabsContent>
                <TabsContent value="prep" className="mt-0"><PrepTab iv={iv} /></TabsContent>
                <TabsContent value="debrief" className="mt-0"><DebriefTab iv={iv} /></TabsContent>
                <TabsContent value="followup" className="mt-0"><FollowUpTab iv={iv} /></TabsContent>
              </div>
              <QuickNotes iv={iv} />
            </Tabs>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function InterviewsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editIv, setEditIv] = useState<Interview | undefined>()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const { data, isPending } = useQuery<PaginatedResponse<Interview>>({
    queryKey: ['interviews', filter, typeFilter, statusFilter, outcomeFilter, page],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('filter', filter)
      if (typeFilter !== 'all') params.set('interview_type', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (outcomeFilter !== 'all') params.set('outcome', outcomeFilter)
      params.set('page', String(page))
      return api.get(`/interviews/?${params}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/interviews/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      if (selectedId) setSelectedId(null)
      toast.success('Interview deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return
    try {
      await apiDownload('/interviews/bulk-download-notes/', 'interview-notes.zip', {
        method: 'POST',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      toast.success('Notes downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleSelectAll = () => {
    const ivs = data?.results ?? []
    if (selectedIds.size === ivs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ivs.map((i) => i.id)))
    }
  }

  const ivs = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / 20) : 0

  return (
    <div className="flex flex-col min-w-0 flex-1 h-[calc(100vh-0px)] overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Separator orientation="vertical" className="h-4 mr-3" />
        <h1 className="font-semibold text-lg">Interviews</h1>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button size="sm" variant="outline" onClick={handleBulkDownload}>
              <DownloadIcon className="size-4 mr-1" />
              Download ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditIv(undefined); setModalOpen(true) }}>
            <PlusIcon className="size-4 mr-1" /> Add Interview
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6 py-2.5 border-b bg-background shrink-0">
        <div className="flex rounded-md border overflow-hidden">
          {(['upcoming', 'past'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              {f === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
        <Select name="type-filter" value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {INTERVIEW_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select name="status-filter" value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select name="outcome-filter" value={outcomeFilter} onValueChange={(v) => { setOutcomeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table + Panel */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* Table */}
        <div className="flex-1 min-w-0 overflow-auto p-4 lg:px-6">
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : ivs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-5xl mb-4">🎯</div>
              <h3 className="font-semibold text-lg mb-1">No {filter} interviews</h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'upcoming' ? 'Schedule your next interview to get started.' : 'No past interviews recorded yet.'}
              </p>
              <Button onClick={() => setModalOpen(true)}><PlusIcon className="size-4 mr-1" />Add Interview</Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-3">
                      <Checkbox
                        checked={selectedIds.size === ivs.length && ivs.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Round</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Duration</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Interviewer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Format</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Platform</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Outcome</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Follow-up</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ivs.map((iv) => (
                    <tr
                      key={iv.id}
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                        selectedId === iv.id ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedId(iv.id === selectedId ? null : iv.id)}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(iv.id)}
                          onCheckedChange={() => toggleSelect(iv.id)}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {iv.application_company.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium max-w-[120px] truncate">{iv.application_company}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[140px]"><span className="truncate block">{iv.application_role}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {INTERVIEW_TYPES.find((t) => t.value === iv.interview_type)?.label ?? iv.interview_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{iv.round_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {format(parseISO(iv.scheduled_at), 'MMM d, h:mm a')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {iv.duration_minutes ? `${iv.duration_minutes}m` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[120px]">
                        <span className="truncate block">{iv.interviewer_name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {FORMATS.find((f) => f.value === iv.format)?.label ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{iv.platform ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`text-xs border ${STATUS_BADGE[iv.status] ?? ''}`} variant="outline">
                          {STATUSES.find((s) => s.value === iv.status)?.label ?? iv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={`text-xs border ${OUTCOME_BADGE[iv.outcome] ?? ''}`} variant="outline">
                          {OUTCOMES.find((o) => o.value === iv.outcome)?.label ?? iv.outcome}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {iv.follow_up_sent
                          ? <CheckIcon className="size-4 text-emerald-500 mx-auto" />
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedId(iv.id)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditIv(iv); setModalOpen(true) }}>
                              <EditIcon className="size-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(iv.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2Icon className="size-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{data?.count ?? 0} total</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Previous</Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Next</Button>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        {selectedId && (
          <InterviewPanel
            key={selectedId}
            ivId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <InterviewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editIv}
      />
    </div>
  )
}
