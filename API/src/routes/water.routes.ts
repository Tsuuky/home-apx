import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";

export const waterRouter = Router();

function parseISODateToUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

waterRouter.post("/water/cold", async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cubicM: z.number().nonnegative(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const date = parseISODateToUTC(parsed.data.date);
  const existing = await prisma.coldWaterReading.findUnique({ where: { date } });
  if (existing) return res.status(409).json({ error: "Reading already exists" });

  const reading = await prisma.coldWaterReading.create({
    data: {
      date,
      cubicM: parsed.data.cubicM,
      note: parsed.data.note ?? null,
    },
  });

  res.json({ ok: true, reading });
});

waterRouter.patch("/water/cold/:date", async (req, res) => {
  const dateStr = req.params.date;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!dateOk) return res.status(400).json({ error: "Invalid date param YYYY-MM-DD" });

  const schema = z.object({
    cubicM: z.number().nonnegative().optional(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (parsed.data.cubicM == null && parsed.data.note == null) {
    return res.status(400).json({ error: "Provide at least one field to update" });
  }

  const date = parseISODateToUTC(dateStr);
  const existing = await prisma.coldWaterReading.findUnique({ where: { date } });
  if (!existing) return res.status(404).json({ error: "Reading not found" });

  const reading = await prisma.coldWaterReading.update({
    where: { date },
    data: {
      cubicM: parsed.data.cubicM ?? undefined,
      note: parsed.data.note ?? undefined,
    },
  });

  res.json({ ok: true, reading });
});

waterRouter.delete("/water/cold/:date", async (req, res) => {
  const dateStr = req.params.date;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!dateOk) return res.status(400).json({ error: "Invalid date param YYYY-MM-DD" });

  const date = parseISODateToUTC(dateStr);
  const existing = await prisma.coldWaterReading.findUnique({ where: { date } });
  if (!existing) return res.status(404).json({ error: "Reading not found" });

  await prisma.coldWaterReading.delete({ where: { date } });

  res.json({ ok: true });
});

waterRouter.get("/water/cold", async (req, res) => {
  const schema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const where: { date?: { gte?: Date; lte?: Date } } = {};
  if (parsed.data.start || parsed.data.end) {
    where.date = {};
    if (parsed.data.start) where.date.gte = parseISODateToUTC(parsed.data.start);
    if (parsed.data.end) where.date.lte = parseISODateToUTC(parsed.data.end);
  }

  const readings = await prisma.coldWaterReading.findMany({
    where,
    orderBy: { date: "asc" },
  });

  res.json({
    ok: true,
    readings: readings.map((r) => ({
      ...r,
      date: r.date.toISOString().slice(0, 10),
    })),
  });
});
