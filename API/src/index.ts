import express from "express";
import cron from "node-cron";
import { router } from "./routes/dju.routes";
import { pelletsRouter } from "./routes/pellets.routes";
import { backfillLastYear } from "./jobs/backfill.job";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API Conso Chauffage OK ✅");
});

// ✅ IMPORTANT : prefix
app.use("/api", router);
app.use("/api", pelletsRouter);

const PORT = Number(process.env.PORT ?? 3001);

async function main() {
  await backfillLastYear().catch(console.error);

  cron.schedule("10 3 * * *", async () => {
    await backfillLastYear().catch(console.error);
  });

  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

main();
