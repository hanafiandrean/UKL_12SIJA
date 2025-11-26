"use client";

import { useEffect, useState } from "react";

/* ===== tipe data settings ===== */
type TransportMode = "http" | "mqtt";
type Settings = {
  general: {
    farmName: string;
    ageDays: number;
    timezone: string;
  };
  sampling: {
    intervalSec: number;
    bufferSamples: number;
  };
  targets: {
    tempSet: number;
    hys: number;
    luxSet: number;
  };
  alerts: {
    enabled: boolean;
    tempHigh: number;
    tempLow: number;
    luxHigh: number;
    luxLow: number;
    holdSec: number;
    recoverySec: number;
    reNotifyMin: number;
    graceNormalSec: number;
    webhookUrl: string;
  };
  backend: {
    mode: TransportMode;
    httpUrl: string;
    deviceId: string;
    token: string;
    mqtt: {
      host: string;
      port: number;
      topic: string;
      username: string;
      password: string;
    };
  };
};

/* ===== defaults ===== */
const DEFAULTS: Settings = {
  general: { farmName: "Yam.io — Broiler", ageDays: 0, timezone: "Asia/Jakarta" },
  sampling: { intervalSec: 1, bufferSamples: 120 },
  targets: { tempSet: 27, hys: 0.7, luxSet: 15 },
  alerts: {
    enabled: true,
    tempHigh: 33,
    tempLow: 20,
    luxHigh: 30,
    luxLow: 5,
    holdSec: 120,
    recoverySec: 60,
    reNotifyMin: 30,
    graceNormalSec: 5,
    webhookUrl: ""
  },
  backend: {
    mode: "http",
    httpUrl: "/api/ingest",
    deviceId: "esp32-001",
    token: "",
    mqtt: { host: "", port: 1883, topic: "broiler/ingest", username: "", password: "" }
  }
};

/* ===== upgrade dari settings lama (abaikan field yang sudah dihapus) ===== */
function upgradeSettings(raw: any): Settings {
  const d = DEFAULTS;
  const s = (o: any) => (o && typeof o === "object" ? o : {});
  return {
    general: { ...d.general, ...s(raw?.general) },
    sampling:{ ...d.sampling, ...s(raw?.sampling) },
    targets: { ...d.targets,  ...s(raw?.targets) },
    alerts:  { ...d.alerts,   ...s(raw?.alerts) },
    backend: {
      ...d.backend,
      ...s(raw?.backend),
      mqtt: { ...d.backend.mqtt, ...s(raw?.backend?.mqtt) },
    },
  };
}

/* ===== helper localStorage state ===== */
function useLocal<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      const upgraded = key === "settings" ? (upgradeSettings(parsed) as T) : (parsed as T);
      localStorage.setItem(key, JSON.stringify(upgraded));
      return upgraded;
    } catch {
      return initial;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal] as const;
}

const CARD = "card p-5";
const Muted = { color: "var(--muted)" } as const;

/* ===== component ===== */
export default function SettingsPage() {
  const [s, setS] = useLocal<Settings>("settings", DEFAULTS);
  const [jsonBuf, setJsonBuf] = useState("");

  /* sink nilai inti untuk dashboard */
  useEffect(() => {
    localStorage.setItem("tempSet", String(s.targets.tempSet));
    localStorage.setItem("luxSet",  String(s.targets.luxSet));
    localStorage.setItem("hys",     String(s.targets.hys));
    localStorage.setItem("ageDays", String(s.general.ageDays));
  }, [s.targets.tempSet, s.targets.luxSet, s.targets.hys, s.general.ageDays]);

  /* binder generic */
  const onNum =
    <G extends keyof Settings, K extends keyof Settings[G]>(g: G, k: K) =>
    (e: any) =>
      setS({ ...s, [g]: { ...(s[g] as any), [k]: Number(e.target.value) } });
  const onTxt =
    <G extends keyof Settings, K extends keyof Settings[G]>(g: G, k: K) =>
    (e: any) =>
      setS({ ...s, [g]: { ...(s[g] as any), [k]: e.target.value } });
  const onBool =
    <G extends keyof Settings, K extends keyof Settings[G]>(g: G, k: K) =>
    (e: any) =>
      setS({ ...s, [g]: { ...(s[g] as any), [k]: e.target.checked } });

  /* export/import/reset */
  const resetDefaults = () => setS(DEFAULTS);
  const exportJSON = async () => {
    const text = JSON.stringify(s, null, 2);
    setJsonBuf(text);
    try { await navigator.clipboard.writeText(text); alert("Settings disalin ke clipboard."); } catch {}
  };
  const importJSON = () => {
    try { setS(upgradeSettings(JSON.parse(jsonBuf))); alert("Settings diimpor."); }
    catch { alert("JSON tidak valid."); }
  };

  return (
    <main className="grid gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* GENERAL + SAMPLING + TARGETS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={CARD}>
          <div className="font-medium mb-3">Umum</div>
          <label className="block text-sm" style={Muted}>Nama</label>
          <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 mb-2"
            value={s.general.farmName} onChange={onTxt("general","farmName")} />
          <label className="block text-sm" style={Muted}>Umur ayam (hari)</label>
          <input type="number" min={0}
            className="w-32 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
            value={s.general.ageDays} onChange={onNum("general","ageDays")} />
          <div className="mt-3">
            <label className="block text-sm" style={Muted}>Timezone</label>
            <input className="w-48 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
              value={s.general.timezone} onChange={onTxt("general","timezone")} />
          </div>
        </div>

        <div className={CARD}>
          <div className="font-medium mb-3">Sampling & Retensi</div>
          <label className="block text-sm" style={Muted}>Interval sampling (detik)</label>
          <input type="number" min={1}
            className="w-32 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 mb-2"
            value={s.sampling.intervalSec} onChange={onNum("sampling","intervalSec")} />
          <label className="block text-sm" style={Muted}>Buffer grafik (samples)</label>
          <input type="number" min={30}
            className="w-32 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
            value={s.sampling.bufferSamples} onChange={onNum("sampling","bufferSamples")} />
          <p className="text-xs mt-2" style={Muted}>120 sample ≈ 2 menit @1 Hz.</p>
        </div>

        <div className={CARD}>
          <div className="font-medium mb-3">Target</div>
          <div className="flex items-center justify-between">
            <span>Temp setpoint</span><span>{s.targets.tempSet.toFixed(1)} °C</span>
          </div>
          <input className="range" type="range" min={18} max={35} step={0.1}
            value={s.targets.tempSet} onChange={onNum("targets","tempSet")} />
          <div className="mt-3 flex items-center justify-between">
            <span>Hysteresis (±)</span><span>{s.targets.hys.toFixed(1)} °C</span>
          </div>
          <input className="range" type="range" min={0.2} max={2} step={0.1}
            value={s.targets.hys} onChange={onNum("targets","hys")} />
          <div className="mt-3 flex items-center justify-between">
            <span>Lux setpoint</span><span>{s.targets.luxSet.toFixed(0)} lx</span>
          </div>
          <input className="range" type="range" min={5} max={40} step={1}
            value={s.targets.luxSet} onChange={onNum("targets","luxSet")} />
        </div>
      </section>

      {/* ALERTS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className={CARD}>
          <div className="font-medium mb-3">Alarm & Notifikasi</div>
          <label className="inline-flex items-center gap-2 mb-2">
            <input type="checkbox" checked={s.alerts.enabled} onChange={onBool("alerts","enabled")} />
            <span>Aktifkan alarm</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm" style={Muted}>Temp tinggi (°C)</label>
              <input type="number" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.tempHigh} onChange={onNum("alerts","tempHigh")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Temp rendah (°C)</label>
              <input type="number" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.tempLow} onChange={onNum("alerts","tempLow")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Lux tinggi</label>
              <input type="number" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.luxHigh} onChange={onNum("alerts","luxHigh")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Lux rendah</label>
              <input type="number" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.luxLow} onChange={onNum("alerts","luxLow")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Hold (detik)</label>
              <input type="number" min={0}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.holdSec} onChange={onNum("alerts","holdSec")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Recovery (detik)</label>
              <input type="number" min={0}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.recoverySec} onChange={onNum("alerts","recoverySec")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Re-notify (menit)</label>
              <input type="number" min={0}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.reNotifyMin} onChange={onNum("alerts","reNotifyMin")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Grace normal (detik)</label>
              <input type="number" min={0}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.alerts.graceNormalSec} onChange={onNum("alerts","graceNormalSec")} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm" style={Muted}>Webhook URL</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                placeholder="https://example.com/hook"
                value={s.alerts.webhookUrl} onChange={onTxt("alerts","webhookUrl")} />
            </div>
          </div>
        </div>

        {/* BACKEND / TRANSPORT */}
        <div className={CARD}>
          <div className="font-medium mb-3">Backend / Transport</div>
          <div className="mb-2">
            <button className={`btn ${s.backend.mode==="http"?"btn-primary":"btn-ghost"} mr-2`}
              onClick={()=>setS({...s, backend:{...s.backend, mode:"http"}})}>HTTP</button>
            <button className={`btn ${s.backend.mode==="mqtt"?"btn-primary":"btn-ghost"}`}
              onClick={()=>setS({...s, backend:{...s.backend, mode:"mqtt"}})}>MQTT</button>
          </div>

          {s.backend.mode === "http" ? (
            <div className="grid gap-2">
              <label className="text-sm" style={Muted}>Endpoint URL</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.backend.httpUrl} onChange={onTxt("backend","httpUrl")} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm" style={Muted}>Host</label>
                <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                  value={s.backend.mqtt.host}
                  onChange={(e)=>setS({...s, backend:{...s.backend, mqtt:{...s.backend.mqtt, host:e.target.value}}})}/>
              </div>
              <div>
                <label className="text-sm" style={Muted}>Port</label>
                <input type="number" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                  value={s.backend.mqtt.port}
                  onChange={(e)=>setS({...s, backend:{...s.backend, mqtt:{...s.backend.mqtt, port:Number(e.target.value)}}})}/>
              </div>
              <div className="col-span-2">
                <label className="text-sm" style={Muted}>Topic</label>
                <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                  value={s.backend.mqtt.topic}
                  onChange={(e)=>setS({...s, backend:{...s.backend, mqtt:{...s.backend.mqtt, topic:e.target.value}}})}/>
              </div>
              <div>
                <label className="text-sm" style={Muted}>Username</label>
                <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                  value={s.backend.mqtt.username}
                  onChange={(e)=>setS({...s, backend:{...s.backend, mqtt:{...s.backend.mqtt, username:e.target.value}}})}/>
              </div>
              <div>
                <label className="text-sm" style={Muted}>Password</label>
                <input type="password" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                  value={s.backend.mqtt.password}
                  onChange={(e)=>setS({...s, backend:{...s.backend, mqtt:{...s.backend.mqtt, password:e.target.value}}})}/>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-sm" style={Muted}>Device ID</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.backend.deviceId} onChange={onTxt("backend","deviceId")} />
            </div>
            <div>
              <label className="text-sm" style={Muted}>Token</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.backend.token} onChange={onTxt("backend","token")} />
            </div>
          </div>
        </div>
      </section>

      {/* EXPORT / IMPORT / RESET */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className={CARD}>
          <div className="font-medium mb-2">Export / Import</div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={exportJSON}>Copy JSON</button>
            <button className="btn btn-ghost" onClick={importJSON}>Load JSON</button>
            <button className="btn btn-danger" onClick={resetDefaults}>Reset Default</button>
          </div>
          <textarea
            className="mt-3 w-full h-40 rounded-md border border-[var(--border)] bg-transparent p-2 text-sm"
            placeholder="Paste JSON di sini untuk import…"
            value={jsonBuf}
            onChange={(e)=>setJsonBuf(e.target.value)}
          />
        </div>
      </section>
    </main>
  );
}
