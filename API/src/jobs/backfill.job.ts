import { prisma } from "../prisma";
import { fetchDailyMeanTemps } from "../services/openMeteo.service";
import { computeDJU } from "../services/dju.service";
import { addDays, startOfDayUTC, toISODate } from "../utils/date";

function envNumber(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function envString(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export async function backfillLastYear(): Promise<{ inserted: number; skipped: number }> {
  // Lock anti-spam (1 job à la fois)
  const lock = await prisma.fetchLock.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, isRunning: false },
  });

  if (lock.isRunning) return { inserted: 0, skipped: 0 };
  await prisma.fetchLock.update({ where: { id: 1 }, data: { isRunning: true } });

  try {
    const baseC = envNumber("DJU_BASE_C", 18);
    const lat = envNumber("LAT", 49.617779);
    const lon = envNumber("LON", 0.755212);
    const timezone = envString("TIMEZONE", "Europe/Paris");

    const today = startOfDayUTC(new Date());
    const start = addDays(today, -365);
    const end = addDays(today, -1); // jusqu’à hier (journée complète)

    const startDate = toISODate(start);
    const endDate = toISODate(end);

    const existing = await prisma.djuDay.findMany({
      where: { date: { gte: start, lte: end } },
      select: { date: true },
    });
    const existingSet = new Set(existing.map((x) => toISODate(x.date)));

    const temps = await fetchDailyMeanTemps({ lat, lon, startDate, endDate, timezone });

    let inserted = 0;
    let skipped = 0;

    for (const day of temps) {
      if (existingSet.has(day.date)) {
        skipped++;
        continue;
      }

      const dju = computeDJU(baseC, day.tmeanC);
      const [y, m, d] = day.date.split("-").map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));

      await prisma.djuDay.upsert({
        where: { date: dateObj },
        update: { lat, lon, tmeanC: day.tmeanC, baseC, dju, source: "open-meteo" },
        create: { date: dateObj, lat, lon, tmeanC: day.tmeanC, baseC, dju, source: "open-meteo" },
      });

      inserted++;
    }

    return { inserted, skipped };
  } finally {
    await prisma.fetchLock.update({ where: { id: 1 }, data: { isRunning: false } });
  }
}
