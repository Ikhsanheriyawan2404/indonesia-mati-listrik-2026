import { sql } from '../config/database'

const randomIndonesiaCoord = () => {
  const lng = 95 + Math.random() * (141 - 95)
  const lat = -11 + Math.random() * (6 - (-11))
  return { lng, lat }
}

const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const sources = ['CROWDSOURCED', 'IMPORT']

const names = [
  'Budi', 'Siti', 'Ahmad', 'Dewi', 'Eko', 'Fitri', 'Hendra', 'Prabski',
  'Indah', 'Jokoui', 'Kartika', 'Buna', null, null, null
]

const descriptions = [
  'Listrik mati sejak tadi pagi, belum ada kabar dari PLN.',
  'Dapat info dari grup WA RT, katanya ada perbaikan jaringan.',
  'Tiang listrik kena pohon tumbang semalam.',
  'PLN Mobile kirim notif pemadaman bergilir.',
  'Sudah 3 jam mati, pompa air ikut mati.',
  'Info dari ketua RT, pemadaman untuk pemasangan gardu baru.',
  null,
  'Mati mendadak tanpa pemberitahuan.',
  'Berkedip-kedip dari tadi, sekarang mati total.',
  'Kata tetangga gardu di ujung jalan meledak.',
]

const generateStartedAt = (status: 'ongoing' | 'scheduled') => {
  const now = new Date()

  if (status === 'ongoing') {
    const hoursAgo = 0.5 + Math.random() * 9.5
    return new Date(now.getTime() - hoursAgo * 60 * 60 * 1000)
  } else {
    const hoursAhead = 1 + Math.random() * 71
    return new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
  }
}

const generateEndedAt = (startedAt: Date, status: 'ongoing' | 'scheduled') => {
  if (Math.random() < 0.4) return null

  const durationHours = 1 + Math.random() * 7
  return new Date(startedAt.getTime() + durationHours * 60 * 60 * 1000)
}

const generateGuestId = () => {
  return crypto.randomUUID()
}

const seed = async (count = 50) => {
  console.info(`Seeding ${count} reports...`)

  const reports = Array.from({ length: count }, () => {
    const { lng, lat } = randomIndonesiaCoord()
    const status = Math.random() < 0.6 ? 'ongoing' : 'scheduled'
    const startedAt = generateStartedAt(status)
    const endedAt = generateEndedAt(startedAt, status)

    return {
      guest_id: generateGuestId(),
      reporter_name: randomFrom(names),
      lng,
      lat,
      description: randomFrom(descriptions),
      started_at: startedAt.toISOString(),
      ended_at: endedAt ? endedAt.toISOString() : null,
      source: randomFrom(sources),
    }
  })

  for (const r of reports) {
    await sql`
      INSERT INTO reports (
        guest_id,
        reporter_name,
        location,
        description,
        started_at,
        ended_at,
        source
      ) VALUES (
        ${r.guest_id},
        ${r.reporter_name},
        ST_SetSRID(ST_MakePoint(${r.lng}, ${r.lat}), 4326),
        ${r.description},
        ${r.started_at},
        ${r.ended_at},
        ${r.source}
      )
    `
  }

  console.info(`Done! ${count} reports inserted.`)
  await sql.end()
}

const argValue = process.argv[2];
const count = argValue ? Number(argValue) : undefined
seed(count).catch((err) => {
  console.error('Seeder failed:', err)
  process.exit(1)
})