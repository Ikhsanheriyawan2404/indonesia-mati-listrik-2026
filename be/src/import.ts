import { randomUUID } from "crypto";
import { initDatabase, sql } from "./config/database";
import { redis } from "./config/redis";

const API_URL = "https://pantaulistrik.my.id/api/reports";

async function migrateData() {
  console.log(`[${new Date().toISOString()}] Memulai sinkronisasi data via Redis Lock...`);
  
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
    
    const apiResponse: any = await response.json();
    const records = apiResponse.data || [];
    
    if (records.length === 0) {
      console.log("[INFO] Tidak ada data baru dari API.");
      return;
    }

    let insertCount = 0;

    await sql.begin(async (sql) => {
      for (const item of records) {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);

        // exp 2 hari aj
        const redisKey = `report:lock:${lat}:${lng}`;
        const isUnique = await redis.set(redisKey, "1", "EX", 172800, "NX");

        if (isUnique === "OK") {
          await sql`
            INSERT INTO "public"."reports" (
              "guest_id",
              "reporter_name",
              "location",
              "description",
              "source",
              "started_at",
              "created_at",
              "updated_at"
            ) VALUES (
              ${randomUUID()},
              ${item.reporter_name},
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
              ${item.description},
              'pantaulistrik.my.id',
              ${item.created_at},
              ${item.created_at},
              ${item.updated_at}
            )
          `;
          insertCount++;
        }
      }
    });

    console.log(`✅ Sukses! Berhasil meng-insert ${insertCount} data baru. (${records.length - insertCount} data duplikat di-skip oleh Redis)`);
  } catch (error) {
    console.error("❌ Gagal saat melakukan sinkronisasi:", error);
  }
}

// ==========================================
// RUNNER & CRON-LIKE INTERVAL (Setiap 1 Jam)
// ==========================================
await initDatabase();
await migrateData();

const SATU_JAM = 60 * 60 * 1000;
setInterval(async () => {
  await migrateData();
}, SATU_JAM);

process.on("SIGINT", async () => {
  await sql.end();
  await redis.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await sql.end();
  await redis.quit();
  process.exit(0);
});

export {};
