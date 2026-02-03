import { useEffect, useState } from "react";
import { api } from "../services/api";
import { IconSeason } from "../components/icons";

type ActiveSeasonResponse = {
  ok: boolean;
  season: null | {
    id: number;
    name: string;
    startDate: string;
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
    start: string;
    end: string | null;
    baseC: number;
  };
  kgTotal: number;
  djuTotal: number;
  kgPerDJU: number | null;
  series: Array<{ date: string; kg: number; dju: number }>;
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

export default function Season() {
  const [season, setSeason] = useState<ActiveSeasonResponse["season"]>(null);
  const [stats, setStats] = useState<SeasonStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("Saison hiver");
  const [newStart, setNewStart] = useState(todayISO());
  const [newBaseC, setNewBaseC] = useState("18");

  const [closeEnd, setCloseEnd] = useState(todayISO());

  const [readingDate, setReadingDate] = useState(todayISO());
  const [readingKg, setReadingKg] = useState("");
  const [readingBags, setReadingBags] = useState("2");
  const [readingBagKg, setReadingBagKg] = useState("15");
  const [readingNote, setReadingNote] = useState("");

  const [updateDate, setUpdateDate] = useState(todayISO());
  const [updateKg, setUpdateKg] = useState("");
  const [updateBags, setUpdateBags] = useState("");
  const [updateBagKg, setUpdateBagKg] = useState("15");
  const [updateNote, setUpdateNote] = useState("");

  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState(todayISO());
  const [editBaseC, setEditBaseC] = useState("18");

  const [deleteDate, setDeleteDate] = useState(todayISO());

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const s = await api.get<ActiveSeasonResponse>("/season/active");
      setSeason(s.data.season);

      if (s.data.season) {
        const st = await api.get<SeasonStatsResponse>(`/season/${s.data.season.id}/stats`);
        setStats(st.data);
        setEditName(s.data.season.name);
        setEditStart(new Date(s.data.season.startDate).toISOString().slice(0, 10));
        setEditBaseC(String(s.data.season.baseC));
      } else {
        setStats(null);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submitCreateSeason() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const baseC = Number(newBaseC);
      if (!newName.trim()) throw new Error("Nom requis");
      if (!Number.isFinite(baseC) || baseC <= 0) throw new Error("Base °C invalide");

      await api.post("/season", {
        name: newName.trim(),
        start: newStart,
        baseC,
      });

      setMessage("✅ Saison créée");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitCloseSeason() {
    if (!season) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await api.post(`/season/${season.id}/close`, { end: closeEnd });
      setMessage("✅ Saison clôturée");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdateSeason() {
    if (!season) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const baseC = Number(editBaseC);
      if (!editName.trim()) throw new Error("Nom requis");
      if (!Number.isFinite(baseC) || baseC <= 0) throw new Error("Base °C invalide");

      await api.patch(`/season/${season.id}`, {
        name: editName.trim(),
        start: editStart,
        baseC,
      });

      setMessage("✅ Saison mise à jour");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  function buildReadingPayload(kgValue: string, bagsValue: string, bagKgValue: string, noteValue: string) {
    const kg = kgValue.trim() ? Number(kgValue) : null;
    const bags = bagsValue.trim() ? Number(bagsValue) : null;
    const bagKg = Number(bagKgValue);

    if (kg == null && bags == null) {
      throw new Error("Renseigne kg ou sacs");
    }

    const payload: {
      kg?: number;
      bags?: number;
      bagKg?: number;
      note?: string;
    } = {};

    if (kg != null && Number.isFinite(kg) && kg > 0) {
      payload.kg = kg;
    } else if (bags != null && Number.isFinite(bags) && bags > 0) {
      payload.bags = bags;
      if (!Number.isFinite(bagKg) || bagKg <= 0) throw new Error("kg/sac invalide");
      payload.bagKg = bagKg;
    } else {
      throw new Error("Valeur invalide");
    }

    if (noteValue.trim()) payload.note = noteValue.trim();

    return payload;
  }

  async function submitCreateReading() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const payload = buildReadingPayload(readingKg, readingBags, readingBagKg, readingNote);

      await api.post("/pellets/daily", {
        date: readingDate,
        ...payload,
      });

      setMessage("✅ Relevé créé");
      setReadingNote("");
      setReadingKg("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdateReading() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const payload = buildReadingPayload(updateKg, updateBags, updateBagKg, updateNote);

      await api.patch(`/pellets/daily/${updateDate}`, payload);

      setMessage("✅ Relevé mis à jour");
      setUpdateNote("");
      setUpdateKg("");
      setUpdateBags("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitDeleteReading() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      await api.delete(`/pellets/daily/${deleteDate}`);
      setMessage("✅ Relevé supprimé");
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
          <IconSeason />
          Gestion des saisons
        </h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Crée une nouvelle saison, suis la saison active et clôture-la en fin de période.
        </p>
        {loading && <p>Chargement…</p>}
        {!loading && !season && <p>Aucune saison active.</p>}
        {season && (
          <div className="grid-two">
            <div>
              <strong>{season.name}</strong>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Début : {new Date(season.startDate).toISOString().slice(0, 10)}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Fin : {season.endDate ? new Date(season.endDate).toISOString().slice(0, 10) : "En cours"}
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>Base DJU : {season.baseC}°C</div>
            </div>
            {stats && (
              <div>
                <div style={{ fontSize: 14, opacity: 0.7 }}>Indicateurs</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.kgTotal.toFixed(1)} kg</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>DJU cumulés : {stats.djuTotal.toFixed(1)}</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  kg/DJU : {stats.kgPerDJU != null ? stats.kgPerDJU.toFixed(2) : "—"}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <section className="section-card">
        <h2 className="section-title">Créer une saison</h2>
        <div className="form-row">
          <label>Nom</label>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Début</label>
          <input className="input" type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Base °C</label>
          <input className="input" value={newBaseC} onChange={(e) => setNewBaseC(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={submitCreateSeason} disabled={busy}>
          Créer
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Clôturer la saison active</h2>
        <div className="form-row">
          <label>Fin</label>
          <input className="input" type="date" value={closeEnd} onChange={(e) => setCloseEnd(e.target.value)} />
        </div>
        <button className="btn" onClick={submitCloseSeason} disabled={!season || busy}>
          Clôturer
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Modifier la saison active</h2>
        <div className="form-row">
          <label>Nom</label>
          <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!season} />
        </div>
        <div className="form-row">
          <label>Début</label>
          <input
            className="input"
            type="date"
            value={editStart}
            onChange={(e) => setEditStart(e.target.value)}
            disabled={!season}
          />
        </div>
        <div className="form-row">
          <label>Base °C</label>
          <input className="input" value={editBaseC} onChange={(e) => setEditBaseC(e.target.value)} disabled={!season} />
        </div>
        <button className="btn" onClick={submitUpdateSeason} disabled={!season || busy}>
          Mettre à jour
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Créer un relevé</h2>
        <div className="grid-two">
          <div>
            <div className="form-row">
              <label>Date</label>
              <input className="input" type="date" value={readingDate} onChange={(e) => setReadingDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>kg</label>
              <input className="input" value={readingKg} onChange={(e) => setReadingKg(e.target.value)} placeholder="ex: 30" />
            </div>
            <div className="form-row">
              <label>ou sacs</label>
              <input className="input" value={readingBags} onChange={(e) => setReadingBags(e.target.value)} placeholder="ex: 2" />
            </div>
            <div className="form-row">
              <label>kg/sac</label>
              <input className="input" value={readingBagKg} onChange={(e) => setReadingBagKg(e.target.value)} placeholder="ex: 15" />
            </div>
            <div className="form-row">
              <label>Note</label>
              <input className="input" value={readingNote} onChange={(e) => setReadingNote(e.target.value)} placeholder="optionnel" />
            </div>
            <button className="btn btn-primary" onClick={submitCreateReading} disabled={busy}>
              Enregistrer
            </button>
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            <p style={{ marginTop: 0 }}>
              Un relevé correspond à une consommation journalière. Vous pouvez entrer soit la valeur en kg, soit
              le nombre de sacs (avec le poids d’un sac).
            </p>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2 className="section-title">Modifier un relevé</h2>
        <div className="grid-two">
          <div>
            <div className="form-row">
              <label>Date</label>
              <input className="input" type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label>kg</label>
              <input className="input" value={updateKg} onChange={(e) => setUpdateKg(e.target.value)} placeholder="ex: 28" />
            </div>
            <div className="form-row">
              <label>ou sacs</label>
              <input className="input" value={updateBags} onChange={(e) => setUpdateBags(e.target.value)} placeholder="ex: 2" />
            </div>
            <div className="form-row">
              <label>kg/sac</label>
              <input className="input" value={updateBagKg} onChange={(e) => setUpdateBagKg(e.target.value)} placeholder="ex: 15" />
            </div>
            <div className="form-row">
              <label>Note</label>
              <input className="input" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} placeholder="optionnel" />
            </div>
            <button className="btn" onClick={submitUpdateReading} disabled={busy}>
              Mettre à jour
            </button>
          </div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            <p style={{ marginTop: 0 }}>
              Pour modifier un relevé existant, choisissez la date puis mettez à jour au moins une valeur.
              Le relevé sera recalculé côté API.
            </p>
          </div>
        </div>
      </section>

      <section className="section-card">
        <h2 className="section-title">Supprimer un relevé</h2>
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={deleteDate} onChange={(e) => setDeleteDate(e.target.value)} />
        </div>
        <button className="btn" onClick={submitDeleteReading} disabled={busy}>
          Supprimer
        </button>
      </section>
    </div>
  );
}
