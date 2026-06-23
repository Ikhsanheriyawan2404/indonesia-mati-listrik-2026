import { Card } from '@/components/ui/card'
import { Hand, Zap } from 'lucide-react'

export function Legend() {
  return (
    <div className="absolute top-3 left-3 z-10 max-w-[calc(100vw-1.5rem)]">
      <Card className="gap-2 rounded-lg border border-white/70 bg-background/92 px-3 py-2.5 shadow-xl shadow-black/10 ring-black/10 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border/70 pb-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Zap className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-semibold leading-tight">Kejadian mati listrik</p>
            <p className="text-muted-foreground text-[0.72rem] leading-tight">Pilih titik dari peta</p>
          </div>
        </div>

        <ul className="grid gap-1.5">
          <li className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-red-500/20" aria-hidden="true" />
            <span className="text-foreground text-xs">Riwayat Padam</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full bg-blue-500 ring-2 ring-blue-500/20" aria-hidden="true" />
            <span className="text-foreground text-xs">Info / Jadwal</span>
          </li>
        </ul>

        <div className="mt-1 grid gap-1.5 rounded-md bg-muted/70 p-2">
          <p className="flex items-start gap-1.5 text-[0.72rem] leading-snug text-muted-foreground">
            <Hand className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden="true" />
            Tekan lama di peta untuk memilih titik laporan.
          </p>
        </div>
        <p className="mt-1 text-[0.65rem] text-muted-foreground/60 leading-tight">
          by{' '}
          <a
            href="https://github.com/Ikhsanheriyawan2404/indonesia-mati-listrik-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            brogrammer.id
          </a>
        </p>
      </Card>
    </div>
  )
}
