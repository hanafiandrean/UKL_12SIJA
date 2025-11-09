export async function GET() {
    return Response.json({
      modelEnv: process.env.GEMINI_MODEL || null,
      hasKey: !!process.env.GEMINI_API_KEY,
    });
  }
  