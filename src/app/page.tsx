"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ReferenceArea, ReferenceLine
} from "recharts";

type Reading = { ts: number; t: string; temp: number; lux: number };
const CARD = "card p-5";

/* ===== Preset setpoint berdasarkan umur ayam (hari) ===== */
type Preset = { temp: number; lux: number; hys: number; note: string };

function recommendByAge(days: number): Preset {
  if (days <= 3)  return { temp: 34, lux: 22, hys: 1.5, note: "Brooding 0–3 hari" };
  if (days <= 7)  return { temp: 32, lux: 22, hys: 1.3, note: "Brooding 4–7 hari" };
  if (days <= 14) return { temp: 30, lux: 18, hys: 1.0, note: "Minggu 2" };
  if (days <= 21) return { temp: 28, lux: 15, hys: 0.8, note: "Minggu 3" };
  return               { temp: 24, lux: 12, hys: 0.7, note: "Minggu 4+" }; // 22–24 nyaman; setpoint 24
}

/* ---- Sparkline mini untuk kartu ---- */
function Spark({ data, color }: { data: { x: string; y: number }[]; color: string }) {
  return (
    <div className="h-8 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
          <Line type="monotone" dataKey="y" dot={false} stroke={color} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Page() {
  const [rows, setRows] = useState<Reading[]>([]);
  const [running, setRunning] = useState(true);
  const timer = useRef<number | null>(null);

  // --- setpoint & hysteresis (persist) ---
  const [tempSet, setTempSet] = useState<number>(() => Number(localStorage.getItem("tempSet") ?? 27));
  const [luxSet,  setLuxSet ] = useState<number>(() => Number(localStorage.getItem("luxSet")  ?? 15));
  const [hys,     setHys    ] = useState<number>(() => Number(localStorage.getItem("hys")     ?? 0.7));
  useEffect(() => { localStorage.setItem("tempSet", String(tempSet)); }, [tempSet]);
  useEffect(() => { localStorage.setItem("luxSet",  String(luxSet));  }, [luxSet]);
  useEffect(() => { localStorage.setItem("hys",     String(hys));     }, [hys]);

  // --- umur (hari) + Apply preset ---
  const [ageDays, setAgeDays] = useState<number>(() => Number(localStorage.getItem("ageDays") ?? 0));
  useEffect(() => { localStorage.setItem("ageDays", String(ageDays)); }, [ageDays]);
  const applyPreset = () => {
    const p = recommendByAge(ageDays);
    setTempSet(p.temp);
    setLuxSet(p.lux);
    setHys(p.hys);
  };

  // --- generator simulasi ---
  const gen = (): Reading => {
    const now = Date.now();
    const tbase = 27 + Math.sin(now / 600000) * 2;
    const temp = Math.round((tbase + (Math.random() - 0.5) * 0.4) * 100) / 100;
    const lbase = 15 + Math.max(0, Math.sin(now / 500000) * 8);
    const lux  = Math.round((lbase + (Math.random() - 0.5) * 1.8) * 10) / 10;
    return { ts: now, t: new Date(now).toLocaleTimeString(), temp, lux };
  };

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => setRows(p => [...p.slice(-119), gen()]), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const last = rows[rows.length - 1] || null;
  const data = useMemo(() => rows.map(r => ({ t: r.t, Temp: r.temp, Lux: r.lux })), [rows]);
  const sparkTemp = rows.slice(-30).map(r => ({ x: r.t, y: r.temp }));
  const sparkLux  = rows.slice(-30).map(r => ({ x: r.t, y: r.lux  }));

  // deviasi & tren sederhana untuk badge
  const tempDev = last ? last.temp - tempSet : 0;
  const luxDev  = last ? last.lux  - luxSet  : 0;
  const slope = (arr: number[], k = 10) => (arr.length > k ? arr[arr.length - 1] - arr[arr.length - 1 - k] : 0);
  const tempSlope = slope(rows.map(r => r.temp));
  const luxSlope  = slope(rows.map(r => r.lux));

  const domainMin = Math.floor(Math.min(...rows.map(r => Math.min(r.temp, r.lux, tempSet - hys))) - 1 || 0);
  const domainMax = Math.ceil(Math.max(...rows.map(r => Math.max(r.temp, r.lux, tempSet + hys))) + 1 || 30);

  const badge = (dev: number, s: number) =>
    dev > hys || s > 0.6 ? { label: "Alert", cls: "badge-danger" }
    : Math.abs(dev) > hys / 2 || Math.abs(s) > 0.3 ? { label: "Warn", cls: "badge-warn" }
    : { label: "OK", cls: "badge-ok" };

  const bTemp = badge(tempDev, tempSlope);
  const bLux  = badge(luxDev,  luxSlope);

  return (
    <main className="grid gap-6">
      {/* KARTU */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className={CARD}>
          <div style={{ color: "var(--muted)" }} className="text-sm flex items-center justify-between">
            <span>Temp</span><span className={`badge ${bTemp.cls}`}>{bTemp.label}</span>
          </div>
          <div className="text-3xl font-semibold">{last ? `${last.temp.toFixed(2)} °C` : "-"}</div>
          <div style={{ color: "var(--muted)" }} className="text-xs mt-1">Target: {tempSet.toFixed(1)} ± {hys.toFixed(1)} °C</div>
          <Spark data={sparkTemp} color="var(--accent)" />
        </div>

        <div className={CARD}>
          <div style={{ color: "var(--muted)" }} className="text-sm flex items-center justify-between">
            <span>Lux</span><span className={`badge ${bLux.cls}`}>{bLux.label}</span>
          </div>
          <div className="text-3xl font-semibold">{last ? `${last.lux.toFixed(0)} lx` : "-"}</div>
          <div style={{ color: "var(--muted)" }} className="text-xs mt-1">Target: {luxSet.toFixed(0)} lx</div>
          <Spark data={sparkLux} color="var(--accent-2)" />
        </div>

        <div className={CARD}>
          <div style={{ color: "var(--muted)" }} className="text-sm">Samples</div>
          <div className="text-3xl font-semibold">{rows.length}</div>
          <div style={{ color: "var(--muted)" }} className="text-xs mt-1">Simpan 120 terakhir</div>
        </div>

        <div className={CARD}>
          <div style={{ color: "var(--muted)" }} className="text-sm">Status</div>
          <div className="text-3xl font-semibold">{running ? "Running" : "Paused"}</div>
          <div style={{ color: "var(--muted)" }} className="text-xs mt-1">Simulasi lokal</div>
        </div>
      </section>

      {/* CHART UTAMA */}
      <section className={CARD}>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 16, right: 16, top: 12, bottom: 12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: "var(--muted)" }} />
              <YAxis domain={[domainMin, domainMax]} tick={{ fill: "var(--muted)" }} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: `1px solid var(--border)`, color: "var(--fg)" }}
                labelStyle={{ color: "var(--muted)" }}
              />
              {/* Target band suhu */}
              <ReferenceArea y1={tempSet - hys} y2={tempSet + hys} fill="var(--accent)" fillOpacity={0.08} />
              {/* Garis target lux (indikatif) */}
              <ReferenceLine y={luxSet} stroke="var(--accent-2)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="Temp" dot={false} stroke="var(--accent)" strokeWidth={2.2} />
              <Line type="monotone" dataKey="Lux"  dot={false} stroke="var(--accent-2)" strokeWidth={2.2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* CONTROL PANEL (dengan preset umur) */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* PRESET BY AGE */}
        <div className={CARD}>
          <div className="font-medium mb-2">Preset Umur (hari)</div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              className="w-24 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
              value={ageDays}
              onChange={(e) => setAgeDays(parseInt(e.target.value || "0"))}
            />
            <button onClick={applyPreset} className="btn btn-primary">Apply</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {[0,3,7,14,21,28].map((d)=>(
              <button key={d} onClick={()=>{ setAgeDays(d); setTimeout(applyPreset, 0); }} className="btn btn-ghost">
                {d}d
              </button>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Otomatis atur suhu/lux/hysteresis sesuai fase broiler.
          </p>
        </div>

        {/* SETPOINT SUHU */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Setpoint Suhu</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>{tempSet.toFixed(1)} °C</div>
          </div>
          <input className="range" type="range" min={18} max={35} step={0.1}
            value={tempSet} onChange={(e)=>setTempSet(parseFloat(e.target.value))}/>
          <div className="mt-3">
            <div className="text-sm mb-1" style={{ color: "var(--muted)" }}>Hysteresis</div>
            <input className="range" type="range" min={0.2} max={2} step={0.1}
              value={hys} onChange={(e)=>setHys(parseFloat(e.target.value))}/>
          </div>
        </div>

        {/* SETPOINT LUX */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Setpoint Lux</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>{luxSet.toFixed(0)} lx</div>
          </div>
          <input className="range" type="range" min={5} max={40} step={1}
            value={luxSet} onChange={(e)=>setLuxSet(parseFloat(e.target.value))}/>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            Brooding ±20–25 lx → pemeliharaan 8–15 lx.
          </p>
        </div>

        {/* RUN/STOP */}
        <div className={`${CARD} grid grid-cols-2 gap-3 content-start`}>
          <button
            onClick={() => setRunning(true)}
            disabled={running}
            className={`btn ${running ? "btn-ghost" : "btn-success hover:brightness-110"}`}
            aria-pressed={running}
          >
            {running ? "Running" : "Start"}
          </button>
          <button
            onClick={() => setRunning(false)}
            disabled={!running}
            className={`btn ${running ? "btn-danger hover:brightness-110" : "btn-ghost"}`}
            aria-pressed={!running}
          >
            Stop
          </button>
          <p className="col-span-2 text-xs" style={{ color: "var(--muted)" }}>
            Run/Stop hanya mengatur stream UI. Kontrol fisik disambung saat integrasi ESP32.
          </p>
        </div>
      </section>
    </main>
  );
}
