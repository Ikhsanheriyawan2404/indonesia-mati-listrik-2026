import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from '@/lib/LocationContext'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, reverseGeocode } from '@/lib/api'
import { type ApiResponse, type Report } from '@/lib/types'
import { Loader2, Plus, UserX, CalendarIcon, MapPin } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

const OPEN_REPORT_MODAL_EVENT = 'open-report-modal'
const TEMP_REPORT_EVENT = 'temp-report'

interface FormState {
  reporter_name: string
  description: string
  started_at: string
  ended_at: string
}

const EMPTY_FORM: FormState = {
  reporter_name: '',
  description: '',
  started_at: '',
  ended_at: '',
}

type FormErrors = Partial<Record<keyof FormState | 'location' | 'ended_at', string>>

interface DateTimePickerProps {
  value: Date | undefined
  onChange: (date: Date) => void
  placeholder?: string
}

function DateTimePicker({ value, onChange, placeholder = "Pilih tanggal & waktu" }: DateTimePickerProps) {
  const [date, setDate] = useState<Date | undefined>(value || new Date())
  const [hour, setHour] = useState<number>(value ? value.getHours() : new Date().getHours())
  const [minute, setMinute] = useState<number>(value ? value.getMinutes() : 0)

  useEffect(() => {
    if (value) {
      setDate(value)
      setHour(value.getHours())
      setMinute(value.getMinutes())
    }
  }, [value])

  const handleSelectDate = (newDate: Date | undefined) => {
    if (!newDate) return
    const updated = new Date(newDate)
    updated.setHours(hour, minute, 0, 0)
    setDate(updated)
    onChange(updated)
  }

  const handleHourChange = (newHour: string) => {
    const h = parseInt(newHour, 10)
    setHour(h)
    if (date) {
      const updated = new Date(date)
      updated.setHours(h, minute, 0, 0)
      onChange(updated)
    }
  }

  const handleMinuteChange = (newMinute: string) => {
    const m = parseInt(newMinute, 10)
    setMinute(m)
    if (date) {
      const updated = new Date(date)
      updated.setHours(hour, m, 0, 0)
      onChange(updated)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal border-input"
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
          {value ? (
            format(value, "dd MMMM yyyy, HH:mm", { locale: id })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 flex flex-col" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelectDate}
          locale={id}
          // initialFocus
        />
        <div className="flex items-center gap-2 border-t border-border p-3 justify-center bg-muted/20">
          <span className="text-xs font-medium text-muted-foreground mr-1">Waktu:</span>
          {/* Hour Select */}
          <select
            value={String(hour).padStart(2, '0')}
            onChange={(e) => handleHourChange(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring dark:bg-popover text-foreground"
          >
            {Array.from({ length: 24 }).map((_, i) => {
              const val = String(i).padStart(2, '0')
              return <option key={i} value={val}>{val}</option>
            })}
          </select>
          <span className="text-xs text-muted-foreground">:</span>
          {/* Minute Select */}
          <select
            value={String(minute).padStart(2, '0')}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring dark:bg-popover text-foreground"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const val = String(i * 5).padStart(2, '0')
              return <option key={i} value={val}>{val}</option>
            })}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const getStartedAtDate = (type: string, customVal?: Date): Date => {
  const now = new Date()
  switch (type) {
    case 'now':
      return now
    case '1h_ago':
      return new Date(now.getTime() - 60 * 60 * 1000)
    case '2h_ago':
      return new Date(now.getTime() - 2 * 60 * 60 * 1000)
    case '3h_ago':
      return new Date(now.getTime() - 3 * 60 * 60 * 1000)
    case '1h_later':
      return new Date(now.getTime() + 60 * 60 * 1000)
    case '3h_later':
      return new Date(now.getTime() + 3 * 60 * 60 * 1000)
    case 'custom':
      return customVal || now
    default:
      return now
  }
}

const getEndedAtDate = (type: string, startedAtDate: Date, customVal?: Date): Date | null => {
  const now = new Date()
  switch (type) {
    case 'unknown':
      return null
    case '1h':
      return new Date(startedAtDate.getTime() + 60 * 60 * 1000)
    case '2h':
      return new Date(startedAtDate.getTime() + 2 * 60 * 60 * 1000)
    case '3h':
      return new Date(startedAtDate.getTime() + 4 * 60 * 60 * 1000)
    case 'now':
      return now
    case 'custom':
      return customVal || null
    default:
      return null
  }
}

export function ReportModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { selected, selectCenter, clearTemporaryMarker, finalizeMarker } = useLocation()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [anonymous, setAnonymous] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const [locationLabel, setLocationLabel] = useState<string>('')
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false)

  const [startedAtType, setStartedAtType] = useState<string>('now')
  const [customStartedAt, setCustomStartedAt] = useState<Date>(new Date())

  const [endedAtType, setEndedAtType] = useState<string>('unknown')
  const [customEndedAt, setCustomEndedAt] = useState<Date | undefined>(undefined)

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleStartedAtTypeChange = (value: string) => {
    setStartedAtType(value)
    if (errors.started_at) {
      setErrors((prev) => ({ ...prev, started_at: undefined }))
    }
    if (errors.ended_at) {
      setErrors((prev) => ({ ...prev, ended_at: undefined }))
    }
  }

  const handleEndedAtTypeChange = (value: string) => {
    setEndedAtType(value)
    if (errors.ended_at) {
      setErrors((prev) => ({ ...prev, ended_at: undefined }))
    }
  }

  const toggleAnonymous = () => {
    setAnonymous((prev) => {
      if (!prev) {
        setForm((f) => ({ ...f, reporter_name: '' }))
      }
      return !prev
    })
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setAnonymous(false)
    setStartedAtType('now')
    setCustomStartedAt(new Date())
    setEndedAtType('unknown')
    setCustomEndedAt(undefined)
  }

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!selected) {
      setErrors((prev) => ({ ...prev, location: 'Pilih lokasi pada peta.' }))
      return false
    }

    const payloadStartedAt = getStartedAtDate(startedAtType, customStartedAt)
    const payloadEndedAt = getEndedAtDate(endedAtType, payloadStartedAt, customEndedAt)

    if (payloadEndedAt && payloadEndedAt <= payloadStartedAt) {
      next.ended_at = 'Waktu selesai harus setelah waktu mulai.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      resetForm()
      clearTemporaryMarker()
    }
    setOpen(next)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const payloadStartedAt = getStartedAtDate(startedAtType, customStartedAt)
      const payloadEndedAt = getEndedAtDate(endedAtType, payloadStartedAt, customEndedAt)

      const payload = {
        reporter_name: anonymous ? null : (form.reporter_name.trim() || null),
        description: form.description.trim() || null,
        latitude: selected?.latitude ?? 0,
        longitude: selected?.longitude ?? 0,
        started_at: payloadStartedAt.toISOString(),
        ended_at: payloadEndedAt ? payloadEndedAt.toISOString() : null,
        source: 'CROWDSOURCED',
      }

      const res = await api<ApiResponse<Report>>('/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast.success('Laporan dikirim, menunggu verifikasi.')
      window.dispatchEvent(new CustomEvent(TEMP_REPORT_EVENT, { detail: res.data }))
      finalizeMarker()
      resetForm()
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim laporan.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selected) {
      setLocationLabel('')
      return
    }

    setLocationLabel(`${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`)
    setIsGeocodingLocation(true)

    let cancelled = false
    reverseGeocode(selected.latitude, selected.longitude).then((displayName) => {
      if (cancelled) return
      setIsGeocodingLocation(false)
      if (displayName) setLocationLabel(displayName)
    })

    return () => { cancelled = true }
  }, [selected])

  useEffect(() => {
    const openReportModal = () => setOpen(true)

    window.addEventListener(OPEN_REPORT_MODAL_EVENT, openReportModal)
    return () => window.removeEventListener(OPEN_REPORT_MODAL_EVENT, openReportModal)
  }, [])

  return (
    <>
      <Button
        size="icon"
        className="fixed right-6 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-20 size-13 rounded-full shadow-2xl shadow-black/25 ring-4 ring-background/80"
        aria-label="Tambah laporan"
        onClick={() => {
          selectCenter()
          setOpen(true)
        }}
      >
        <Plus className="size-5" aria-hidden="true" />
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Laporan / Jadwal Pemadaman</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} noValidate className="space-y-4 pt-1">

            {/* Nama (opsional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="reporter_name">
                  Nama
                  <span className="text-muted-foreground ml-1.5 text-xs font-normal">(opsional)</span>
                </Label>
                <button
                  type="button"
                  onClick={toggleAnonymous}
                  aria-pressed={anonymous}
                  className={[
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                    anonymous
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  ].join(' ')}
                >
                  <UserX className="size-3.5" aria-hidden="true" />
                  Anonim
                </button>
              </div>
              <Input
                id="reporter_name"
                name="reporter_name"
                type="text"
                placeholder={anonymous ? 'Dikirim sebagai anonim' : 'Nama kamu…'}
                autoComplete="name"
                disabled={anonymous}
                value={anonymous ? '' : form.reporter_name}
                onChange={(e) => handleChange('reporter_name', e.target.value)}
                className={anonymous ? 'text-muted-foreground italic' : ''}
              />
            </div>

            {/* Deskripsi (opsional) */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Deskripsi
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">(opsional)</span>
              </Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Ceritakan situasinya… misalnya sudah berapa lama, area mana saja yang terdampak, dll."
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 resize-none"
              />
            </div>

            {/* Lokasi (required) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="location">
                  <MapPin className="inline-block size-3.5 mr-1 text-muted-foreground" aria-hidden="true" />
                  Lokasi
                </Label>
                {isGeocodingLocation && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    Mencari alamat…
                  </span>
                )}
              </div>
              <Input
                id="location"
                disabled
                placeholder="Pilih titik pada peta…"
                value={locationLabel}
                title={locationLabel}
                className="bg-muted/30 truncate"
              />
            </div>


            {/* Mulai padam (required) */}
            <div className="space-y-1.5">
              <Label htmlFor="started_at">
                Mulai padam <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Select value={startedAtType} onValueChange={handleStartedAtTypeChange}>
                <SelectTrigger id="started_at" className="w-full">
                  <SelectValue placeholder="Pilih waktu mulai padam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">Sekarang (default)</SelectItem>
                  <SelectItem value="1h_ago">1 jam lalu</SelectItem>
                  <SelectItem value="2h_ago">2 jam lalu</SelectItem>
                  <SelectItem value="3h_ago">3 jam lalu</SelectItem>
                  <SelectItem value="1h_later">1 jam lagi</SelectItem>
                  <SelectItem value="3h_later">3 jam lagi</SelectItem>
                  <SelectItem value="custom">Pilih tanggal...</SelectItem>
                </SelectContent>
              </Select>

              {startedAtType === 'custom' && (
                <div className="mt-1.5">
                  <DateTimePicker
                    value={customStartedAt}
                    onChange={(date) => {
                      setCustomStartedAt(date)
                      if (customEndedAt && customEndedAt <= date) {
                        setCustomEndedAt(new Date(date.getTime() + 60 * 60 * 1000))
                      }
                    }}
                    placeholder="Pilih tanggal mulai"
                  />
                </div>
              )}

              {errors.started_at && (
                <p id="started_at-error" role="alert" className="text-destructive text-xs mt-1">
                  {errors.started_at}
                </p>
              )}
            </div>

            {/* Selesai (opsional) */}
            <div className="space-y-1.5">
              <Label htmlFor="ended_at">
                Selesai
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">(opsional)</span>
              </Label>
              <Select value={endedAtType} onValueChange={handleEndedAtTypeChange}>
                <SelectTrigger id="ended_at" className="w-full">
                  <SelectValue placeholder="Pilih waktu selesai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Tidak tahu (default)</SelectItem>
                  <SelectItem value="1h">1 jam</SelectItem>
                  <SelectItem value="2h">2 jam</SelectItem>
                  <SelectItem value="3h">3 jam</SelectItem>
                  <SelectItem value="custom">Pilih tanggal...</SelectItem>
                </SelectContent>
              </Select>

              {endedAtType === 'custom' && (
                <div className="mt-1.5">
                  <DateTimePicker
                    value={customEndedAt || new Date(getStartedAtDate(startedAtType, customStartedAt).getTime() + 60 * 60 * 1000)}
                    onChange={(date) => setCustomEndedAt(date)}
                    placeholder="Pilih tanggal selesai"
                  />
                </div>
              )}

              {errors.ended_at && (
                <p id="ended_at-error" role="alert" className="text-destructive text-xs mt-1">
                  {errors.ended_at}
                </p>
              )}
            </div>

            {/* Submit */}
            <div className="pt-1">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Menyimpan…
                  </>
                ) : (
                  'Simpan laporan'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
