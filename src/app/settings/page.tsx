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
  /* PWM & aktuator 5V */
  control: {
    usePwm: boolean;
    invertLogic: boolean;
    fanPwmFreq: number;        // Hz
    fanStartBoostDuty: number; // 0..255
    fanStartBoostMs: number;   // ms
    fanMinDuty: number;        // 0..255 (min-run)
    fanRampPerSec: number;     // duty/s
    ledPwmFreq: number;        // Hz
    ledMinDuty: number;        // 0..255
    ledGamma: number;          // 1.0..3.0
  };
  /* strategi kontrol */
  strategy: {
    tempMode: "bangbang" | "proportional";
    kpTemp: number;            // °C -> duty
    kpLux: number;             // lx -> duty
    fanDutyMin: number;        // cap
    fanDutyMax: number;
    ledDutyMin: number;
    ledDutyMax: number;
  };
  sensor: {
    tempOffset: number;
    luxOffset: number;
    smoothWindowTemp: number;
    smoothWindowLux: number;
  };
  alerts: {
    enabled: boolean;
    tempHigh: number;
    tempLow: number;
    luxHigh: number;
    luxLow: number;
    holdSec: number;
    recoverySec: number;       // baru
    reNotifyMin: number;       // baru
    graceNormalSec: number;    // baru
    webhookUrl: string;
  };
  night: {
    enabled: boolean;
    start: string;             // "21:00"
    end: string;               // "05:00"
    luxTarget: number;
    fanMax: number;            // duty cap saat malam
  };
  quiet: {
    enabled: boolean;
    fanMax: number;            // duty cap mode sunyi
  };
  mains: {
    sense: "none" | "opto";    // deteksi PLN (untuk nanti)
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

function upgradeSettings(raw: any): Settings {
    const d = DEFAULTS;
    const s = (o: any) => (o && typeof o === "object" ? o : {});
  
    return {
      general: { ...d.general, ...s(raw?.general) },
      sampling:{ ...d.sampling, ...s(raw?.sampling) },
      targets: { ...d.targets,  ...s(raw?.targets) },
      control: { ...d.control,  ...s(raw?.control) },
      strategy:{ ...d.strategy, ...s(raw?.strategy) },          // <= penting: isi kalau kosong
      sensor:  { ...d.sensor,   ...s(raw?.sensor) },
      alerts:  { ...d.alerts,   ...s(raw?.alerts) },
      night:   { ...d.night,    ...s(raw?.night) },
      quiet:   { ...d.quiet,    ...s(raw?.quiet) },
      mains:   { ...d.mains,    ...s(raw?.mains) },
      backend: {
        ...d.backend,
        ...s(raw?.backend),
        mqtt: { ...d.backend.mqtt, ...s(raw?.backend?.mqtt) },
      },
    };
  }
  

/* ===== default values (5V ready) ===== */
const DEFAULTS: Settings = {
  general: { farmName: "Yam.io — Broiler", ageDays: 0, timezone: "Asia/Jakarta" },
  sampling: { intervalSec: 1, bufferSamples: 120 },
  targets: { tempSet: 27, hys: 0.7, luxSet: 15 },
  control: {
    usePwm: true,
    invertLogic: false,
    fanPwmFreq: 25000,     // 25 kHz: sunyi utk fan 5V kecil
    fanStartBoostDuty: 255,
    fanStartBoostMs: 200,
    fanMinDuty: 50,        // kalibrasi di tempat
    fanRampPerSec: 10,
    ledPwmFreq: 1800,      // hindari flicker kamera
    ledMinDuty: 10,
    ledGamma: 2.2
  },
  strategy: {
    tempMode: "bangbang",
    kpTemp: 20,            // deviasi 1°C ~ +20 duty
    kpLux: 5,              // deviasi 5 lx ~ +25 duty
    fanDutyMin: 50,
    fanDutyMax: 255,
    ledDutyMin: 10,
    ledDutyMax: 255
  },
  sensor: { tempOffset: 0, luxOffset: 0, smoothWindowTemp: 3, smoothWindowLux: 6 },
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
  night: { enabled: false, start: "21:00", end: "05:00", luxTarget: 8, fanMax: 160 },
  quiet: { enabled: false, fanMax: 160 },
  mains: { sense: "none" },
  backend: {
    mode: "http",
    httpUrl: "/api/ingest",
    deviceId: "esp32-001",
    token: "",
    mqtt: { host: "", port: 1883, topic: "broiler/ingest", username: "", password: "" }
  }
};

/* ===== helper localStorage state ===== */
function useLocal<T>(key: string, initial: T) {
    const [val, setVal] = useState<T>(() => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return initial;
        const parsed = JSON.parse(raw);
        const upgraded = key === "settings" ? (upgradeSettings(parsed) as T) : (parsed as T);
        // simpan balik hasil upgrade (supaya next render aman)
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

  /* sink agar dashboard ikut nilai inti */
  useEffect(() => {
    localStorage.setItem("tempSet", String(s.targets.tempSet));
    localStorage.setItem("luxSet", String(s.targets.luxSet));
    localStorage.setItem("hys", String(s.targets.hys));
    localStorage.setItem("ageDays", String(s.general.ageDays));
  }, [s.targets.tempSet, s.targets.luxSet, s.targets.hys, s.general.ageDays]);

  /* binder generic utk grup 1-level */
  const onNum =
    <G extends keyof Settings, K extends keyof Settings[G]>(g: G, k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setS({ ...s, [g]: { ...(s[g] as any), [k]: Number(e.target.value) } });
  const onTxt =
    <G extends keyof Settings, K extends keyof Settings[G]>(g: G, k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setS({ ...s, [g]: { ...(s[g] as any), [k]: e.target.value } });
  const onBool =
    <G extends keyof Settings, K extends keyof Settings[G]>(g: G, k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setS({ ...s, [g]: { ...(s[g] as any), [k]: e.target.checked } });

  /* binder utk select strategy */
  const setTempMode = (m: "bangbang" | "proportional") =>
    setS({ ...s, strategy: { ...s.strategy, tempMode: m } });

  /* export/import/reset */
  const resetDefaults = () => setS(DEFAULTS);
  const exportJSON = async () => {
    const text = JSON.stringify(s, null, 2);
    setJsonBuf(text);
    try { await navigator.clipboard.writeText(text); alert("Settings disalin ke clipboard."); } catch {}
  };
  const importJSON = () => {
    try { 
        const obj = JSON.parse(jsonBuf);
        setS(upgradeSettings(obj));
        alert("Settinf diimpor.");
    } catch { 
        alert("JSON tidak valid.");
    }
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

      {/* SENSOR & KALIBRASI */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={CARD}>
          <div className="font-medium mb-3">Sensor & Kalibrasi</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm" style={Muted}>Offset suhu (°C)</label>
              <input type="number" step={0.1}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.sensor.tempOffset} onChange={onNum("sensor","tempOffset")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Offset lux</label>
              <input type="number" step={0.1}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.sensor.luxOffset} onChange={onNum("sensor","luxOffset")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Smoothing suhu (N)</label>
              <input type="number" min={1} max={10}
                className="w-24 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.sensor.smoothWindowTemp} onChange={onNum("sensor","smoothWindowTemp")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Smoothing lux (N)</label>
              <input type="number" min={1} max={12}
                className="w-24 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.sensor.smoothWindowLux} onChange={onNum("sensor","smoothWindowLux")} />
            </div>
          </div>
          <p className="text-xs mt-2" style={Muted}>1 = tanpa smoothing; suhu 3–5, lux 5–8 disarankan.</p>
        </div>

        {/* AKTUATOR (PWM) */}
        <div className={CARD}>
          <div className="font-medium mb-3">Aktuator (PWM) — 5V</div>
          <label className="inline-flex items-center gap-2 mb-2">
            <input type="checkbox" checked={s.control.usePwm} onChange={onBool("control","usePwm")} />
            <span>Enable PWM</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm" style={Muted}>Fan freq (Hz)</label>
              <input type="number" className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.fanPwmFreq} onChange={onNum("control","fanPwmFreq")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Fan min-run duty</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.fanMinDuty} onChange={onNum("control","fanMinDuty")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Start-boost duty</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.fanStartBoostDuty} onChange={onNum("control","fanStartBoostDuty")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Start-boost ms</label>
              <input type="number" min={50} max={1000}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.fanStartBoostMs} onChange={onNum("control","fanStartBoostMs")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Fan ramp (duty/s)</label>
              <input type="number" min={0} max={60}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.fanRampPerSec} onChange={onNum("control","fanRampPerSec")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Invert logic</label>
              <input type="checkbox" className="align-middle ml-2"
                checked={s.control.invertLogic} onChange={onBool("control","invertLogic")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>LED freq (Hz)</label>
              <input type="number"
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.ledPwmFreq} onChange={onNum("control","ledPwmFreq")} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>LED min duty</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.ledMinDuty} onChange={onNum("control","ledMinDuty")} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm" style={Muted}>LED gamma</label>
              <input type="number" step={0.1} min={1} max={3}
                className="w-32 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.control.ledGamma} onChange={onNum("control","ledGamma")} />
            </div>
          </div>
        </div>

        {/* STRATEGI KONTROL */}
        <div className={CARD}>
          <div className="font-medium mb-3">Strategi Kontrol</div>
          <div className="mb-2">
            <span className="text-sm mr-2" style={Muted}>Mode suhu</span>
            <button className={`btn ${s.strategy.tempMode==="bangbang"?"btn-primary":"btn-ghost"} mr-2`}
              onClick={()=>setTempMode("bangbang")}>Bang-bang</button>
            <button className={`btn ${s.strategy.tempMode==="proportional"?"btn-primary":"btn-ghost"}`}
              onClick={()=>setTempMode("proportional")}>Proportional</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm" style={Muted}>Kp Temp (duty/°C)</label>
              <input type="number" min={0} max={80}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.strategy.kpTemp} onChange={(e)=>setS({...s, strategy:{...s.strategy, kpTemp:Number(e.target.value)}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Kp Lux (duty/lx)</label>
              <input type="number" min={0} max={20}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.strategy.kpLux} onChange={(e)=>setS({...s, strategy:{...s.strategy, kpLux:Number(e.target.value)}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Fan duty min</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.strategy.fanDutyMin} onChange={(e)=>setS({...s, strategy:{...s.strategy, fanDutyMin:Number(e.target.value)}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Fan duty max</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.strategy.fanDutyMax} onChange={(e)=>setS({...s, strategy:{...s.strategy, fanDutyMax:Number(e.target.value)}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>LED duty min</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.strategy.ledDutyMin} onChange={(e)=>setS({...s, strategy:{...s.strategy, ledDutyMin:Number(e.target.value)}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>LED duty max</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.strategy.ledDutyMax} onChange={(e)=>setS({...s, strategy:{...s.strategy, ledDutyMax:Number(e.target.value)}})} />
            </div>
          </div>
        </div>
      </section>

      {/* ALERTS + NIGHT/QUIET + MAINS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

        <div className={CARD}>
          <div className="font-medium mb-3">Night & Quiet Mode</div>
          <label className="inline-flex items-center gap-2 mb-2">
            <input type="checkbox" checked={s.night.enabled} onChange={(e)=>setS({...s, night:{...s.night, enabled:e.target.checked}})} />
            <span>Enable Night mode</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm" style={Muted}>Start</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.night.start} onChange={(e)=>setS({...s, night:{...s.night, start:e.target.value}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>End</label>
              <input className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.night.end} onChange={(e)=>setS({...s, night:{...s.night, end:e.target.value}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Lux target malam</label>
              <input type="number"
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.night.luxTarget} onChange={(e)=>setS({...s, night:{...s.night, luxTarget:Number(e.target.value)}})} />
            </div>
            <div>
              <label className="block text-sm" style={Muted}>Fan max malam</label>
              <input type="number" min={0} max={255}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
                value={s.night.fanMax} onChange={(e)=>setS({...s, night:{...s.night, fanMax:Number(e.target.value)}})} />
            </div>
          </div>

          <hr className="my-3 border-[var(--border)]" />

          <label className="inline-flex items-center gap-2 mb-2">
            <input type="checkbox" checked={s.quiet.enabled} onChange={(e)=>setS({...s, quiet:{...s.quiet, enabled:e.target.checked}})} />
            <span>Enable Quiet mode</span>
          </label>
          <div>
            <label className="block text-sm" style={Muted}>Fan max (quiet)</label>
            <input type="number" min={0} max={255}
              className="w-40 rounded-md border border-[var(--border)] bg-transparent px-2 py-1"
              value={s.quiet.fanMax} onChange={(e)=>setS({...s, quiet:{...s.quiet, fanMax:Number(e.target.value)}})} />
          </div>
        </div>

        <div className={CARD}>
          <div className="font-medium mb-3">Mains Sense</div>
          <div className="mb-2 text-sm" style={Muted}>Deteksi PLN (untuk PC817 nanti)</div>
          <div className="mb-3">
            <button className={`btn ${s.mains.sense==="none"?"btn-primary":"btn-ghost"} mr-2`}
              onClick={()=>setS({...s, mains:{ sense:"none" }})}>None</button>
            <button className={`btn ${s.mains.sense==="opto"?"btn-primary":"btn-ghost"}`}
              onClick={()=>setS({...s, mains:{ sense:"opto" }})}>Optocoupler</button>
          </div>

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
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
