import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { backfillLastYear } from "../jobs/backfill.job";

export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/admin/backfill", async (_req, res) => {
  try {
    const r = await backfillLastYear();
    res.json({ ok: true, ...r });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "unknown error" });
  }
});

router.get("/dju", async (req, res) => {
  const schema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Use start/end YYYY-MM-DD" });

  const [sy, sm, sd] = parsed.data.start.split("-").map(Number);
  const [ey, em, ed] = parsed.data.end.split("-").map(Number);

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  const rows = await prisma.djuDay.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  res.json(
    rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      tmeanC: r.tmeanC,
      baseC: r.baseC,
      dju: r.dju,
      source: r.source,
    }))
  );
});

router.get("/stats", async (req, res) => {
  const schema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    group: z.enum(["day", "month"]).optional().default("day"),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Use start/end YYYY-MM-DD and optional group=day|month" });
  }

  const [sy, sm, sd] = parsed.data.start.split("-").map(Number);
  const [ey, em, ed] = parsed.data.end.split("-").map(Number);

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  const rows = await prisma.djuDay.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    select: { date: true, dju: true, tmeanC: true },
  });

  const count = rows.length;
  const djuSum = rows.reduce((a, r) => a + r.dju, 0);
  const tmeanAvg = count ? rows.reduce((a, r) => a + r.tmeanC, 0) / count : null;
  const djuAvg = count ? djuSum / count : null;

  if (parsed.data.group === "day") {
    return res.json({
      start: parsed.data.start,
      end: parsed.data.end,
      countDays: count,
      djuSum,
      djuAvg,
      tmeanAvg,
      series: rows.map(r => ({
        date: r.date.toISOString().slice(0, 10),
        dju: r.dju,
        tmeanC: r.tmeanC,
      })),
    });
  }

  // group=month : agrégation par YYYY-MM
  const map = new Map<string, { djuSum: number; days: number }>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 7); // YYYY-MM
    const cur = map.get(key) ?? { djuSum: 0, days: 0 };
    cur.djuSum += r.dju;
    cur.days += 1;
    map.set(key, cur);
  }

  const series = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      djuSum: v.djuSum,
      days: v.days,
      djuAvg: v.djuSum / v.days,
    }));

  return res.json({
    start: parsed.data.start,
    end: parsed.data.end,
    countDays: count,
    djuSum,
    djuAvg,
    tmeanAvg,
    series,
  });
});

