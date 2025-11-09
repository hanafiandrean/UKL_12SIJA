"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya Yam.Io assistant. Tanyakan apa saja seputar setpoint suhu/lux, alarm, atau tuning kontrol.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    if (!input.trim() || sending) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            // optional: sisipkan system note ringan di depan percakapan
            { role: "system", content: "Keep answers short, actionable, and IoT-focused." },
            ...messages,
            userMsg,
          ],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { text: string };
      setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const Quick = ({ q }: { q: string }) => (
    <button
      className="btn btn-ghost text-sm"
      onClick={() => setInput((s) => (s ? s + "\n" + q : q))}
      title="Tambah ke input"
    >
      {q}
    </button>
  );

  return (
    <main className="grid gap-4">
      <section className="card p-4">
        <div className="flex flex-wrap gap-2">
          <Quick q="Rekomendasikan setpoint suhu & lux untuk umur 10 hari." />
          <Quick q="Kenapa barusan keluar alert panas? Kasih langkah mitigasi." />
          <Quick q="Bedanya mode bang-bang vs proportional," />
          <Quick q="Tolong review pengaturan PWM 5V saya agar kipas halus dan pasti start." />
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <div ref={listRef} className="max-h-[60vh] overflow-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`rounded-2xl px-4 py-2 max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-900/60 border border-neutral-800"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="text-sm text-neutral-400">{`Assistant is typing…`}</div>
          )}
          {error && <div className="text-sm text-rose-500">Error: {error}</div>}
        </div>

        <div className="border-t border-neutral-800 p-3">
          <div className="flex items-end gap-3">
            <textarea
              className="w-full rounded-xl border border-neutral-800 bg-transparent p-3 focus:outline-none"
              rows={2}
              placeholder="Tulis pertanyaan… (Enter = kirim, Shift+Enter = baris baru)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending}
              className={`btn ${sending ? "btn-ghost" : "btn-primary hover:brightness-110"}`}
              aria-pressed={sending}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
