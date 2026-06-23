import { Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function SearchBar() {
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-10 w-full max-w-[360px] -translate-x-1/2 px-3">
      <Card className="pointer-events-auto bg-background/90 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Search
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
          />
          <Input
            type="search"
            placeholder="Cari wilayah…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-label="Cari wilayah"
          />
        </div>
      </Card>
    </div>
  )
}
