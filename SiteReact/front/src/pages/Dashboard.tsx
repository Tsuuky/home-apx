import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

type ActiveSeasonResponse = {
  ok: boolean;
  season: null | {
    id: number;
    name: string;
    startDate: string;
    endDate: string | null;
    baseC: number;
  };
};

type SeasonStatsResponse = {
  ok: boolean;
  season: {
    id: number;
    name: string;
    start: string;
    end: string | null;
    baseC: number;
  };
  kgTotal: number;
  djuTotal: number;
  kgPerDJU: number | null;
};

type WaterReading = {
  date: string;
  cubicM: number;
  note?: string | null;
};

type WaterResponse = {
  ok: boolean;
  readings: WaterReading[];
};

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function diffDays(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<ActiveSeasonResponse["season"]>(null);
  const [stats, setStats] = useState<SeasonStatsResponse | null>(null);
  const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const s = await api.get<ActiveSeasonResponse>("/season/active");
      setSeason(s.data.season);

      if (s.data.season) {
        const st = await api.get<SeasonStatsResponse>(`/season/${s.data.season.id}/stats`);
        setStats(st.data);
      } else {
        setStats(null);
      }

      const water = await api.get<WaterResponse>("/water/cold");
      setWaterReadings(water.data.readings ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const waterAvg = useMemo(() => {
    if (waterReadings.length < 2) return null;
    const sorted = [...waterReadings].sort((a, b) => a.date.localeCompare(b.date));
    const perDay = [] as number[];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const delta = Math.max(0, curr.cubicM - prev.cubicM);
      const days = diffDays(prev.date, curr.date);
      perDay.push(delta / days);
    }
    const total = perDay.reduce((sum, v) => sum + v, 0);
    return total / perDay.length;
  }, [waterReadings]);

  const lastWater = useMemo(() => {
    if (waterReadings.length === 0) return null;
    return [...waterReadings].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [waterReadings]);

  return (
    <div className="page">
      <section className="section-card">
        <h1 className="section-title">Dashboard</h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Vue globale des consommations bois et eau froide.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn" to="/wood">
            Voir la conso bois
          </Link>
          <Link className="btn" to="/water">
            Voir l’eau froide
          </Link>
          <Link className="btn" to="/readings">
            Voir toutes les relèves
          </Link>
        </div>
      </section>

      {error && <div className="notice notice-error">{error}</div>}

      <section className="section-card">
        <h2 className="section-title">Bois</h2>
        {loading ? (
          <p>Chargement…</p>
        ) : !season ? (
          <p>Aucune saison active.</p>
        ) : (
          <div className="grid-two">
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Saison active</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{season.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Début : {new Date(season.startDate).toISOString().slice(0, 10)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Granulés consommés</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{stats ? `${stats.kgTotal.toFixed(1)} kg` : "—"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                kg/DJU : {stats?.kgPerDJU != null ? stats.kgPerDJU.toFixed(2) : "—"}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="section-card">
        <h2 className="section-title">Eau froide</h2>
        {loading ? (
          <p>Chargement…</p>
        ) : (
          <div className="grid-two">
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Dernier relevé</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {lastWater ? `${lastWater.cubicM.toFixed(2)} m³` : "—"}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Date : {lastWater?.date ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Moyenne conso/jour</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{waterAvg != null ? `${waterAvg.toFixed(3)} m³` : "—"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Calculée entre les relevés</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
