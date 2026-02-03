import { useEffect, useState } from "react";
import { api } from "../services/api";
import { IconStock } from "../components/icons";

type StockCurrentResponse = {
  ok: boolean;
  kg: number;
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

export default function Stock() {
  const [currentKg, setCurrentKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [initialDate, setInitialDate] = useState(todayISO());
  const [initialKg, setInitialKg] = useState("");
  const [initialNote, setInitialNote] = useState("");

  const [deliveryDate, setDeliveryDate] = useState(todayISO());
  const [deliveryKg, setDeliveryKg] = useState("");
  const [deliveryBags, setDeliveryBags] = useState("");
  const [deliveryBagKg, setDeliveryBagKg] = useState("15");
  const [deliveryNote, setDeliveryNote] = useState("");

  const [adjustDate, setAdjustDate] = useState(todayISO());
  const [adjustTargetKg, setAdjustTargetKg] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const current = await api.get<StockCurrentResponse>("/stock/current");
      setCurrentKg(current.data.kg);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submitInitial() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const kg = Number(initialKg);
      if (!Number.isFinite(kg) || kg < 0) throw new Error("Valeur kg invalide");

      await api.post("/stock/initial", {
        date: initialDate,
        kg,
        note: initialNote || undefined,
      });

      setMessage("✅ Stock initial enregistré");
      setInitialKg("");
      setInitialNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitDelivery() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const kg = deliveryKg.trim() ? Number(deliveryKg) : null;
      const bags = deliveryBags.trim() ? Number(deliveryBags) : null;
      const bagKg = Number(deliveryBagKg);

      if (kg == null && bags == null) throw new Error("Renseigne kg ou sacs");

      const payload: {
        date: string;
        kg?: number;
        bags?: number;
        bagKg?: number;
        note?: string;
      } = { date: deliveryDate };

      if (kg != null && Number.isFinite(kg) && kg > 0) {
        payload.kg = kg;
      } else if (bags != null && Number.isFinite(bags) && bags > 0) {
        if (!Number.isFinite(bagKg) || bagKg <= 0) throw new Error("kg/sac invalide");
        payload.bags = bags;
        payload.bagKg = bagKg;
      } else {
        throw new Error("Valeur invalide");
      }

      if (deliveryNote.trim()) payload.note = deliveryNote.trim();

      await api.post("/stock/delivery", payload);

      setMessage("✅ Livraison enregistrée");
      setDeliveryKg("");
      setDeliveryBags("");
      setDeliveryNote("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdjust() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const targetKg = Number(adjustTargetKg);
      if (!Number.isFinite(targetKg) || targetKg < 0) throw new Error("Valeur kg invalide");

      await api.post("/stock/adjust", {
        date: adjustDate,
        targetKg,
        note: adjustNote || undefined,
      });

      setMessage("✅ Ajustement enregistré");
      setAdjustTargetKg("");
      setAdjustNote("");
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
          <IconStock />
          Gestion du stock
        </h1>
        <p style={{ marginTop: 0, opacity: 0.75 }}>
          Mets à jour le stock de granulés : stock initial, livraisons et corrections d’inventaire.
        </p>
        {loading && <p>Chargement…</p>}
        {!loading && (
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            Stock actuel : {currentKg != null ? `${currentKg.toFixed(0)} kg` : "—"}
          </div>
        )}
      </section>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <section className="section-card">
        <h2 className="section-title">Stock initial</h2>
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={initialDate} onChange={(e) => setInitialDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label>kg</label>
          <input className="input" value={initialKg} onChange={(e) => setInitialKg(e.target.value)} placeholder="ex: 500" />
        </div>
        <div className="form-row">
          <label>Note</label>
          <input className="input" value={initialNote} onChange={(e) => setInitialNote(e.target.value)} placeholder="optionnel" />
        </div>
        <button className="btn btn-primary" onClick={submitInitial} disabled={busy}>
          Enregistrer
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Livraison</h2>
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label>kg</label>
          <input className="input" value={deliveryKg} onChange={(e) => setDeliveryKg(e.target.value)} placeholder="ex: 900" />
        </div>
        <div className="form-row">
          <label>ou sacs</label>
          <input className="input" value={deliveryBags} onChange={(e) => setDeliveryBags(e.target.value)} placeholder="ex: 60" />
        </div>
        <div className="form-row">
          <label>kg/sac</label>
          <input className="input" value={deliveryBagKg} onChange={(e) => setDeliveryBagKg(e.target.value)} placeholder="15" />
        </div>
        <div className="form-row">
          <label>Note</label>
          <input className="input" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="optionnel" />
        </div>
        <button className="btn" onClick={submitDelivery} disabled={busy}>
          Ajouter
        </button>
      </section>

      <section className="section-card">
        <h2 className="section-title">Correction d’inventaire</h2>
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Stock réel (kg)</label>
          <input
            className="input"
            value={adjustTargetKg}
            onChange={(e) => setAdjustTargetKg(e.target.value)}
            placeholder="ex: 420"
          />
        </div>
        <div className="form-row">
          <label>Note</label>
          <input className="input" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="optionnel" />
        </div>
        <button className="btn" onClick={submitAdjust} disabled={busy}>
          Corriger
        </button>
      </section>
    </div>
  );
}
