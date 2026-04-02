import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json() as { url?: string; question?: string };

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Fehlende oder ungültige URL." }, { status: 400 });
  }
  if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
    return NextResponse.json({ error: "Bitte stellen Sie eine Frage." }, { status: 400 });
  }

  // Volltext aus dem RIS holen (direkt, ohne Firecrawl)
  try {
    const risResponse = await fetch(body.url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    const html = await risResponse.text();

    // HTML grob bereinigen – nur den Text-Inhalt extrahieren
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40000);

    if (textContent.length < 100) {
      return NextResponse.json(
        { error: "Der Volltext konnte nicht abgerufen werden." },
        { status: 502 }
      );
    }

    // OpenAI-kompatible API für KI-Analyse
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    if (!apiKey) {
      return NextResponse.json(
        { error: "KI-Integration nicht konfiguriert (OPENAI_API_KEY fehlt)." },
        { status: 500 }
      );
    }

    const completion = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Du bist ein österreichischer Rechtsexperte. Analysiere den folgenden Urteilstext und beantworte die Frage des Nutzers präzise und verständlich auf Deutsch. Zitiere relevante Passagen wenn hilfreich. Halte die Antwort strukturiert und klar.",
          },
          {
            role: "user",
            content: `Urteilstext:\n\n${textContent}\n\n---\n\nFrage: ${body.question.trim()}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!completion.ok) {
      throw new Error(`OpenAI API Fehler: ${completion.status}`);
    }

    const result = (await completion.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const summary = result.choices[0]?.message?.content ?? "Keine Antwort erhalten.";

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Analyze Error:", err);
    return NextResponse.json(
      { error: "Analyse fehlgeschlagen. Bitte erneut versuchen." },
      { status: 502 }
    );
  }
}
