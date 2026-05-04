import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  PlusIcon,
  SearchIcon,
  MoreHorizontalIcon,
  ArchiveIcon,
  Trash2Icon,
  EditIcon,
  CalendarPlusIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/date-picker'
import { DateTimePicker } from '@/components/date-time-picker'
import { api, type Application, type PaginatedResponse } from '@/lib/api'

export const Route = createFileRoute('/_app/applications')({
  component: ApplicationsPage,
})

// ── Constants ───────────────────────────────────────────────────────────────

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

const STAGES = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'technical', label: 'Technical' },
  { value: 'hr_interview', label: 'HR Interview' },
  { value: 'final_round', label: 'Final Round' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const SOURCES = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'referral', label: 'Referral' },
  { value: 'direct', label: 'Direct' },
  { value: 'job_board', label: 'Job Board' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'other', label: 'Other' },
]

const STAGE_BADGE: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-700 border-blue-200',
  screening: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  technical: 'bg-violet-100 text-violet-700 border-violet-200',
  hr_interview: 'bg-purple-100 text-purple-700 border-purple-200',
  final_round: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  offer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  withdrawn: 'bg-gray-100 text-gray-700 border-gray-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-200',
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200',
}

// ── Form schema ──────────────────────────────────────────────────────────────

const appSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  role: z.string().min(1, 'Role is required'),
  location: z.string().optional(),
  salary_range: z.string().optional(),
  stage: z.string().min(1),
  priority: z.string().min(1),
  date_applied: z.string().min(1, 'Date applied is required'),
  source: z.string().optional(),
  next_step: z.string().optional(),
  next_interview_date: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().optional(),
  resume_version: z.string().optional(),
  job_url: z.string().optional(),
  notes: z.string().optional(),
})
type AppFormData = z.infer<typeof appSchema>

// ── Application modal ────────────────────────────────────────────────────────

function ApplicationModal({
  open,
  onClose,
  existing,
}: {
  open: boolean
  onClose: () => void
  existing?: Application
}) {
  const queryClient = useQueryClient()

  const form = useForm<AppFormData>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      company: existing?.company ?? '',
      role: existing?.role ?? '',
      location: existing?.location ?? '',
      salary_range: existing?.salary_range ?? '',
      stage: existing?.stage ?? 'applied',
      priority: existing?.priority ?? 'medium',
      date_applied: existing?.date_applied ?? format(new Date(), 'yyyy-MM-dd'),
      source: existing?.source ?? '',
      next_step: existing?.next_step ?? '',
      next_interview_date: existing?.next_interview_date ?? '',
      contact_name: existing?.contact_name ?? '',
      contact_email: existing?.contact_email ?? '',
      resume_version: existing?.resume_version ?? '',
      job_url: existing?.job_url ?? '',
      notes: existing?.notes ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: AppFormData) => {
      const payload = {
        ...data,
        next_interview_date: data.next_interview_date || null,
        source: data.source || null,
      }
      return existing
        ? api.patch<Application>(`/applications/${existing.id}/`, payload)
        : api.post<Application>('/applications/', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success(existing ? 'Application updated' : 'Application added')
      onClose()
    },
    onError: () => toast.error('Failed to save application'),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Application' : 'Add Application'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="company" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company *</FormLabel>
                  <FormControl><Input placeholder="Acme Corp" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <FormControl><Input placeholder="Software Engineer" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input placeholder="San Francisco, CA" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="salary_range" render={({ field }) => (
                <FormItem>
                  <FormLabel>Salary Range</FormLabel>
                  <FormControl><Input placeholder="$120k – $150k" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage *</FormLabel>
                  <Select name="stage" value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select name="priority" value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date_applied" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Applied *</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={(v) => field.onChange(v ?? '')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="source" render={({ field }) => (
                <FormItem>
                  <FormLabel>Source</FormLabel>
                  <Select name="source" value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl><Input placeholder="Jane Recruiter" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contact_email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl><Input placeholder="jane@acme.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="resume_version" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resume Version</FormLabel>
                  <FormControl><Input placeholder="v3_senior" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="job_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Job URL</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="next_interview_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Next Interview Date/Time</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value || undefined}
                    onChange={(v) => field.onChange(v ?? '')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="next_step" render={({ field }) => (
              <FormItem>
                <FormLabel>Next Step</FormLabel>
                <FormControl><Textarea placeholder="Follow up on Thursday..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Additional notes..." rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Add Application'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Schedule Interview Modal ─────────────────────────────────────────────────

const scheduleSchema = z.object({
  interview_type: z.string().min(1),
  round_number: z.coerce.number().min(1).max(10),
  scheduled_at: z.string().min(1, 'Date/time required'),
  duration_minutes: z.coerce.number().optional(),
  format: z.string().optional(),
  platform: z.string().optional(),
  interviewer_name: z.string().optional(),
  interviewer_role: z.string().optional(),
})
type ScheduleFormData = z.infer<typeof scheduleSchema>

function ScheduleInterviewModal({
  open,
  onClose,
  application,
}: {
  open: boolean
  onClose: () => void
  application: Application
}) {
  const queryClient = useQueryClient()

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      interview_type: 'technical',
      round_number: 1,
      scheduled_at: '',
      duration_minutes: undefined,
      format: '',
      platform: '',
      interviewer_name: '',
      interviewer_role: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: ScheduleFormData) =>
      api.post('/interviews/', {
        ...data,
        application: application.id,
        status: 'scheduled',
        outcome: 'pending',
        follow_up_sent: false,
        format: data.format || null,
        platform: data.platform || null,
        interviewer_name: data.interviewer_name || null,
        interviewer_role: data.interviewer_role || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Interview scheduled')
      form.reset()
      onClose()
    },
    onError: () => toast.error('Failed to schedule interview'),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()} modal={false}>
      <DialogContent
        className="max-w-[95vw] md:max-w-xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {application.company} — {application.role}
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="interview_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select name="schedule_interview_type" value={field.value} onValueChange={field.onChange}>
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
                  <FormLabel>Round #</FormLabel>
                  <FormControl><Input type="number" min={1} max={10} {...field} /></FormControl>
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
                  <FormControl>
                    <Input
                      type="number"
                      min={15}
                      step={15}
                      placeholder="60"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="format" render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <Select name="schedule_format" value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="platform" render={({ field }) => (
              <FormItem>
                <FormLabel>Platform</FormLabel>
                <FormControl><Input placeholder="Zoom, Teams, Google Meet…" {...field} /></FormControl>
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="interviewer_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Interviewer Name</FormLabel>
                  <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="interviewer_role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Interviewer Email / Role</FormLabel>
                  <FormControl><Input placeholder="jane@acme.com" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Scheduling…' : 'Schedule Interview'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

function ApplicationsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [ordering, setOrdering] = useState('-last_activity')
  const [modalOpen, setModalOpen] = useState(false)
  const [editApp, setEditApp] = useState<Application | undefined>()
  const [scheduleApp, setScheduleApp] = useState<Application | undefined>()
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery<PaginatedResponse<Application>>({
    queryKey: ['applications', search, stageFilter, priorityFilter, ordering, page],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (stageFilter !== 'all') params.set('stage', stageFilter)
      if (priorityFilter !== 'all') params.set('priority', priorityFilter)
      if (ordering) params.set('ordering', ordering)
      params.set('page', String(page))
      return api.get(`/applications/?${params}`)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.post(`/applications/${id}/archive/`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast.success('Application archived')
    },
    onError: () => toast.error('Failed to archive'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/applications/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Application deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const handleEdit = (app: Application) => {
    setEditApp(app)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditApp(undefined)
    setModalOpen(true)
  }

  const apps = data?.results ?? []
  const totalPages = data ? Math.ceil(data.count / 20) : 0

  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Separator orientation="vertical" className="h-4 mr-3" />
        <h1 className="font-semibold text-lg">Applications</h1>
        <div className="ml-auto">
          <Button size="sm" onClick={handleAdd}>
            <PlusIcon className="size-4 mr-1" /> Add Application
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6 py-3 border-b bg-background">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search company or role…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-8"
          />
        </div>
        <Select name="stage-filter" value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select name="priority-filter" value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select name="ordering" value={ordering} onValueChange={setOrdering}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="-last_activity">Last Activity</SelectItem>
            <SelectItem value="-date_applied">Date Applied</SelectItem>
            <SelectItem value="next_interview_date">Next Interview</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-4 lg:px-6 py-4">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="font-semibold text-lg mb-1">No applications yet</h3>
            <p className="text-muted-foreground mb-4">Start tracking your job search by adding your first application.</p>
            <Button onClick={handleAdd}><PlusIcon className="size-4 mr-1" /> Add Application</Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Stage</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Priority</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Applied</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Salary</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Next Interview</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Resume</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Last Activity</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apps.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {app.company.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium max-w-[140px] truncate">{app.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <span className="truncate block">{app.role}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={`text-xs border ${STAGE_BADGE[app.stage] ?? ''}`} variant="outline">
                        {STAGES.find((s) => s.value === app.stage)?.label ?? app.stage}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge className={`text-xs border ${PRIORITY_BADGE[app.priority] ?? ''}`} variant="outline">
                        {app.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {format(parseISO(app.date_applied), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[120px]">
                      <span className="truncate block">{app.location ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{app.salary_range ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {SOURCES.find((s) => s.value === app.source)?.label ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {app.next_interview_date
                        ? format(parseISO(app.next_interview_date), 'MMM d, h:mm a')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground max-w-[120px]">
                      <span className="truncate block">{app.contact_name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{app.resume_version ?? '—'}</td>
                    <td className="px-4 py-3">
                      {app.notes ? (
                        <Badge variant="secondary" className="text-xs">Notes</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                      {format(parseISO(app.last_activity), 'MMM d')}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(app)}>
                            <EditIcon className="size-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {app.job_url && (
                            <DropdownMenuItem asChild>
                              <a href={app.job_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLinkIcon className="size-4 mr-2" /> View Job
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              setScheduleApp(app)
                              setScheduleModalOpen(true)
                            }}
                          >
                            <CalendarPlusIcon className="size-4 mr-2" /> Schedule Interview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => archiveMutation.mutate(app.id)}
                            className="text-muted-foreground"
                          >
                            <ArchiveIcon className="size-4 mr-2" /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(app.id)}
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {data?.count ?? 0} application{data?.count !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ApplicationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editApp}
      />
      {scheduleApp && (
        <ScheduleInterviewModal
          key={scheduleApp.id}
          open={scheduleModalOpen}
          onClose={() => { setScheduleModalOpen(false); setScheduleApp(undefined) }}
          application={scheduleApp}
        />
      )}
    </div>
  )
}
