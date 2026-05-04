import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value?: string // ISO datetime string
  onChange: (value: string | undefined) => void
  placeholder?: string
  disabled?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0')
  const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`
  return { value: h, label }
})

const MINUTES = ['00', '15', '30', '45']

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick date & time',
  disabled,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)

  const parsed = value ? parseISO(value) : undefined
  const dateStr = parsed ? format(parsed, 'yyyy-MM-dd') : ''
  const hourStr = parsed ? format(parsed, 'HH') : '09'
  const minStr = parsed ? format(parsed, 'mm') : '00'
  // Round minute to nearest 15
  const roundedMin = ['00', '15', '30', '45'].reduce((prev, curr) =>
    Math.abs(parseInt(curr) - parseInt(minStr)) < Math.abs(parseInt(prev) - parseInt(minStr)) ? curr : prev
  )

  const update = (newDate: string, newHour: string, newMin: string) => {
    onChange(`${newDate}T${newHour}:${newMin}:00`)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return
    const newDateStr = format(date, 'yyyy-MM-dd')
    update(newDateStr, hourStr, roundedMin)
    setOpen(false)
  }

  const handleHourChange = (h: string) => {
    if (dateStr) update(dateStr, h, roundedMin)
  }

  const handleMinChange = (m: string) => {
    if (dateStr) update(dateStr, hourStr, m)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn('flex-1 min-w-[160px] justify-start text-left font-normal', !parsed && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 size-4" />
            {parsed ? format(parsed, 'PPP') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Select value={hourStr} onValueChange={handleHourChange} disabled={disabled || !dateStr}>
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={roundedMin} onValueChange={handleMinChange} disabled={disabled || !dateStr}>
        <SelectTrigger className="w-20">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>:{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
