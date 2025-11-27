"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  ReferenceArea, ReferenceLine
} from "recharts";

type Reading = { ts: number; t: string; temp: number; lux: number };
const CARD = "card p-5";

type Preset = { temp: number; lux: number; hys: number; note: string };

function recommendByAge(days: number): Preset {
  if (days <= 3) return { temp: 34, lux: 22, hys: 1.5, note: "Brooding 0-3 hari" };
  if (days <= 7) return { temp: 32, lux: 22, hys: 1.3, note: "Brooding 4-7 hari" };
  if (days <= 14) return { temp: 30, lux: 18, hys: 1.0, note: "Minggu 2" };
  if (days <= 21) return { temp: 28, lux: 15, hys: 0.8, note: "Minggu 3" };
  return { temp: 24, lux: 12, hys: 0.7, note: "Minggu 4+" };
}

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

  const [tempSet, setTempSet] = useState<number>(27);
  const [luxSet, setLuxSet] = useState<number>(15);
  const [hys, setHys] = useState<number>(0.7);
  const [ageDays, setAgeDays] = useState<number>(0);

  useEffect(() => {
    const ts = localStorage.getItem("tempSet");
    const ls = localStorage.getItem("luxSet");
    const hy = localStorage.getItem("hys");
    const ad = localStorage.getItem("ageDays");

    if (ts) setTempSet(Number(ts));
    if (ls) setLuxSet(Number(ls));
    if (hy) setHys(Number(hy));
    if (ad) setAgeDays(Number(ad));
  }, []);

  useEffect(() => localStorage.setItem("tempSet", String(tempSet)), [tempSet]);
  useEffect(() => localStorage.setItem("luxSet", String(luxSet)), [luxSet]);
  useEffect(() => localStorage.setItem("hys", String(hys)), [hys]);
  useEffect(() => localStorage.setItem("ageDays", String(ageDays)), [ageDays]);

  const applyPreset = () => {
    const p = recommendByAge(ageDays);
    setTempSet(p.temp);
    setLuxSet(p.lux);
    setHys(p.hys);
  };

  const fetchLatest = async () => {
    try {
      const res = await fetch("http://10.152.90.124:3000/api/sensor/latest");
      const data = await res.json();
      const now = Date.now();

      const reading: Reading = {
        ts: now,
        t: new Date(now).toLocaleTimeString(),
        temp: data.temperature,
        lux: data.lux,
      };

      setRows(prev => [...prev.slice(-119), reading]);
    } catch (err) {
      console.warn("Fetch error:", err);
    }
  };

  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(fetchLatest, 2000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const last = rows[rows.length - 1] || null;
  const data = useMemo(() => rows.map(r => ({ t: r.t, Temp: r.temp, Lux: r.lux })), [rows]);

  const sparkTemp = rows.slice(-30).map(r => ({ x: r.t, y: r.temp }));
  const sparkLux = rows.slice(-30).map(r => ({ x: r.t, y: r.lux }));

  const tempDev = last ? last.temp - tempSet : 0;
  const luxDev = last ? last.lux - luxSet : 0;
  const slope = (arr: number[], k = 10) =>
    (arr.length > k ? arr[arr.length - 1] - arr[arr.length - 1 - k] : 0);

  const tempSlope = slope(rows.map(r => r.temp));
  const luxSlope = slope(rows.map(r => r.lux));

  const domainMin = Math.floor(Math.min(...rows.map(r => Math.min(r.temp, tempSet - hys))) - 1 || 0);
  const domainMax = Math.ceil(Math.max(...rows.map(r => Math.max(r.temp, tempSet + hys))) + 1 || 30);

  const badge = (dev: number, s: number) =>
    dev > hys || s > 0.6 ? { label: "Alert", cls: "badge-danger" }
      : Math.abs(dev) > hys / 2 || Math.abs(s) > 0.3 ? { label: "Warn", cls: "badge-warn" }
        : { label: "OK", cls: "badge-ok" };

  const bTemp = badge(tempDev, tempSlope);
  const bLux = badge(luxDev, luxSlope);

  return (
    <main className="grid gap-6">

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className={CARD}>
          <div className="text-sm flex items-center justify-between" style={{ color: "var(--muted)" }}>
            <span>Temp</span><span className={`badge ${bTemp.cls}`}>{bTemp.label}</span>
          </div>
          <div className="text-3xl font-semibold">{last ? `${last.temp.toFixed(2)} °C` : "-"}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Target: {tempSet.toFixed(1)} ± {hys.toFixed(1)} °C</div>
          <Spark data={sparkTemp} color="var(--accent)" />
        </div>

        <div className={CARD}>
          <div className="text-sm flex items-center justify-between" style={{ color: "var(--muted)" }}>
            <span>Lux</span><span className={`badge ${bLux.cls}`}>{bLux.label}</span>
          </div>
          <div className="text-3xl font-semibold">{last ? `${last.lux.toFixed(0)} lx` : "-"}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Target: {luxSet.toFixed(0)} lx</div>
          <Spark data={sparkLux} color="var(--accent-2)" />

        </div>

        <div className={CARD}>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Samples</div>
          <div className="text-3xl font-semibold">{rows.length}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Simpan 120 terakhir</div>
        </div>

        <div className={CARD}>
          <div className="text-sm" style={{ color: "var(--muted)" }}>Status</div>
          <div className="text-3xl font-semibold">{running ? "Running" : "Paused"}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Live ESP32</div>
        </div>
      </section>

      <section className={CARD}>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 16, right: 16, top: 12, bottom: 12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: "var(--muted)" }} />
              <YAxis domain={[domainMin, domainMax]} tick={{ fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--fg)" }} labelStyle={{ color: "var(--muted)" }} />
              <ReferenceArea y1={tempSet - hys} y2={tempSet + hys} fill="var(--accent)" fillOpacity={0.08} />
              <ReferenceLine y={luxSet} stroke="var(--accent-2)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="Temp" dot={false} stroke="var(--accent)" strokeWidth={2.2} />
              <Line type="monotone" dataKey="Lux" dot={false} stroke="var(--accent-2)" strokeWidth={2.2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className={CARD}>
          <div className="font-medium mb-2">Preset Umur (hari)</div>
          <div className="flex items-center gap-3">
            <input type="number" min={0}
              className="w-24 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
              value={ageDays}
              onChange={(e) => setAgeDays(parseInt(e.target.value || "0"))}
            />
            <button onClick={applyPreset} className="btn btn-primary">Apply</button>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Otomatis atur suhu/lux/hysteresis sesuai fase broiler.
          </p>
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Setpoint Suhu</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>{tempSet.toFixed(1)} °C</div>
          </div>
          <input className="range" type="range" min={18} max={35} step={0.1} value={tempSet}
            onChange={(e) => setTempSet(parseFloat(e.target.value))}
          />
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Setpoint Lux</div>
            <div className="text-sm" style={{ color: "var(--muted)" }}>{luxSet.toFixed(0)} lx</div>
          </div>
          <input className="range" type="range" min={5} max={40} step={1} value={luxSet}
            onChange={(e) => setLuxSet(parseFloat(e.target.value))}
          />
        </div>

        <div className={`${CARD} grid grid-cols-2 gap-3 content-start`}>
          <button onClick={() => setRunning(true)} disabled={running} className={`btn ${running ? "btn-ghost" : "btn-success"}`}>
            Start
          </button>
          <button onClick={() => setRunning(false)} disabled={!running} className={`btn ${running ? "btn-danger" : "btn-ghost"}`}>
            Stop
          </button>
        </div>
      </section>

    </main>
  );
}
