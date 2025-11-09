// Next.js Route Handler – REST v1 (tanpa SDK)
export async function POST(req: Request) {
    try {
      const body = await req.json();
      const msgs: Array<{ role: "user" | "assistant" | "system"; content: string }> =
        body?.messages ?? [];
  
      const key = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest";
      if (!key) return new Response("GEMINI_API_KEY missing", { status: 500 });
  
      // bersihkan riwayat: buang 'system', lalu map ke format REST v1
      const conv = msgs.filter((m) => m.role !== "system");
      if (!conv.length || conv[conv.length - 1].role !== "user") {
        return new Response("Last message must be from 'user'", { status: 400 });
      }
  
      const contents = conv.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
  
      const url =
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
  
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents }),
      });
  
      if (!r.ok) {
        const errText = await r.text();
        return new Response(`Upstream ${r.status}: ${errText}`, { status: 502 });
      }
  
      const j = await r.json();
      const text =
        j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  
      return Response.json({ text });
    } catch (e: any) {
      return new Response(`Error: ${e?.message ?? e}`, { status: 500 });
    }
  }
  