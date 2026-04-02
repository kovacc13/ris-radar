import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const preferredRegion = "fra1"; // Frankfurt – nah an der AT RIS API

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

    // HTML bereinigen – nur den Text-Inhalt extrahieren
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

    // Anthropic Claude API für KI-Analyse
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "KI-Integration nicht konfiguriert (ANTHROPIC_API_KEY fehlt)." },
        { status: 500 }
      );
    }

    const completion = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `Du bist ein österreichischer Rechtsexperte. Heutiges Datum: ${new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "long", year: "numeric" })}.

WICHTIG zur zeitlichen Einordnung:
- Prüfe ob genannte Inkrafttreten-Daten, Fristen oder Stichtage bereits in der Vergangenheit liegen.
- Wenn ein Gesetz/eine Verordnung bereits in Kraft getreten ist, sage klar: "Dieses Gesetz ist seit [Datum] in Kraft und gilt BEREITS."
- Wenn Übergangsfristen abgelaufen sind, weise darauf hin dass sofortiger Handlungsbedarf besteht.
- Verwende NIE Formulierungen wie "gibt Ihnen noch Zeit" wenn das Datum bereits vergangen ist.

Analysiere das folgende Dokument (Urteil, Gesetz, Verordnung oder Erlass) und beantworte die Frage des Nutzers präzise und verständlich auf Deutsch. Erkläre die praktischen Auswirkungen und Implikationen. Zitiere relevante Passagen wenn hilfreich. Halte die Antwort strukturiert mit Markdown-Formatierung (Überschriften, Listen, Fettdruck).`,
        messages: [
          {
            role: "user",
            content: `Urteilstext:\n\n${textContent}\n\n---\n\nFrage: ${body.question.trim()}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!completion.ok) {
      const errBody = await completion.text();
      console.error("Anthropic API Error:", completion.status, errBody);
      throw new Error(`Anthropic API Fehler: ${completion.status}`);
    }

    const result = (await completion.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const summary = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n\n") || "Keine Antwort erhalten.";

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Analyze Error:", err);
    return NextResponse.json(
      { error: "Analyse fehlgeschlagen. Bitte erneut versuchen." },
      { status: 502 }
    );
  }
}
