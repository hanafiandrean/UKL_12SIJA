export async function GET() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return new Response("GEMINI_API_KEY missing", { status: 500 });
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1/models?key=" + key
    );
    return new Response(await r.text(), { headers: { "content-type": "application/json" } });
  }
  