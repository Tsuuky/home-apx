import { useEffect, useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { IconWater } from "../components/icons";
import Modal from "../components/Modal";

type Reading = {
  date: string;
  cubicM: number;
  pricePerM3?: number | null;
  note?: string | null;
};

type ReadingsResponse = {
  ok: boolean;
  readings: Reading[];
};

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

function diffDays(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function Water() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState(todayISO());
  const [newCubicM, setNewCubicM] = useState("");
  const [newPricePerM3, setNewPricePerM3] = useState("");
  const [newNote, setNewNote] = useState("");

  const [updateDate, setUpdateDate] = useState(todayISO());
  const [updateCubicM, setUpdateCubicM] = useState("");
  const [updatePricePerM3, setUpdatePricePerM3] = useState("");
  const [updateNote, setUpdateNote] = useState("");

  const [deleteDate, setDeleteDate] = useState(todayISO());

  const navigate = useNavigate();

  const [modalType, setModalType] = useState<"create" | "edit" | "delete" | null>(null);
  const [rangeType, setRangeType] = useState<"custom" | "week" | "month" | "year">("month");
  const [rangeStart, setRangeStart] = useState(firstDayOfMonthISO());
  const [rangeEnd, setRangeEnd] = useState(todayISO());
  const [visibleLines, setVisibleLines] = useState({ perDay: true, delta: true });

  function toggleLine(key: "perDay" | "delta") {
    setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const res = await api.get<ReadingsResponse>("/water/cold");
      setReadings(res.data.readings);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const intervals = useMemo(() => {
    if (readings.length < 2) return [] as Array<{
      from: string;
      to: string;
      delta: number;
      days: number;
      perDay: number;
    }>;

    const items = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const rows = [] as Array<{
      from: string;
      to: string;
      delta: number;
      days: number;
      perDay: number;
    }>;

    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1];
      const curr = items[i];
      const delta = Math.max(0, curr.cubicM - prev.cubicM);
      const days = diffDays(prev.date, curr.date);
      rows.push({
        from: prev.date,
        to: curr.date,
        delta,
        days,
        perDay: delta / days,
      });
    }
    return rows;
  }, [readings]);

  const filteredIntervals = useMemo(() => {
    if (intervals.length === 0) return [];
    const today = new Date();
    let start = rangeStart;
    let end = rangeEnd;
    if (rangeType !== "custom") {
      const startDate = new Date(today);
      if (rangeType === "week") startDate.setDate(today.getDate() - 7);
      if (rangeType === "month") startDate.setMonth(today.getMonth() - 1);
      if (rangeType === "year") startDate.setFullYear(today.getFullYear() - 1);
      start = toISODate(startDate);
      end = toISODate(today);
    }
    return intervals.filter((row) => row.to >= start && row.to <= end);
  }, [intervals, rangeType, rangeStart, rangeEnd]);

  const avgPerDay = useMemo(() => {
    if (filteredIntervals.length === 0) return null;
    const total = filteredIntervals.reduce((sum, row) => sum + row.perDay, 0);
    return total / filteredIntervals.length;
  }, [filteredIntervals]);

  const latestPricePerM3 = useMemo(() => {
    if (readings.length === 0) return null;
    const sorted = [...readings].sort((a, b) => b.date.localeCompare(a.date));
    for (const row of sorted) {
      if (row.pricePerM3 != null) return row.pricePerM3;
    }
    return null;
  }, [readings]);

  const reminderBadge = useMemo(() => {
    if (readings.length === 0) return "badge badge-alert";
    const last = readings[readings.length - 1];
    const days = diffDays(last.date, todayISO());
    if (days > 31) return "badge badge-alert";
    if (days > 23) return "badge badge-warning";
    return "badge";
  }, [readings]);

  const reminderText = useMemo(() => {
    if (readings.length === 0) return "Aucun relevé : pensez à saisir le premier.";
    const last = readings[readings.length - 1];
    const days = diffDays(last.date, todayISO());
    if (days > 31) return `Dernier relevé il y a ${days} jours : rappel mensuel dépassé.`;
    if (days > 23) return `Rappel : dernier relevé il y a ${days} jours.`;
    return `Dernier relevé il y a ${days} jours.`;
  }, [readings]);

  const chartData = useMemo(
    () =>
      filteredIntervals.map((row) => ({
        date: row.to,
        perDay: Number(row.perDay.toFixed(3)),
        delta: Number(row.delta.toFixed(2)),
      })),
    [filteredIntervals]
  );

  async function submitCreate() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const cubicM = Number(newCubicM);
      if (!Number.isFinite(cubicM) || cubicM < 0) throw new Error("Valeur m³ invalide");
      const pricePerM3 = newPricePerM3.trim() ? Number(newPricePerM3) : null;
      if (pricePerM3 != null && (!Number.isFinite(pricePerM3) || pricePerM3 < 0)) {
        throw new Error("Prix m³ invalide");
      }

      await api.post("/water/cold", {
        date: newDate,
        cubicM,
        pricePerM3: pricePerM3 ?? undefined,
        note: newNote || undefined,
      });

      setMessage("✅ Relevé eau froide créé");
      setNewCubicM("");
      setNewPricePerM3("");
      setNewNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const payload: { cubicM?: number; pricePerM3?: number; note?: string } = {};
      if (updateCubicM.trim()) {
        const cubicM = Number(updateCubicM);
        if (!Number.isFinite(cubicM) || cubicM < 0) throw new Error("Valeur m³ invalide");
        payload.cubicM = cubicM;
      }
      if (updatePricePerM3.trim()) {
        const pricePerM3 = Number(updatePricePerM3);
        if (!Number.isFinite(pricePerM3) || pricePerM3 < 0) throw new Error("Prix m³ invalide");
        payload.pricePerM3 = pricePerM3;
      }
      if (updateNote.trim()) payload.note = updateNote.trim();

      if (Object.keys(payload).length === 0) throw new Error("Renseigne une valeur à modifier");

      await api.patch(`/water/cold/${updateDate}`, payload);
      setMessage("✅ Relevé eau froide mis à jour");
      setUpdateCubicM("");
      setUpdatePricePerM3("");
      setUpdateNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await api.delete(`/water/cold/${deleteDate}`);
      setMessage("✅ Relevé eau froide supprimé");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setModalType(null);
  }

  return (
    <div className="page">
      <section className="section-card">
        <h1 className="section-title">
          <IconWater />
          Eau froide
        </h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Suivi mensuel des compteurs d’eau froide avec consommation moyenne par jour et alertes.
        </p>
        <button className="btn" onClick={() => navigate("/readings")}>
          Voir les relevés eau froide
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="btn" onClick={() => setModalType("create")}>
            Créer un relevé
          </button>
          <button className="btn" onClick={() => setModalType("edit")}>
            Modifier un relevé
          </button>
          <button className="btn" onClick={() => setModalType("delete")}>
            Supprimer un relevé
          </button>
        </div>
        <div className={reminderBadge}>{reminderText}</div>
      </section>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <section className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 className="section-title">Graphique de consommation</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="input"
              value={rangeType}
              onChange={(e) => setRangeType(e.target.value as "custom" | "week" | "month" | "year")}
            >
              <option value="week">7 jours</option>
              <option value="month">1 mois</option>
              <option value="year">1 an</option>
              <option value="custom">Période</option>
            </select>
            {rangeType === "custom" && (
              <>
                <input className="input" type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
                <input className="input" type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
              </>
            )}
          </div>
        </div>
      {loading ? (
        <p>Chargement…</p>
      ) : chartData.length === 0 ? (
        <p>Ajoutez au moins deux relevés pour générer le graphique.</p>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend
                  onClick={(entry) => {
                    const key = entry?.dataKey;
                    if (key === "perDay" || key === "delta") {
                      toggleLine(key);
                    }
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="perDay"
                  name="m³ / jour"
                  stroke="#7cb8ff"
                  hide={!visibleLines.perDay}
                  onClick={() => toggleLine("perDay")}
                />
                <Line
                  type="monotone"
                  dataKey="delta"
                  name="Conso période (m³)"
                  stroke="#7dffa7"
                  hide={!visibleLines.delta}
                  onClick={() => toggleLine("delta")}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="section-card">
        <h2 className="section-title">Stats</h2>
        {avgPerDay == null ? (
          <p>Pas assez de données pour calculer la moyenne.</p>
        ) : (
          <div className="grid-two">
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Moyenne</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{avgPerDay.toFixed(3)} m³ / jour</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Dernière période</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {intervals.length > 0 ? intervals[intervals.length - 1].perDay.toFixed(3) : "—"} m³ / jour
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Dernier prix m³</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>
                {latestPricePerM3 != null ? `${latestPricePerM3.toFixed(2)} € / m³` : "—"}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="section-card">
        <h2 className="section-title">Détail des périodes</h2>
        {filteredIntervals.length === 0 ? (
          <p>Pas assez de relevés.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Période</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Conso</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>m³/jour</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Écart</th>
                </tr>
              </thead>
              <tbody>
                {filteredIntervals.map((row) => {
                  const ratio = avgPerDay ? row.perDay / avgPerDay : 1;
                  const isHigh = ratio > 1.25;
                  const isLow = ratio < 0.75;
                  const color = isHigh ? "#ff8c8c" : isLow ? "#ffd27d" : "inherit";
                  const label = isHigh ? "Conso élevée" : isLow ? "Conso basse" : "Normal";
                  return (
                    <tr key={row.to} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "8px" }}>
                        {row.from} → {row.to} ({row.days} j)
                      </td>
                      <td style={{ padding: "8px" }}>{row.delta.toFixed(2)} m³</td>
                      <td style={{ padding: "8px", color }}>{row.perDay.toFixed(3)}</td>
                      <td style={{ padding: "8px", color }}>{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalType && (
        <Modal
          title={
            modalType === "create"
              ? "Créer un relevé"
              : modalType === "edit"
              ? "Modifier un relevé"
              : "Supprimer un relevé"
          }
          onClose={closeModal}
        >
          {modalType === "create" && (
            <>
              <div className="form-row">
                <label>Date</label>
                <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Index (m³)</label>
                <input className="input" value={newCubicM} onChange={(e) => setNewCubicM(e.target.value)} placeholder="ex: 123.4" />
              </div>
              <div className="form-row">
                <label>Prix m³ (€)</label>
                <input
                  className="input"
                  value={newPricePerM3}
                  onChange={(e) => setNewPricePerM3(e.target.value)}
                  placeholder="ex: 2.85"
                />
              </div>
              <div className="form-row">
                <label>Note</label>
                <input className="input" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="optionnel" />
              </div>
              <button className="btn btn-primary" onClick={submitCreate} disabled={busy}>
                Enregistrer
              </button>
            </>
          )}
          {modalType === "edit" && (
            <>
              <div className="form-row">
                <label>Date</label>
                <input className="input" type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Nouveau m³</label>
                <input
                  className="input"
                  value={updateCubicM}
                  onChange={(e) => setUpdateCubicM(e.target.value)}
                  placeholder="ex: 124.0"
                />
              </div>
              <div className="form-row">
                <label>Prix m³ (€)</label>
                <input
                  className="input"
                  value={updatePricePerM3}
                  onChange={(e) => setUpdatePricePerM3(e.target.value)}
                  placeholder="ex: 2.85"
                />
              </div>
              <div className="form-row">
                <label>Note</label>
                <input className="input" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} placeholder="optionnel" />
              </div>
              <button className="btn btn-primary" onClick={submitUpdate} disabled={busy}>
                Mettre à jour
              </button>
            </>
          )}
          {modalType === "delete" && (
            <>
              <div className="form-row">
                <label>Date</label>
                <input className="input" type="date" value={deleteDate} onChange={(e) => setDeleteDate(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={submitDelete} disabled={busy}>
                Supprimer
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
