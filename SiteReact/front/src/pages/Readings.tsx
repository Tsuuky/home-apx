import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Modal from "../components/Modal";

type PelletReading = {
  date: string;
  kg: number;
  bags?: number | null;
  bagKg?: number | null;
  pricePerBag?: number | null;
  note?: string | null;
};

type WaterReading = {
  date: string;
  cubicM: number;
  pricePerM3?: number | null;
  note?: string | null;
};

type PelletResponse = {
  ok: boolean;
  rows: PelletReading[];
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

function lastYearRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 365);
  return { start: toISODate(start), end: toISODate(end) };
}

export default function Readings() {
  const [filter, setFilter] = useState<"all" | "wood" | "water">("all");
  const [pelletReadings, setPelletReadings] = useState<PelletReading[]>([]);
  const [waterReadings, setWaterReadings] = useState<WaterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editType, setEditType] = useState<"wood" | "water" | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editKg, setEditKg] = useState("");
  const [editBags, setEditBags] = useState("");
  const [editBagKg, setEditBagKg] = useState("15");
  const [editNote, setEditNote] = useState("");
  const [editCubicM, setEditCubicM] = useState("");
  const [editPricePerBag, setEditPricePerBag] = useState("");
  const [editPricePerM3, setEditPricePerM3] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const range = lastYearRange();
      const [pelletsRes, waterRes] = await Promise.all([
        api.get<PelletResponse>("/pellets/daily", { params: range }),
        api.get<WaterResponse>("/water/cold"),
      ]);
      setPelletReadings(pelletsRes.data.rows ?? []);
      setWaterReadings(waterRes.data.readings ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const combinedRows = useMemo(() => {
    const woodRows = pelletReadings.map((row) => ({
      type: "wood" as const,
      date: row.date,
      label: `${row.kg.toFixed(1)} kg${row.bags ? ` (${row.bags} sacs)` : ""}${row.pricePerBag ? ` • ${row.pricePerBag.toFixed(2)} € / sac` : ""}`,
      note: row.note ?? "",
      raw: row,
    }));
    const waterRows = waterReadings.map((row) => ({
      type: "water" as const,
      date: row.date,
      label: `${row.cubicM.toFixed(2)} m³${row.pricePerM3 ? ` • ${row.pricePerM3.toFixed(2)} € / m³` : ""}`,
      note: row.note ?? "",
      raw: row,
    }));
    const rows = [...woodRows, ...waterRows].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === "all") return rows;
    return rows.filter((row) => row.type === filter);
  }, [pelletReadings, waterReadings, filter]);

  function openEditWood(row: PelletReading) {
    setEditType("wood");
    setEditDate(row.date);
    setEditKg(String(row.kg ?? ""));
    setEditBags(row.bags != null ? String(row.bags) : "");
    setEditBagKg(row.bagKg != null ? String(row.bagKg) : "15");
    setEditPricePerBag(row.pricePerBag != null ? String(row.pricePerBag) : "");
    setEditNote(row.note ?? "");
  }

  function openEditWater(row: WaterReading) {
    setEditType("water");
    setEditDate(row.date);
    setEditCubicM(String(row.cubicM ?? ""));
    setEditPricePerM3(row.pricePerM3 != null ? String(row.pricePerM3) : "");
    setEditNote(row.note ?? "");
  }

  function closeModal() {
    setEditType(null);
    setEditDate("");
    setEditKg("");
    setEditBags("");
    setEditBagKg("15");
    setEditNote("");
    setEditCubicM("");
    setEditPricePerBag("");
    setEditPricePerM3("");
  }

  async function submitDelete(rowType: "wood" | "water", date: string) {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      if (rowType === "wood") {
        await api.delete(`/pellets/daily/${date}`);
      } else {
        await api.delete(`/water/cold/${date}`);
      }
      setMessage("✅ Relevé supprimé");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!editType) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      if (editType === "wood") {
        const kgValue = editKg.trim();
        const bagsValue = editBags.trim();
        const payload: { kg?: number; bags?: number; bagKg?: number; pricePerBag?: number; note?: string } = {};

        if (editNote.trim()) payload.note = editNote.trim();
        if (editPricePerBag.trim()) {
          const pricePerBag = Number(editPricePerBag);
          if (!Number.isFinite(pricePerBag) || pricePerBag < 0) throw new Error("Prix sac invalide");
          payload.pricePerBag = pricePerBag;
        }
        if (kgValue) {
          const kg = Number(kgValue);
          if (!Number.isFinite(kg) || kg <= 0) throw new Error("kg invalide");
          payload.kg = kg;
        } else if (bagsValue) {
          const bags = Number(bagsValue);
          const bagKg = Number(editBagKg);
          if (!Number.isFinite(bags) || bags <= 0) throw new Error("sacs invalides");
          if (!Number.isFinite(bagKg) || bagKg <= 0) throw new Error("kg/sac invalide");
          payload.bags = bags;
          payload.bagKg = bagKg;
        }

        if (Object.keys(payload).length === 0) {
          throw new Error("Renseigne kg, sacs, prix ou note");
        }

        await api.patch(`/pellets/daily/${editDate}`, payload);
      } else {
        const payload: { cubicM?: number; pricePerM3?: number; note?: string } = {};
        if (editCubicM.trim()) {
          const cubicM = Number(editCubicM);
          if (!Number.isFinite(cubicM) || cubicM < 0) throw new Error("m³ invalide");
          payload.cubicM = cubicM;
        }
        if (editPricePerM3.trim()) {
          const pricePerM3 = Number(editPricePerM3);
          if (!Number.isFinite(pricePerM3) || pricePerM3 < 0) throw new Error("Prix m³ invalide");
          payload.pricePerM3 = pricePerM3;
        }
        if (editNote.trim()) payload.note = editNote.trim();
        if (Object.keys(payload).length === 0) throw new Error("Renseigne une valeur");

        await api.patch(`/water/cold/${editDate}`, payload);
      }

      setMessage("✅ Relevé mis à jour");
      closeModal();
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
        <h1 className="section-title">Relèves</h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Liste des relevés eau froide et consommation bois. Filtrez par type puis modifiez ou supprimez.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => setFilter("all")}>
            Tous
          </button>
          <button className="btn" onClick={() => setFilter("wood")}>
            Conso bois
          </button>
          <button className="btn" onClick={() => setFilter("water")}>
            Eau froide
          </button>
        </div>
      </section>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <section className="section-card">
        <h2 className="section-title">Liste</h2>
        {loading ? (
          <p>Chargement…</p>
        ) : combinedRows.length === 0 ? (
          <p>Aucun relevé disponible.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Type</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Date</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Valeur</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Note</th>
                  <th style={{ textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedRows.map((row) => (
                  <tr key={`${row.type}-${row.date}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "8px" }}>{row.type === "wood" ? "Bois" : "Eau froide"}</td>
                    <td style={{ padding: "8px" }}>{row.date}</td>
                    <td style={{ padding: "8px" }}>{row.label}</td>
                    <td style={{ padding: "8px" }}>{row.note || "—"}</td>
                    <td style={{ padding: "8px", display: "flex", gap: 8 }}>
                      <button
                        className="btn"
                        onClick={() => (row.type === "wood" ? openEditWood(row.raw) : openEditWater(row.raw))}
                      >
                        Modifier
                      </button>
                      <button className="btn" onClick={() => submitDelete(row.type, row.date)} disabled={busy}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editType && (
        <Modal title="Modifier un relevé" onClose={closeModal}>
          <div className="form-row">
            <label>Date</label>
            <input className="input" value={editDate} disabled />
          </div>
          {editType === "wood" ? (
            <>
              <div className="form-row">
                <label>kg</label>
                <input className="input" value={editKg} onChange={(e) => setEditKg(e.target.value)} />
              </div>
              <div className="form-row">
                <label>ou sacs</label>
                <input className="input" value={editBags} onChange={(e) => setEditBags(e.target.value)} />
              </div>
              <div className="form-row">
                <label>kg/sac</label>
                <input className="input" value={editBagKg} onChange={(e) => setEditBagKg(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Prix sac (€)</label>
                <input className="input" value={editPricePerBag} onChange={(e) => setEditPricePerBag(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="form-row">
                <label>m³</label>
                <input className="input" value={editCubicM} onChange={(e) => setEditCubicM(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Prix m³ (€)</label>
                <input className="input" value={editPricePerM3} onChange={(e) => setEditPricePerM3(e.target.value)} />
              </div>
            </>
          )}
          <div className="form-row">
            <label>Note</label>
            <input className="input" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={submitEdit} disabled={busy}>
            Enregistrer
          </button>
        </Modal>
      )}
    </div>
  );
}
