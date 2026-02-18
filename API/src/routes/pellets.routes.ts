import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { bagsToKg } from "../utils/pellets";

export const pelletsRouter = Router();

function parseISODateToUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * SAISONS
 */

// Créer une saison
pelletsRouter.post("/season", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    baseC: z.number().optional().default(18),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const startDate = parseISODateToUTC(parsed.data.start);

  // Option: empêcher 2 saisons actives
  const active = await prisma.season.findFirst({ where: { endDate: null } });
  if (active) return res.status(409).json({ error: "A season is already active", activeSeasonId: active.id });

  const season = await prisma.season.create({
    data: { name: parsed.data.name, startDate, baseC: parsed.data.baseC },
  });

  res.json({ ok: true, season });
});

// Saison active
pelletsRouter.get("/season/active", async (_req, res) => {
  const season = await prisma.season.findFirst({
    where: { endDate: null },
    orderBy: { startDate: "desc" },
  });
  res.json({ ok: true, season });
});

// Clôturer la saison active (ou une saison donnée)
pelletsRouter.post("/season/:id/close", async (req, res) => {
  const schema = z.object({
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const endDate = parseISODateToUTC(parsed.data.end);

  const season = await prisma.season.update({
    where: { id },
    data: { endDate },
  });

  res.json({ ok: true, season });
});

// Modifier une saison (ex: saison active)
pelletsRouter.patch("/season/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const schema = z.object({
    name: z.string().min(1).optional(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    baseC: z.number().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (
    parsed.data.name == null &&
    parsed.data.start == null &&
    parsed.data.end == null &&
    parsed.data.baseC == null
  ) {
    return res.status(400).json({ error: "Provide at least one field to update" });
  }

  const data: {
    name?: string;
    startDate?: Date;
    endDate?: Date | null;
    baseC?: number;
  } = {};

  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.start) data.startDate = parseISODateToUTC(parsed.data.start);
  if (parsed.data.end) data.endDate = parseISODateToUTC(parsed.data.end);
  if (parsed.data.baseC != null) data.baseC = parsed.data.baseC;

  const season = await prisma.season.update({
    where: { id },
    data,
  });

  res.json({ ok: true, season });
});

/**
 * CONSO JOURNALIÈRE
 * - soit tu envoies kg
 * - soit tu envoies bags (+ bagKg optionnel, défaut 15)
 */
pelletsRouter.post("/pellets/daily", async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kg: z.number().positive().optional(),
    bags: z.number().int().positive().optional(),
    bagKg: z.number().positive().optional().default(15),
    pricePerBag: z.number().nonnegative().optional(),
    note: z.string().optional(),
    seasonId: z.number().int().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (parsed.data.kg == null && parsed.data.bags == null) {
    return res.status(400).json({ error: "Provide kg OR bags" });
  }

  const date = parseISODateToUTC(parsed.data.date);

  const existing = await prisma.pelletDaily.findUnique({ where: { date } });
  if (existing) return res.status(409).json({ error: "Daily reading already exists" });

  let seasonId = parsed.data.seasonId ?? null;
  if (seasonId == null) {
    const active = await prisma.season.findFirst({ where: { endDate: null } });
    seasonId = active?.id ?? null;
  }

  const bagKg = parsed.data.bagKg ?? 15;
  const kg = parsed.data.kg ?? bagsToKg(parsed.data.bags!, bagKg);

  const row = await prisma.pelletDaily.create({
    data: {
      date,
      kg,
      bags: parsed.data.bags ?? null,
      bagKg: parsed.data.bags != null ? bagKg : null,
      pricePerBag: parsed.data.pricePerBag ?? null,
      note: parsed.data.note ?? null,
      seasonId,
    },
  });

  res.json({ ok: true, row });
});

pelletsRouter.patch("/pellets/daily/:date", async (req, res) => {
  const dateStr = req.params.date;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!dateOk) return res.status(400).json({ error: "Invalid date param YYYY-MM-DD" });

  const schema = z.object({
    kg: z.number().positive().optional(),
    bags: z.number().int().positive().optional(),
    bagKg: z.number().positive().optional().default(15),
    pricePerBag: z.number().nonnegative().optional(),
    note: z.string().optional(),
    seasonId: z.number().int().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (
    parsed.data.kg == null &&
    parsed.data.bags == null &&
    parsed.data.pricePerBag == null &&
    parsed.data.note == null &&
    parsed.data.seasonId == null
  ) {
    return res.status(400).json({ error: "Provide at least one field to update" });
  }

  const date = parseISODateToUTC(dateStr);
  const existing = await prisma.pelletDaily.findUnique({ where: { date } });
  if (!existing) return res.status(404).json({ error: "Daily reading not found" });

  const data: {
    kg?: number;
    bags?: number | null;
    bagKg?: number | null;
    pricePerBag?: number | null;
    note?: string | null;
    seasonId?: number | null;
  } = {};

  if (parsed.data.kg != null) {
    data.kg = parsed.data.kg;
    if (parsed.data.bags != null) {
      data.bags = parsed.data.bags;
      data.bagKg = parsed.data.bagKg ?? 15;
    }
  } else if (parsed.data.bags != null) {
    const bagKg = parsed.data.bagKg ?? 15;
    data.kg = bagsToKg(parsed.data.bags, bagKg);
    data.bags = parsed.data.bags;
    data.bagKg = bagKg;
  }

  if (parsed.data.note !== undefined) {
    data.note = parsed.data.note ?? null;
  }

  if (parsed.data.pricePerBag !== undefined) {
    data.pricePerBag = parsed.data.pricePerBag ?? null;
  }

  if (parsed.data.seasonId !== undefined) {
    data.seasonId = parsed.data.seasonId ?? null;
  }

  const row = await prisma.pelletDaily.update({
    where: { date },
    data,
  });

  res.json({ ok: true, row });
});

pelletsRouter.delete("/pellets/daily/:date", async (req, res) => {
  const dateStr = req.params.date;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!dateOk) return res.status(400).json({ error: "Invalid date param YYYY-MM-DD" });

  const date = parseISODateToUTC(dateStr);
  const existing = await prisma.pelletDaily.findUnique({ where: { date } });
  if (!existing) return res.status(404).json({ error: "Daily reading not found" });

  await prisma.pelletDaily.delete({ where: { date } });

  res.json({ ok: true });
});

pelletsRouter.put("/pellets/daily/:date", async (req, res) => {
  const dateStr = req.params.date;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  if (!dateOk) return res.status(400).json({ error: "Invalid date param YYYY-MM-DD" });

  const schema = z.object({
    kg: z.number().positive().optional(),
    bags: z.number().int().positive().optional(),
    bagKg: z.number().positive().optional().default(15),
    pricePerBag: z.number().nonnegative().optional(),
    note: z.string().optional(),
    seasonId: z.number().int().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (parsed.data.kg == null && parsed.data.bags == null) {
    return res.status(400).json({ error: "Provide kg OR bags" });
  }

  const date = parseISODateToUTC(dateStr);

  // Déterminer saison si non fournie: saison active si existe
  let seasonId = parsed.data.seasonId ?? null;
  if (seasonId == null) {
    const active = await prisma.season.findFirst({ where: { endDate: null } });
    seasonId = active?.id ?? null;
  }

  const bagKg = parsed.data.bagKg ?? 15;
  const kg = parsed.data.kg ?? bagsToKg(parsed.data.bags!, bagKg);

  const row = await prisma.pelletDaily.upsert({
    where: { date },
    update: {
      kg,
      bags: parsed.data.bags ?? null,
      bagKg: parsed.data.bags != null ? bagKg : null,
      pricePerBag: parsed.data.pricePerBag ?? null,
      note: parsed.data.note ?? null,
      seasonId,
    },
    create: {
      date,
      kg,
      bags: parsed.data.bags ?? null,
      bagKg: parsed.data.bags != null ? bagKg : null,
      pricePerBag: parsed.data.pricePerBag ?? null,
      note: parsed.data.note ?? null,
      seasonId,
    },
  });

  res.json({ ok: true, row });
});

// Lire conso sur période
pelletsRouter.get("/pellets/daily", async (req, res) => {
  const schema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Use start/end YYYY-MM-DD" });

  const start = parseISODateToUTC(parsed.data.start);
  const end = parseISODateToUTC(parsed.data.end);

  const rows = await prisma.pelletDaily.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });

  res.json({ ok: true, rows: rows.map(r => ({ ...r, date: r.date.toISOString().slice(0,10) })) });
});

/**
 * STOCK
 */

// Initialiser (point de départ). On enregistre un mouvement INITIAL.
pelletsRouter.post("/stock/initial", async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kg: z.number().nonnegative(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const date = parseISODateToUTC(parsed.data.date);

  // On peut en autoriser plusieurs (si tu refais un inventaire),
  // mais pour un "point de départ", on peut aussi décider de nettoyer les anciens INITIAL.
  const mvt = await prisma.stockMovement.create({
    data: { type: "INITIAL", date, kg: parsed.data.kg, note: parsed.data.note ?? null },
  });

  res.json({ ok: true, movement: mvt });
});

// Livraison
pelletsRouter.post("/stock/delivery", async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kg: z.number().positive().optional(),
    bags: z.number().int().positive().optional(),
    bagKg: z.number().positive().optional().default(15),
    pricePerBag: z.number().nonnegative().optional(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (parsed.data.kg == null && parsed.data.bags == null) {
    return res.status(400).json({ error: "Provide kg OR bags" });
  }

  const date = parseISODateToUTC(parsed.data.date);
  const bagKg = parsed.data.bagKg ?? 15;
  const kg = parsed.data.kg ?? bagsToKg(parsed.data.bags!, bagKg);

  const mvt = await prisma.stockMovement.create({
    data: { type: "DELIVERY", date, kg, pricePerBag: parsed.data.pricePerBag ?? null, note: parsed.data.note ?? null },
  });

  res.json({ ok: true, movement: mvt });
});

// Correction inventaire (tu dis "il me reste X kg")
pelletsRouter.post("/stock/adjust", async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetKg: z.number().nonnegative(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const date = parseISODateToUTC(parsed.data.date);

  // stock courant à date -> calcule delta pour atteindre target
  const current = await computeStockAt(date);
  const delta = parsed.data.targetKg - current;

  const mvt = await prisma.stockMovement.create({
    data: { type: "ADJUST", date, kg: delta, note: parsed.data.note ?? null },
  });

  res.json({ ok: true, movement: mvt, previousKg: current, targetKg: parsed.data.targetKg, delta });
});

// Stock courant "maintenant"
pelletsRouter.get("/stock/current", async (_req, res) => {
  const today = new Date();
  const current = await computeStockAt(today);
  res.json({ ok: true, kg: current });
});

pelletsRouter.get("/stock/deliveries", async (_req, res) => {
  const rows = await prisma.stockMovement.findMany({
    where: { type: "DELIVERY" },
    orderBy: { date: "desc" },
  });

  res.json({
    ok: true,
    deliveries: rows.map((row) => ({
      ...row,
      date: row.date.toISOString().slice(0, 10),
    })),
  });
});

// --- helpers stock ---
async function computeStockAt(at: Date): Promise<number> {
  // Entrées stock
  const mvts = await prisma.stockMovement.findMany({
    where: { date: { lte: at } },
    select: { kg: true },
  });
  const inKg = mvts.reduce((a, m) => a + m.kg, 0);

  // Sorties = consommation journalière
  const consos = await prisma.pelletDaily.findMany({
    where: { date: { lte: at } },
    select: { kg: true },
  });
  const outKg = consos.reduce((a, c) => a + c.kg, 0);

  return inKg - outKg;
}

pelletsRouter.get("/season/:id/stats", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  // 1) Récupérer la saison
  const season = await prisma.season.findUnique({ where: { id } });
  if (!season) {
    return res.status(404).json({ error: "Season not found" });
  }

  const start = season.startDate;
  const end = season.endDate ?? new Date(); // saison en cours

  // 2) Récupérer les consommations journalières de granulés
  const pellets = await prisma.pelletDaily.findMany({
    where: {
      date: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      kg: true,
    },
  });

  if (pellets.length === 0) {
    return res.json({
      ok: true,
      season: {
        id: season.id,
        name: season.name,
        start: season.startDate.toISOString().slice(0, 10),
        end: season.endDate ? season.endDate.toISOString().slice(0, 10) : null,
        baseC: season.baseC,
      },
      kgTotal: 0,
      djuTotal: 0,
      kgPerDJU: null,
      series: [],
    });
  }

  // 3) Total granulés
  const kgTotal = pellets.reduce((sum, p) => sum + p.kg, 0);

  // 4) DJU UNIQUEMENT sur les jours où il y a une conso pellet
  const pelletDates = pellets.map(p => p.date);

  const djuRows = await prisma.djuDay.findMany({
    where: {
      date: {
        in: pelletDates,
      },
    },
    select: {
      date: true,
      dju: true,
    },
  });

  const djuMap = new Map<string, number>();
  for (const d of djuRows) {
    djuMap.set(d.date.toISOString().slice(0, 10), d.dju);
  }

  const djuTotal = djuRows.reduce((sum, d) => sum + d.dju, 0);
  const kgPerDJU = djuTotal > 0 ? kgTotal / djuTotal : null;

  // 5) Série alignée jour par jour (kg + DJU)
  const series = pellets.map(p => {
    const dateStr = p.date.toISOString().slice(0, 10);
    return {
      date: dateStr,
      kg: p.kg,
      dju: djuMap.get(dateStr) ?? 0,
    };
  });

  // 6) Réponse finale
  res.json({
    ok: true,
    season: {
      id: season.id,
      name: season.name,
      start: season.startDate.toISOString().slice(0, 10),
      end: season.endDate ? season.endDate.toISOString().slice(0, 10) : null,
      baseC: season.baseC,
    },
    kgTotal,
    djuTotal,
    kgPerDJU,
    series,
  });
});

pelletsRouter.post("/pellets/daily/bulk", async (req, res) => {
  const schema = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    bags: z.number().int().positive().optional(),
    kg: z.number().positive().optional(),
    bagKg: z.number().positive().optional().default(15),
    pricePerBag: z.number().nonnegative().optional(),
    note: z.string().optional(),
    seasonId: z.number().int().optional(),
    skipExisting: z.boolean().optional().default(true),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  if (parsed.data.kg == null && parsed.data.bags == null) {
    return res.status(400).json({ error: "Provide kg OR bags" });
  }

  const parseISODateToUTC = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const start = parseISODateToUTC(parsed.data.start);
  const end = parseISODateToUTC(parsed.data.end);

  if (end < start) return res.status(400).json({ error: "end must be >= start" });

  // Déterminer saison si non fournie
  let seasonId = parsed.data.seasonId ?? null;
  if (seasonId == null) {
    const active = await prisma.season.findFirst({ where: { endDate: null } });
    seasonId = active?.id ?? null;
  }

  const bagKg = parsed.data.bagKg ?? 15;
  const kgValue = parsed.data.kg ?? (parsed.data.bags! * bagKg);

  // Liste des dates à remplir (inclusive)
  const dates: Date[] = [];
  for (let d = new Date(start); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))) {
    dates.push(new Date(d));
  }

  // Récup existants si skipExisting
  let existingSet = new Set<string>();
  if (parsed.data.skipExisting) {
    const existing = await prisma.pelletDaily.findMany({
      where: { date: { in: dates } },
      select: { date: true },
    });
    existingSet = new Set(existing.map(e => e.date.toISOString().slice(0, 10)));
  }

  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);

    if (parsed.data.skipExisting && existingSet.has(key)) {
      skipped++;
      continue;
    }

    const row = await prisma.pelletDaily.upsert({
      where: { date: d },
      update: {
        kg: kgValue,
        bags: parsed.data.bags ?? null,
        bagKg: parsed.data.bags != null ? bagKg : null,
        pricePerBag: parsed.data.pricePerBag ?? null,
        note: parsed.data.note ?? null,
        seasonId,
      },
      create: {
        date: d,
        kg: kgValue,
        bags: parsed.data.bags ?? null,
        bagKg: parsed.data.bags != null ? bagKg : null,
        pricePerBag: parsed.data.pricePerBag ?? null,
        note: parsed.data.note ?? null,
        seasonId,
      },
    });

    // Si le jour existait mais skipExisting=false, c’est un update
    // (On peut détecter finement, mais on fait simple)
    if (existingSet.has(key)) updated++;
    else inserted++;
  }

  res.json({ ok: true, inserted, updated, skipped, kgPerDay: kgValue });
});
