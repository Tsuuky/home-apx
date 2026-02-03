type OpenMeteoDailyResponse = {
  daily?: {
    time: string[];
    temperature_2m_mean?: number[];
  };
};

export async function fetchDailyMeanTemps(params: {
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  timezone: string;
}): Promise<Array<{ date: string; tmeanC: number }>> {
  const { lat, lon, startDate, endDate, timezone } = params;

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", "temperature_2m_mean");
  url.searchParams.set("timezone", timezone);

  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}: ${await res.text().catch(() => "")}`);

  const data = (await res.json()) as OpenMeteoDailyResponse;
  const times = data.daily?.time ?? [];
  const temps = data.daily?.temperature_2m_mean ?? [];

  const out: Array<{ date: string; tmeanC: number }> = [];
  for (let i = 0; i < times.length; i++) {
    const t = temps[i];
    if (typeof t === "number" && Number.isFinite(t)) out.push({ date: times[i], tmeanC: t });
  }
  return out;
}
