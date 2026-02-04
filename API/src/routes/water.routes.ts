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

waterRouter.get("/water/cold/prices", async (_req, res) => {
  const prices = await prisma.coldWaterPricePeriod.findMany({
    orderBy: { startDate: "asc" },
  });

  res.json({
    ok: true,
    prices: prices.map((p) => ({
      ...p,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
    })),
  });
});

waterRouter.post("/water/cold/prices", async (req, res) => {
  const schema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pricePerM3: z.number().nonnegative(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const startDate = parseISODateToUTC(parsed.data.startDate);
  const endDate = parseISODateToUTC(parsed.data.endDate);
  if (endDate < startDate) return res.status(400).json({ error: "endDate must be >= startDate" });

  const price = await prisma.coldWaterPricePeriod.create({
    data: {
      startDate,
      endDate,
      pricePerM3: parsed.data.pricePerM3,
    },
  });

  res.json({
    ok: true,
    price: {
      ...price,
      startDate: price.startDate.toISOString().slice(0, 10),
      endDate: price.endDate.toISOString().slice(0, 10),
    },
  });
});

waterRouter.patch("/water/cold/prices/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const schema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pricePerM3: z.number().nonnegative().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (parsed.data.startDate == null && parsed.data.endDate == null && parsed.data.pricePerM3 == null) {
    return res.status(400).json({ error: "Provide at least one field to update" });
  }

  const existing = await prisma.coldWaterPricePeriod.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Price period not found" });

  const startDate = parsed.data.startDate ? parseISODateToUTC(parsed.data.startDate) : existing.startDate;
  const endDate = parsed.data.endDate ? parseISODateToUTC(parsed.data.endDate) : existing.endDate;
  if (endDate < startDate) return res.status(400).json({ error: "endDate must be >= startDate" });

  const price = await prisma.coldWaterPricePeriod.update({
    where: { id },
    data: {
      startDate: parsed.data.startDate ? startDate : undefined,
      endDate: parsed.data.endDate ? endDate : undefined,
      pricePerM3: parsed.data.pricePerM3 ?? undefined,
    },
  });

  res.json({
    ok: true,
    price: {
      ...price,
      startDate: price.startDate.toISOString().slice(0, 10),
      endDate: price.endDate.toISOString().slice(0, 10),
    },
  });
});

waterRouter.delete("/water/cold/prices/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const existing = await prisma.coldWaterPricePeriod.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Price period not found" });

  await prisma.coldWaterPricePeriod.delete({ where: { id } });

  res.json({ ok: true });
});
