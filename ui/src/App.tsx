import { Toaster } from 'sonner'
import { Map } from '@/components/Map'
// import { SearchBar } from '@/components/SearchBar'
import { Legend } from '@/components/Legend'
import { ModerationSocket } from '@/components/ModerationSocket'
import { ReportModal } from '@/components/ReportModal'
import { LocationProvider } from '@/lib/LocationContext'
export function App() {
  return (
    <LocationProvider>
      <div className="relative h-dvh w-full overflow-hidden">
        <ModerationSocket />
        <Map />
        {/* <SearchBar /> */}
        <Legend />
        <ReportModal />
        <Toaster richColors position="bottom-center" />
      </div>
    </LocationProvider>
  )
}

export default App