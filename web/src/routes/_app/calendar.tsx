import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  format, addDays, addMonths, addWeeks,
  startOfWeek, startOfMonth, endOfMonth,
  isSameDay, isSameMonth, parseISO, differenceInMinutes,
  startOfDay, eachDayOfInterval, endOfWeek,
} from 'date-fns'
import { toast } from 'sonner'
import {
  ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { DateTimePicker } from '@/components/date-time-picker'
import { DatePicker } from '@/components/date-picker'
import { api, type CalendarEvent, type PaginatedResponse } from '@/lib/api'

export const Route = createFileRoute('/_app/calendar')({
  component: CalendarPage,
})

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'interview', label: 'Interview', color: 'bg-violet-500' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-blue-500' },
  { value: 'deadline', label: 'Deadline', color: 'bg-red-500' },
  { value: 'prep_session', label: 'Prep Session', color: 'bg-emerald-500' },
  { value: 'custom', label: 'Custom', color: 'bg-gray-500' },
]

const EVENT_COLORS: Record<string, string> = {
  interview: 'bg-violet-500 text-white',
  follow_up: 'bg-blue-500 text-white',
  deadline: 'bg-red-500 text-white',
  prep_session: 'bg-emerald-500 text-white',
  custom: 'bg-gray-500 text-white',
}

const HOUR_HEIGHT = 56 // px per hour
const START_HOUR = 7   // 7am
const END_HOUR = 21    // 9pm
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

// ── Event Form ────────────────────────────────────────────────────────────────

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  event_type: z.string().min(1),
  start_at: z.string().min(1, 'Start time is required'),
  end_at: z.string().min(1, 'End time is required'),
  all_day: z.boolean(),
  description: z.string().optional(),
  location: z.string().optional(),
})
type EventFormData = z.infer<typeof eventSchema>

function EventModal({
  open,
  onClose,
  existing,
  defaultStart,
}: {
  open: boolean
  onClose: () => void
  existing?: CalendarEvent
  defaultStart?: Date
}) {
  const queryClient = useQueryClient()

  const defStart = existing?.start_at
    ?? (defaultStart ? defaultStart.toISOString() : new Date().toISOString())
  const defEnd = existing?.end_at
    ?? (defaultStart ? addHours(defaultStart, 1).toISOString() : addHours(new Date(), 1).toISOString())

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: existing?.title ?? '',
      event_type: existing?.event_type ?? 'custom',
      start_at: defStart,
      end_at: defEnd,
      all_day: existing?.all_day ?? false,
      description: existing?.description ?? '',
      location: existing?.location ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: EventFormData) =>
      existing
        ? api.patch<CalendarEvent>(`/calendar/${existing.id}/`, data)
        : api.post<CalendarEvent>('/calendar/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      toast.success(existing ? 'Event updated' : 'Event created')
      onClose()
    },
    onError: () => toast.error('Failed to save event'),
  })

  const allDay = form.watch('all_day')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl><Input placeholder="Event title" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="event_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select name="event_type" value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="all_day" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} id="allday" />
                </FormControl>
                <FormLabel htmlFor="allday" className="cursor-pointer">All day event</FormLabel>
              </FormItem>
            )} />
            {allDay ? (
              <>
                <FormField control={form.control} name="start_at" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ? format(parseISO(field.value), 'yyyy-MM-dd') : undefined} onChange={(v) => field.onChange(v ? `${v}T00:00:00` : '')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            ) : (
              <>
                <FormField control={form.control} name="start_at" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start *</FormLabel>
                    <FormControl>
                      <DateTimePicker value={field.value || undefined} onChange={(v) => field.onChange(v ?? '')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="end_at" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End *</FormLabel>
                    <FormControl>
                      <DateTimePicker value={field.value || undefined} onChange={(v) => field.onChange(v ?? '')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </>
            )}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Optional notes…" rows={2} {...field} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl><Input placeholder="Zoom, Office, etc." {...field} /></FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : existing ? 'Update' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// helper
function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  currentDate,
  events,
  onSlotClick,
  onEventClick,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (ev: CalendarEvent) => void
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const getEventsForDay = (day: Date) =>
    events.filter((ev) => isSameDay(parseISO(ev.start_at), day))

  const getEventStyle = (ev: CalendarEvent) => {
    const start = parseISO(ev.start_at)
    const end = parseISO(ev.end_at)
    const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes()
    const durMins = Math.max(differenceInMinutes(end, start), 30)
    return {
      top: (startMins / 60) * HOUR_HEIGHT,
      height: Math.max((durMins / 60) * HOUR_HEIGHT, 24),
    }
  }

  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  return (
    <div className="overflow-x-auto flex-1">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className={`py-2 text-center border-l text-sm font-medium ${isSameDay(day, new Date()) ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className="text-xs uppercase">{format(day, 'EEE')}</div>
              <div className={`text-base font-semibold mt-0.5 mx-auto w-8 h-8 flex items-center justify-center rounded-full ${isSameDay(day, new Date()) ? 'bg-primary text-primary-foreground' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Time labels */}
          <div className="relative" style={{ height: totalHeight }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full text-right pr-2 text-xs text-muted-foreground"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8 }}
              >
                {format(new Date().setHours(h, 0, 0, 0), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="relative border-l cursor-pointer"
              style={{ height: totalHeight }}
              onClick={() => {
                const d = new Date(day)
                d.setHours(9, 0, 0, 0)
                onSlotClick(d)
              }}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full border-t border-border/50"
                  style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                />
              ))}
              {/* Events */}
              {getEventsForDay(day).map((ev) => {
                const style = getEventStyle(ev)
                const colorClass = EVENT_COLORS[ev.event_type] ?? 'bg-gray-500 text-white'
                return (
                  <div
                    key={ev.id}
                    className={`absolute left-0.5 right-0.5 rounded px-1 text-xs overflow-hidden ${colorClass} cursor-pointer hover:opacity-90 transition-opacity`}
                    style={{ top: style.top, height: style.height, minHeight: 20 }}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                  >
                    <span className="font-medium truncate block">{ev.title}</span>
                    {style.height > 32 && (
                      <span className="opacity-80">{format(parseISO(ev.start_at), 'h:mm a')}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onDayClick: (date: Date) => void
  onEventClick: (ev: CalendarEvent) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const getEventsForDay = (day: Date) =>
    events.filter((ev) => isSameDay(parseISO(ev.start_at), day))

  return (
    <div className="flex-1 overflow-auto p-4 lg:px-6">
      <div className="grid grid-cols-7 border-l border-t rounded-lg overflow-hidden">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r border-b bg-muted/30">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dayEvents = getEventsForDay(day)
          const isToday = isSameDay(day, new Date())
          const isCurrentMonth = isSameMonth(day, currentDate)
          return (
            <div
              key={day.toISOString()}
              className={`border-r border-b min-h-[90px] p-1 cursor-pointer hover:bg-accent/50 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''}`}
              onClick={() => {
                const d = new Date(day)
                d.setHours(9, 0, 0, 0)
                onDayClick(d)
              }}
            >
              <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                {format(day, 'd')}
              </div>
              {dayEvents.slice(0, 3).map((ev) => (
                <div
                  key={ev.id}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                  className={`text-xs px-1 py-0.5 rounded mb-0.5 truncate font-medium ${EVENT_COLORS[ev.event_type] ?? 'bg-gray-500 text-white'}`}
                >
                  {ev.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({
  currentDate,
  events,
  onSlotClick,
  onEventClick,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onSlotClick: (date: Date) => void
  onEventClick: (ev: CalendarEvent) => void
}) {
  const dayEvents = events.filter((ev) => isSameDay(parseISO(ev.start_at), currentDate))
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  const getEventStyle = (ev: CalendarEvent) => {
    const start = parseISO(ev.start_at)
    const end = parseISO(ev.end_at)
    const startMins = (start.getHours() - START_HOUR) * 60 + start.getMinutes()
    const durMins = Math.max(differenceInMinutes(end, start), 30)
    return {
      top: (startMins / 60) * HOUR_HEIGHT,
      height: Math.max((durMins / 60) * HOUR_HEIGHT, 24),
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 lg:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-[56px_1fr] border rounded-lg overflow-hidden">
          <div className="relative border-r" style={{ height: totalHeight }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full text-right pr-2 text-xs text-muted-foreground"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT - 8 }}
              >
                {format(new Date().setHours(h, 0, 0, 0), 'h a')}
              </div>
            ))}
          </div>
          <div
            className="relative cursor-pointer"
            style={{ height: totalHeight }}
            onClick={() => {
              const d = new Date(currentDate)
              d.setHours(9, 0, 0, 0)
              onSlotClick(d)
            }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full border-t border-border/50"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}
            {dayEvents.map((ev) => {
              const style = getEventStyle(ev)
              return (
                <div
                  key={ev.id}
                  className={`absolute left-1 right-1 rounded px-2 py-1 text-sm overflow-hidden ${EVENT_COLORS[ev.event_type] ?? 'bg-gray-500 text-white'} cursor-pointer hover:opacity-90`}
                  style={{ top: style.top, height: style.height }}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                >
                  <div className="font-medium">{ev.title}</div>
                  <div className="text-xs opacity-80">{format(parseISO(ev.start_at), 'h:mm a')} – {format(parseISO(ev.end_at), 'h:mm a')}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month' | 'day'

function CalendarPage() {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | undefined>()
  const [defaultStart, setDefaultStart] = useState<Date | undefined>()
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null)

  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 })
      return { start: format(s, 'yyyy-MM-dd'), end: format(addDays(s, 6), 'yyyy-MM-dd') }
    }
    if (viewMode === 'month') {
      const s = startOfMonth(currentDate)
      const e = endOfMonth(currentDate)
      return { start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd') }
    }
    return { start: format(currentDate, 'yyyy-MM-dd'), end: format(currentDate, 'yyyy-MM-dd') }
  }, [currentDate, viewMode])

  const { data } = useQuery<PaginatedResponse<CalendarEvent>>({
    queryKey: ['calendar', dateRange.start, dateRange.end],
    queryFn: () => api.get(`/calendar/?start_gte=${dateRange.start}&end_lte=${dateRange.end}&page_size=100`),
  })
  const events = data?.results ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/calendar/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setPopoverEvent(null)
      toast.success('Event deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const navigate = (direction: -1 | 0 | 1) => {
    if (direction === 0) { setCurrentDate(new Date()); return }
    setCurrentDate((prev) => {
      if (viewMode === 'week') return addWeeks(prev, direction)
      if (viewMode === 'month') return addMonths(prev, direction)
      return addDays(prev, direction)
    })
  }

  const handleSlotClick = (date: Date) => {
    setEditEvent(undefined)
    setDefaultStart(date)
    setModalOpen(true)
  }

  const handleEventClick = (ev: CalendarEvent) => {
    setPopoverEvent(ev)
  }

  const viewLabel = viewMode === 'week'
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} – ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 6), 'MMM d, yyyy')}`
    : viewMode === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : format(currentDate, 'EEEE, MMMM d, yyyy')

  return (
    <div className="flex flex-col min-w-0 flex-1 h-screen overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6 h-14 shrink-0">
        <SidebarTrigger className="-ml-1 mr-2" />
        <Separator orientation="vertical" className="h-4 mr-3" />
        <h1 className="font-semibold text-lg">Calendar</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { toast.info('Google Calendar sync coming soon!') }}
          >
            Sync Google Calendar
          </Button>
          <Button size="sm" onClick={() => { setEditEvent(undefined); setDefaultStart(new Date()); setModalOpen(true) }}>
            <PlusIcon className="size-4 mr-1" /> New Event
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-2 border-b bg-background shrink-0">
        {/* View toggle */}
        <div className="flex rounded-md border overflow-hidden">
          {(['week', 'month', 'day'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                viewMode === v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigate(-1)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(0)}>Today</Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => navigate(1)}>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        <span className="text-sm font-medium text-muted-foreground">{viewLabel}</span>

        {/* Legend */}
        <div className="ml-auto flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <div key={t.value} className="flex items-center gap-1">
              <div className={`size-2 rounded-full ${t.color}`} />
              <span className="text-xs text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto flex flex-col">
        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            events={events}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}
        {viewMode === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={events}
            onDayClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}
        {viewMode === 'day' && (
          <DayView
            currentDate={currentDate}
            events={events}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Event popover */}
      {popoverEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setPopoverEvent(null)}>
          <div
            className="bg-card border rounded-xl shadow-xl p-5 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{popoverEvent.title}</h3>
                <Badge className={`text-xs mt-1 ${EVENT_COLORS[popoverEvent.event_type] ?? ''}`}>
                  {EVENT_TYPES.find((t) => t.value === popoverEvent.event_type)?.label}
                </Badge>
              </div>
              <button onClick={() => setPopoverEvent(null)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-4" />
              </button>
            </div>
            {!popoverEvent.all_day && (
              <p className="text-sm text-muted-foreground mb-1">
                {format(parseISO(popoverEvent.start_at), 'PPP p')} → {format(parseISO(popoverEvent.end_at), 'p')}
              </p>
            )}
            {popoverEvent.location && (
              <p className="text-sm text-muted-foreground mb-1">📍 {popoverEvent.location}</p>
            )}
            {popoverEvent.description && (
              <p className="text-sm mt-2">{popoverEvent.description}</p>
            )}
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditEvent(popoverEvent); setModalOpen(true); setPopoverEvent(null) }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(popoverEvent.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        existing={editEvent}
        defaultStart={defaultStart}
      />
    </div>
  )
}
