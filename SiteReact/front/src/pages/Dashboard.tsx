import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type ActiveSeasonResponse = {
  ok: boolean;
  season: null | {
    id: number;
    name: string;
    startDate: string; // ISO
    endDate: string | null;
    baseC: number;
    createdAt: string;
  };
};

type SeasonStatsResponse = {
  ok: boolean;
  season: {
    id: number;
    name: string;
    start: string; // YYYY-MM-DD
    end: string | null;
    baseC: number;
  };
  kgTotal: number;
  djuTotal: number;
  kgPerDJU: number | null;
  series: Array<{ date: string; kg: number; dju: number }>;
};

type StockCurrentResponse = {
  ok: boolean;
  kg: number;
};

function formatNumberFR(n: number, digits = 1) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function bagsFromKg(kg: number, bagKg = 15) {
  const full = Math.floor(kg / bagKg);
  const rem = Math.round((kg - full * bagKg) * 10) / 10;
  return { fullBags: full, remainderKg: rem };
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayISO() {
  return toISODate(new Date());
}

function firstDayOfMonthISO() {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<ActiveSeasonResponse["season"]>(null);
  const [stats, setStats] = useState<SeasonStatsResponse | null>(null);
  const [stockKg, setStockKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Settings “soft” (plus tard ça viendra d’une config)
  const defaultBagKg = 15;

  // ---- Actions rapides : conso jour
  const [pelletDate, setPelletDate] = useState(todayISO());
  const [pelletBags, setPelletBags] = useState<string>("2"); // smart default
  const [pelletBagKg, setPelletBagKg] = useState<string>(String(defaultBagKg));
  const [pelletNote, setPelletNote] = useState<string>("");

  // ---- Livraison
  const [deliveryDate, setDeliveryDate] = useState(todayISO());
  const [deliveryBags, setDeliveryBags] = useState<string>("");
  const [deliveryKg, setDeliveryKg] = useState<string>("");
  const [deliveryNote, setDeliveryNote] = useState<string>("");

  // ---- Ajustement stock
  const [adjustDate, setAdjustDate] = useState(todayISO());
  const [adjustTargetKg, setAdjustTargetKg] = useState<string>("");
  const [adjustNote, setAdjustNote] = useState<string>("");

  // ---- Bulk (plage)
  const [bulkStart, setBulkStart] = useState(firstDayOfMonthISO());
  const [bulkEnd, setBulkEnd] = useState(todayISO());
  const [bulkBags, setBulkBags] = useState<string>("2"); // smart default
  const [bulkBagKg, setBulkBagKg] = useState<string>(String(defaultBagKg));
  const [bulkNote, setBulkNote] = useState<string>("");
  const [bulkSkipExisting, setBulkSkipExisting] = useState(true);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const s = await api.get<ActiveSeasonResponse>("/season/active");

      if (!s.data.season) {
        setSeason(null);
        setStats(null);
        setStockKg(null);
        setLoading(false);
        return;
      }

      setSeason(s.data.season);

      const st = await api.get<SeasonStatsResponse>(`/season/${s.data.season.id}/stats`);
      setStats(st.data);

      const sk = await api.get<StockCurrentResponse>("/stock/current");
      setStockKg(sk.data.kg);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const lastDays = useMemo(() => {
    const arr = stats?.series ?? [];
    return arr.slice(-10).reverse();
  }, [stats]);

  const cumSeries = useMemo(() => {
    const arr = stats?.series ?? [];
    let cumKg = 0;
    let cumDju = 0;
    return arr.map((r) => {
      cumKg += r.kg;
      cumDju += r.dju;
      return {
        date: r.date,
        kg: r.kg,
        dju: r.dju,
        cumKg,
        cumDju,
      };
    });
  }, [stats]);

  const stockBags = useMemo(() => {
    if (stockKg == null) return null;
    return bagsFromKg(stockKg, defaultBagKg);
  }, [stockKg]);

  async function submitPellets() {
    setActionBusy(true);
    setActionMsg(null);
    setError(null);

    try {
      const bags = Number(pelletBags);
      const bagKg = Number(pelletBagKg);

      if (!Number.isFinite(bags) || bags <= 0) throw new Error("Sacs: valeur invalide");
      if (!Number.isFinite(bagKg) || bagKg <= 0) throw new Error("Poids sac: valeur invalide");

      await api.put(`/pellets/daily/${pelletDate}`, {
        bags,
        bagKg,
        note: pelletNote || undefined,
      });

      setActionMsg(`✅ Consommation enregistrée (${pelletDate})`);
      setPelletNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setActionBusy(false);
    }
  }

  async function submitDelivery() {
    setActionBusy(true);
    setActionMsg(null);
    setError(null);

    try {
      const kg = deliveryKg.trim() ? Number(deliveryKg) : null;
      const bags = deliveryBags.trim() ? Number(deliveryBags) : null;

      const payload: any = { date: deliveryDate };

      const bagKg = Number(pelletBagKg) || defaultBagKg;

      if (kg != null && Number.isFinite(kg) && kg > 0) payload.kg = kg;
      if (bags != null && Number.isFinite(bags) && bags > 0) {
        payload.bags = bags;
        payload.bagKg = bagKg;
      }

      if (!payload.kg && !payload.bags) {
        throw new Error("Donne soit kg, soit sacs (valeur > 0)");
      }

      if (deliveryNote) payload.note = deliveryNote;

      await api.post("/stock/delivery", payload);

      setActionMsg(`✅ Livraison enregistrée (${deliveryDate})`);
      setDeliveryKg("");
      setDeliveryBags("");
      setDeliveryNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setActionBusy(false);
    }
  }

  async function submitAdjust() {
    setActionBusy(true);
    setActionMsg(null);
    setError(null);

    try {
      const targetKg = Number(adjustTargetKg);
      if (!Number.isFinite(targetKg) || targetKg < 0) throw new Error("Stock cible (kg): valeur invalide");

      await api.post("/stock/adjust", {
        date: adjustDate,
        targetKg,
        note: adjustNote || undefined,
      });

      setActionMsg(`✅ Stock ajusté (${adjustDate})`);
      setAdjustTargetKg("");
      setAdjustNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setActionBusy(false);
    }
  }

  async function submitBulk() {
    setActionBusy(true);
    setActionMsg(null);
    setError(null);

    try {
      const bags = Number(bulkBags);
      const bagKg = Number(bulkBagKg);

      if (!Number.isFinite(bags) || bags <= 0) throw new Error("Bulk sacs: valeur invalide");
      if (!Number.isFinite(bagKg) || bagKg <= 0) throw new Error("Bulk kg/sac: valeur invalide");

      const r = await api.post("/pellets/daily/bulk", {
        start: bulkStart,
        end: bulkEnd,
        bags,
        bagKg,
        note: bulkNote || undefined,
        skipExisting: bulkSkipExisting,
      });

      setActionMsg(`✅ Bulk OK — inserted: ${r.data.inserted}, skipped: ${r.data.skipped}, updated: ${r.data.updated}`);
      setBulkNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="page">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.8 }}>Suivi granulés ↔ DJU (Yvetot)</p>
        </div>

        <button onClick={refresh} style={btnStyle} disabled={loading || actionBusy}>
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>
      </header>

      {actionMsg && <div style={okStyle}>{actionMsg}</div>}

      {error && (
        <div style={alertStyle}>
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {!loading && !season && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Aucune saison active</h2>
          <p style={{ opacity: 0.85 }}>
            Crée une saison via l’API (<code>/season</code>) puis saisis ta consommation journalière.
          </p>
        </div>
      )}

      {season && (
        <>
          {/* KPI */}
          <div style={gridStyle}>
            <div style={cardStyle}>
              <div style={labelStyle}>Saison active</div>
              <div style={valueStyle}>{season.name}</div>
              <div style={subStyle}>
                Début : {new Date(season.startDate).toISOString().slice(0, 10)}{" "}
                {season.endDate ? `— Fin : ${new Date(season.endDate).toISOString().slice(0, 10)}` : "— En cours"}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Granulés consommés</div>
              <div style={valueStyle}>{stats ? `${formatNumberFR(stats.kgTotal, 1)} kg` : "—"}</div>
              <div style={subStyle}>Total sur jours saisis</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>DJU cumulés</div>
              <div style={valueStyle}>{stats ? formatNumberFR(stats.djuTotal, 1) : "—"}</div>
              <div style={subStyle}>Sur les mêmes jours</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>kg / DJU</div>
              <div style={valueStyle}>{stats?.kgPerDJU != null ? formatNumberFR(stats.kgPerDJU, 2) : "—"}</div>
              <div style={subStyle}>Indicateur chauffage</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Stock actuel</div>
              <div style={valueStyle}>{stockKg != null ? `${formatNumberFR(stockKg, 0)} kg` : "—"}</div>
              <div style={subStyle}>
                {stockBags ? `≈ ${stockBags.fullBags} sacs + ${formatNumberFR(stockBags.remainderKg, 1)} kg` : ""}
              </div>
            </div>
          </div>

          {/* Graph cumul */}
          <div style={{ marginTop: 18, ...cardStyle }}>
            <h2 style={{ marginTop: 0 }}>Courbes cumulées</h2>
            <p style={{ marginTop: 0, opacity: 0.75, fontSize: 12 }}>
              Lecture rapide : si la pente (kg cumulés / DJU cumulés) augmente, tu consommes plus à froid égal.
            </p>

            {cumSeries.length < 2 ? (
              <p style={{ opacity: 0.85 }}>Pas assez de données (minimum 2 jours).</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={cumSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="cumKg" name="kg cumulés" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="cumDju" name="DJU cumulés" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Actions rapides */}
          <div style={{ marginTop: 18, ...cardStyle }}>
            <h2 style={{ marginTop: 0 }}>Actions rapides</h2>

            <div style={actionsGridStyle}>
              <div style={miniCardStyle}>
                <h3 style={miniTitle}>Consommation du jour</h3>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Date</label>
                  <input style={inputStyle} type="date" value={pelletDate} onChange={(e) => setPelletDate(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Sacs</label>
                  <input style={inputStyle} inputMode="numeric" value={pelletBags} onChange={(e) => setPelletBags(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>kg / sac</label>
                  <input style={inputStyle} inputMode="numeric" value={pelletBagKg} onChange={(e) => setPelletBagKg(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Note</label>
                  <input style={inputStyle} value={pelletNote} onChange={(e) => setPelletNote(e.target.value)} placeholder="optionnel" />
                </div>

                <button style={primaryBtnStyle} onClick={submitPellets} disabled={actionBusy}>
                  Enregistrer
                </button>
              </div>

              <div style={miniCardStyle}>
                <h3 style={miniTitle}>Livraison</h3>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Date</label>
                  <input style={inputStyle} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>kg</label>
                  <input style={inputStyle} inputMode="numeric" value={deliveryKg} onChange={(e) => setDeliveryKg(e.target.value)} placeholder="ex: 900" />
                </div>

                <div style={{ ...rowStyle, opacity: 0.85 }}>
                  <label style={fieldLabel}>ou sacs</label>
                  <input style={inputStyle} inputMode="numeric" value={deliveryBags} onChange={(e) => setDeliveryBags(e.target.value)} placeholder="ex: 60" />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Note</label>
                  <input style={inputStyle} value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="optionnel" />
                </div>

                <button style={primaryBtnStyle} onClick={submitDelivery} disabled={actionBusy}>
                  Ajouter
                </button>
              </div>

              <div style={miniCardStyle}>
                <h3 style={miniTitle}>Correction inventaire</h3>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Date</label>
                  <input style={inputStyle} type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Stock réel (kg)</label>
                  <input style={inputStyle} inputMode="numeric" value={adjustTargetKg} onChange={(e) => setAdjustTargetKg(e.target.value)} placeholder="ex: 420" />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Note</label>
                  <input style={inputStyle} value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="optionnel" />
                </div>

                <button style={primaryBtnStyle} onClick={submitAdjust} disabled={actionBusy}>
                  Corriger
                </button>
              </div>

              <div style={miniCardStyle}>
                <h3 style={miniTitle}>Remplir une plage (bulk)</h3>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Début</label>
                  <input style={inputStyle} type="date" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Fin</label>
                  <input style={inputStyle} type="date" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Sacs / jour</label>
                  <input style={inputStyle} inputMode="numeric" value={bulkBags} onChange={(e) => setBulkBags(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>kg / sac</label>
                  <input style={inputStyle} inputMode="numeric" value={bulkBagKg} onChange={(e) => setBulkBagKg(e.target.value)} />
                </div>

                <div style={rowStyle}>
                  <label style={fieldLabel}>Note</label>
                  <input style={inputStyle} value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="optionnel" />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                  <input type="checkbox" checked={bulkSkipExisting} onChange={(e) => setBulkSkipExisting(e.target.checked)} />
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Ne pas écraser les jours déjà saisis</span>
                </div>

                <button style={primaryBtnStyle} onClick={submitBulk} disabled={actionBusy}>
                  Appliquer
                </button>
              </div>
            </div>
          </div>

          {/* Derniers jours */}
          <div style={{ marginTop: 18, ...cardStyle }}>
            <h2 style={{ marginTop: 0 }}>Derniers jours saisis</h2>

            {stats && stats.series.length === 0 ? (
              <p style={{ opacity: 0.85 }}>Aucune consommation journalière enregistrée.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>kg</th>
                      <th style={thStyle}>DJU</th>
                      <th style={thStyle}>kg/DJU (jour)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastDays.map((r) => (
                      <tr key={r.date}>
                        <td style={tdStyle}>{r.date}</td>
                        <td style={tdStyle}>{formatNumberFR(r.kg, 1)}</td>
                        <td style={tdStyle}>{formatNumberFR(r.dju, 1)}</td>
                        <td style={tdStyle}>{r.dju > 0 ? formatNumberFR(r.kg / r.dju, 2) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  marginTop: 10,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(120,180,255,0.18)",
  color: "inherit",
  cursor: "pointer",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginTop: 18,
};

const actionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
  marginTop: 12,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
};

const miniCardStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  padding: 14,
};

const miniTitle: React.CSSProperties = {
  margin: 0,
  marginBottom: 10,
  fontSize: 14,
  opacity: 0.9,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: 8,
};

const valueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  marginBottom: 6,
};

const subStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
};

const okStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(80,255,140,0.28)",
  background: "rgba(80,255,140,0.10)",
};

const alertStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 1fr",
  gap: 10,
  alignItems: "center",
  marginBottom: 8,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.15)",
  color: "inherit",
  outline: "none",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  opacity: 0.8,
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  padding: "10px 8px",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  padding: "10px 8px",
  fontSize: 13,
};
