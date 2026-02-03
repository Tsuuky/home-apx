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
import { api } from "../services/api";
import { IconWater } from "../components/icons";

type Reading = {
  date: string;
  cubicM: number;
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
  const [newNote, setNewNote] = useState("");

  const [updateDate, setUpdateDate] = useState(todayISO());
  const [updateCubicM, setUpdateCubicM] = useState("");
  const [updateNote, setUpdateNote] = useState("");

  const [deleteDate, setDeleteDate] = useState(todayISO());

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

  const avgPerDay = useMemo(() => {
    if (intervals.length === 0) return null;
    const total = intervals.reduce((sum, row) => sum + row.perDay, 0);
    return total / intervals.length;
  }, [intervals]);

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
      intervals.map((row) => ({
        date: row.to,
        perDay: Number(row.perDay.toFixed(3)),
        delta: Number(row.delta.toFixed(2)),
      })),
    [intervals]
  );

  async function submitCreate() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const cubicM = Number(newCubicM);
      if (!Number.isFinite(cubicM) || cubicM < 0) throw new Error("Valeur m³ invalide");

      await api.post("/water/cold", {
        date: newDate,
        cubicM,
        note: newNote || undefined,
      });

      setMessage("✅ Relevé eau froide créé");
      setNewCubicM("");
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
      const payload: { cubicM?: number; note?: string } = {};
      if (updateCubicM.trim()) {
        const cubicM = Number(updateCubicM);
        if (!Number.isFinite(cubicM) || cubicM < 0) throw new Error("Valeur m³ invalide");
        payload.cubicM = cubicM;
      }
      if (updateNote.trim()) payload.note = updateNote.trim();

      if (Object.keys(payload).length === 0) throw new Error("Renseigne une valeur à modifier");

      await api.patch(`/water/cold/${updateDate}`, payload);
      setMessage("✅ Relevé eau froide mis à jour");
      setUpdateCubicM("");
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
        <div className={reminderBadge}>{reminderText}</div>
      </section>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <section className="section-card">
        <h2 className="section-title">Graphique de consommation</h2>
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
                <Legend />
                <Line type="monotone" dataKey="perDay" name="m³ / jour" stroke="#7cb8ff" />
                <Line type="monotone" dataKey="delta" name="Conso période (m³)" stroke="#7dffa7" />
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
          </div>
        )}
      </section>

      <section className="section-card">
        <h2 className="section-title">Détail des périodes</h2>
        {intervals.length === 0 ? (
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
                {intervals.map((row) => {
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

      <section className="section-card">
        <h2 className="section-title">Créer un relevé</h2>
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Index (m³)</label>
          <input className="input" value={newCubicM} onChange={(e) => setNewCubicM(e.target.value)} placeholder="ex: 123.4" />
        </div>
        <div className="form-row">
          <label>Note</label>
          <input className="input" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="optionnel" />
        </div>
        <button className="btn btn-primary" onClick={submitCreate} disabled={busy}>
          Enregistrer
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Modifier un relevé</h2>
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
          <label>Note</label>
          <input className="input" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} placeholder="optionnel" />
        </div>
        <button className="btn" onClick={submitUpdate} disabled={busy}>
          Mettre à jour
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Supprimer un relevé</h2>
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={deleteDate} onChange={(e) => setDeleteDate(e.target.value)} />
        </div>
        <button className="btn" onClick={submitDelete} disabled={busy}>
          Supprimer
        </button>
      </section>
    </div>
  );
}
