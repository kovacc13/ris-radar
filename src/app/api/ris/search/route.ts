import { NextRequest, NextResponse } from "next/server";
import { searchJudikatur, searchBundesrecht } from "@/lib/ris-client";

export const maxDuration = 30;
export const preferredRegion = "fra1"; // Frankfurt – nah an der AT RIS API

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const q = searchParams.get("q");
  const typ = searchParams.get("typ") ?? "judikatur"; // judikatur | bundesrecht
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const gericht = searchParams.get("gericht") ?? "OGH";
  const gesetz = searchParams.get("gesetz") ?? undefined;
  const paragraph = searchParams.get("paragraph") ?? undefined;

  if (!q && !gesetz && !paragraph) {
    return NextResponse.json(
      { error: "Bitte Suchbegriff, Gesetz oder Paragraph angeben." },
      { status: 400 }
    );
  }

  try {
    if (typ === "bundesrecht") {
      const result = await searchBundesrecht({ q: q ?? undefined, gesetz, paragraph, limit, page });
      return NextResponse.json(result);
    }

    // Default: Judikatur
    const result = await searchJudikatur({
      q: q ?? "",
      limit,
      page,
      dateFrom,
      dateTo,
      gericht,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("RIS Search Error:", err);
    return NextResponse.json(
      { error: "RIS API nicht erreichbar. Bitte später erneut versuchen." },
      { status: 502 }
    );
  }
}
