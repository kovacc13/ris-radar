// RIS API Client – Rechtsinformationssystem des Bundes
// Quelle: data.bka.gv.at/ris/api/v2.6 (OGD, CC BY 4.0)

const RIS_BASE = "https://data.bka.gv.at/ris/api/v2.6";

// Gemeinsame Headers für alle RIS-Requests
const RIS_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "User-Agent": "RIS-Radar/1.0 (https://ris-radar.vercel.app; Rechtsrecherche-Tool)",
};

// Robuster Fetch mit Retry-Logik
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(25000),
      });
      if (response.ok || attempt === retries) return response;
      console.warn(`[RIS] Attempt ${attempt} failed: HTTP ${response.status}, retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[RIS] Attempt ${attempt} error: ${err}, retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("Alle Retry-Versuche fehlgeschlagen");
}

export type RisResultItem = {
  gericht: string;
  gz: string;
  datum: string;
  normen: string;
  schlagworte: string;
  url: string;
};

export type RisSearchResult = {
  total: number;
  results: RisResultItem[];
};

export type RisSearchParams = {
  q: string;
  limit?: number;
  page?: number;
  dateFrom?: string;
  dateTo?: string;
  gericht?: string;
};

const LIMIT_MAP: Record<number, string> = {
  20: "Twenty",
  50: "Fifty",
  100: "OneHundred",
};

function normalizeOghItem(ref: Record<string, unknown>): RisResultItem {
  const data = (ref["Data"] as Record<string, unknown>) ?? {};
  const meta = (data["Metadaten"] as Record<string, unknown>) ?? {};
  const tech = (meta["Technisch"] as Record<string, unknown>) ?? {};
  const allg = (meta["Allgemein"] as Record<string, unknown>) ?? {};
  const jud = (meta["Judikatur"] as Record<string, unknown>) ?? {};

  let gz = jud["Geschaeftszahl"];
  if (typeof gz === "object" && gz !== null && !Array.isArray(gz)) {
    gz = (gz as Record<string, unknown>)["item"];
  }
  if (Array.isArray(gz)) gz = gz.slice(0, 3).join("; ");

  let normen = jud["Normen"];
  if (typeof normen === "object" && normen !== null && !Array.isArray(normen)) {
    normen = (normen as Record<string, unknown>)["item"];
  }
  if (Array.isArray(normen)) normen = normen.slice(0, 5).join(", ");

  let schlagworte = jud["Schlagworte"];
  if (typeof schlagworte === "object" && schlagworte !== null && !Array.isArray(schlagworte)) {
    schlagworte = (schlagworte as Record<string, unknown>)["item"];
  }
  if (Array.isArray(schlagworte)) schlagworte = schlagworte.join("; ");

  return {
    gericht: String(tech["Organ"] ?? "?"),
    gz: String(gz ?? "?").slice(0, 100),
    datum: String(jud["Entscheidungsdatum"] ?? "?"),
    normen: String(normen ?? "").slice(0, 150),
    schlagworte: String(schlagworte ?? ""),
    url: String(allg["DokumentUrl"] ?? ""),
  };
}

// Judikatur-Suche über RIS REST API (OGH, VwGH, VfGH, BVwG)
export async function searchJudikatur(params: RisSearchParams): Promise<RisSearchResult> {
  const { q, limit = 20, page = 1, dateFrom, dateTo, gericht = "OGH" } = params;

  // Alle Gerichte laufen über /Judikatur mit Applikation-Parameter
  const appMap: Record<string, string> = {
    OGH: "Justiz",
    VwGH: "Vwgh",
    VfGH: "Vfgh",
    BVwG: "Bvwg",
    LVwG: "Lvwg",
    DSK: "Dsk",
  };

  const applikation = appMap[gericht] ?? "Justiz";
  const docsPerPage = LIMIT_MAP[limit] ?? "Twenty";

  const searchParams = new URLSearchParams({
    Applikation: applikation,
    Suchworte: q,
    DokumenteProSeite: docsPerPage,
    Seitennummer: String(page),
  });

  if (dateFrom) {
    searchParams.set("EntscheidungsdatumVon", dateFrom);
  }
  if (dateTo) {
    searchParams.set("EntscheidungsdatumBis", dateTo);
  }

  const url = `${RIS_BASE}/Judikatur?${searchParams.toString()}`;

  console.log(`[RIS] Judikatur: ${url}`);

  const response = await fetchWithRetry(url, { headers: RIS_HEADERS });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[RIS] HTTP ${response.status}: ${body.slice(0, 500)}`);
    throw new Error(`RIS API Fehler: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const searchResult = (data["OgdSearchResult"] as Record<string, unknown>) ?? {};

  if ("Error" in searchResult) {
    return { total: 0, results: [] };
  }

  const docs = (searchResult["OgdDocumentResults"] as Record<string, unknown>) ?? {};
  const hits = (docs["Hits"] as Record<string, unknown>) ?? {};
  const total = parseInt(String(hits["#text"] ?? "0"), 10) || 0;

  let refs = docs["OgdDocumentReference"];
  if (!refs) refs = [];
  if (!Array.isArray(refs)) refs = [refs];

  const results = (refs as Record<string, unknown>[]).map(normalizeOghItem);

  return { total, results };
}

// Bundesrecht-Suche (ABGB, UGB, MRG, KSchG etc.)
export async function searchBundesrecht(params: {
  q?: string;
  gesetz?: string;
  paragraph?: string;
  limit?: number;
  page?: number;
}): Promise<RisSearchResult> {
  const { q, gesetz, paragraph, limit = 20, page = 1 } = params;
  const docsPerPage = LIMIT_MAP[limit] ?? "Twenty";

  const searchParams = new URLSearchParams({
    DokumenteProSeite: docsPerPage,
    Seitennummer: String(page),
  });

  if (q) searchParams.set("Suchworte", q);
  if (gesetz) searchParams.set("Titel", gesetz);
  if (paragraph) searchParams.set("Paragraf", paragraph);

  const url = `${RIS_BASE}/Bundesrecht?${searchParams.toString()}`;
  console.log(`[RIS] Bundesrecht: ${url}`);

  const response = await fetchWithRetry(url, { headers: RIS_HEADERS });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[RIS] HTTP ${response.status}: ${body.slice(0, 500)}`);
    throw new Error(`RIS API Fehler: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const searchResult = (data["OgdSearchResult"] as Record<string, unknown>) ?? {};

  if ("Error" in searchResult) {
    return { total: 0, results: [] };
  }

  const docs = (searchResult["OgdDocumentResults"] as Record<string, unknown>) ?? {};
  const hits = (docs["Hits"] as Record<string, unknown>) ?? {};
  const total = parseInt(String(hits["#text"] ?? "0"), 10) || 0;

  let refs = docs["OgdDocumentReference"];
  if (!refs) refs = [];
  if (!Array.isArray(refs)) refs = [refs];

  const results = (refs as Record<string, unknown>[]).map((ref) => {
    const r = ref as Record<string, unknown>;
    const d = (r["Data"] as Record<string, unknown>) ?? {};
    const meta = (d["Metadaten"] as Record<string, unknown>) ?? {};
    const allg = (meta["Allgemein"] as Record<string, unknown>) ?? {};
    const br = (meta["Bundesrecht"] as Record<string, unknown>) ?? {};
    const tech = (meta["Technisch"] as Record<string, unknown>) ?? {};

    let titel = br["Kurztitel"] ?? allg["Titel"] ?? "";
    if (typeof titel === "object" && titel !== null) {
      titel = (titel as Record<string, unknown>)["item"] ?? "";
    }

    let paragrafInfo = br["ArtikelParagraphAnlage"] ?? "";
    if (typeof paragrafInfo === "object" && paragrafInfo !== null) {
      paragrafInfo = (paragrafInfo as Record<string, unknown>)["item"] ?? "";
    }

    return {
      gericht: String(tech["Organ"] ?? "Bundesrecht"),
      gz: String(paragrafInfo || titel || "?").slice(0, 100),
      datum: String(br["Inkrafttretedatum"] ?? allg["Aenderungsdatum"] ?? "?"),
      normen: String(titel ?? ""),
      schlagworte: String(br["Beachte"] ?? ""),
      url: String(allg["DokumentUrl"] ?? ""),
    };
  });

  return { total, results };
}

// BGBl-Suche (Bundesgesetzblatt – neue/geänderte Gesetze)
export async function searchBgbl(params: {
  q?: string;
  limit?: number;
  page?: number;
}): Promise<RisSearchResult> {
  const { q, limit = 20, page = 1 } = params;
  const docsPerPage = LIMIT_MAP[limit] ?? "Twenty";

  const searchParams = new URLSearchParams({
    Applikation: "BgblAuth",
    DokumenteProSeite: docsPerPage,
    Seitennummer: String(page),
  });

  if (q) searchParams.set("Suchworte", q);

  const url = `${RIS_BASE}/Bundesrecht?${searchParams.toString()}`;
  console.log(`[RIS] BGBl: ${url}`);

  const response = await fetchWithRetry(url, { headers: RIS_HEADERS });
  if (!response.ok) throw new Error(`RIS API Fehler: ${response.status}`);

  const data = (await response.json()) as Record<string, unknown>;
  const searchResult = (data["OgdSearchResult"] as Record<string, unknown>) ?? {};
  if ("Error" in searchResult) return { total: 0, results: [] };

  const docs = (searchResult["OgdDocumentResults"] as Record<string, unknown>) ?? {};
  const hits = (docs["Hits"] as Record<string, unknown>) ?? {};
  const total = parseInt(String(hits["#text"] ?? "0"), 10) || 0;

  let refs = docs["OgdDocumentReference"];
  if (!refs) refs = [];
  if (!Array.isArray(refs)) refs = [refs];

  const results = (refs as Record<string, unknown>[]).map((ref) => {
    const r = ref as Record<string, unknown>;
    const d = (r["Data"] as Record<string, unknown>) ?? {};
    const meta = (d["Metadaten"] as Record<string, unknown>) ?? {};
    const allg = (meta["Allgemein"] as Record<string, unknown>) ?? {};
    const br = (meta["Bundesrecht"] as Record<string, unknown>) ?? {};
    const tech = (meta["Technisch"] as Record<string, unknown>) ?? {};

    let titel = br["Kurztitel"] ?? allg["Titel"] ?? "";
    if (typeof titel === "object" && titel !== null) titel = (titel as Record<string, unknown>)["item"] ?? "";

    return {
      gericht: String(tech["Organ"] ?? "BGBl"),
      gz: String(titel || "?").slice(0, 120),
      datum: String(br["Inkrafttretedatum"] ?? allg["Aenderungsdatum"] ?? "?"),
      normen: String(br["ArtikelParagraphAnlage"] ?? ""),
      schlagworte: "",
      url: String(allg["DokumentUrl"] ?? ""),
    };
  });

  return { total, results };
}

// Landesrecht-Suche (alle 9 Bundesländer)
export async function searchLandesrecht(params: {
  q?: string;
  limit?: number;
  page?: number;
}): Promise<RisSearchResult> {
  const { q, limit = 20, page = 1 } = params;
  const docsPerPage = LIMIT_MAP[limit] ?? "Twenty";

  const searchParams = new URLSearchParams({
    DokumenteProSeite: docsPerPage,
    Seitennummer: String(page),
  });

  if (q) searchParams.set("Suchworte", q);

  const url = `${RIS_BASE}/Landesrecht?${searchParams.toString()}`;
  console.log(`[RIS] Landesrecht: ${url}`);

  const response = await fetchWithRetry(url, { headers: RIS_HEADERS });
  if (!response.ok) throw new Error(`RIS API Fehler: ${response.status}`);

  const data = (await response.json()) as Record<string, unknown>;
  const searchResult = (data["OgdSearchResult"] as Record<string, unknown>) ?? {};
  if ("Error" in searchResult) return { total: 0, results: [] };

  const docs = (searchResult["OgdDocumentResults"] as Record<string, unknown>) ?? {};
  const hits = (docs["Hits"] as Record<string, unknown>) ?? {};
  const total = parseInt(String(hits["#text"] ?? "0"), 10) || 0;

  let refs = docs["OgdDocumentReference"];
  if (!refs) refs = [];
  if (!Array.isArray(refs)) refs = [refs];

  const results = (refs as Record<string, unknown>[]).map((ref) => {
    const r = ref as Record<string, unknown>;
    const d = (r["Data"] as Record<string, unknown>) ?? {};
    const meta = (d["Metadaten"] as Record<string, unknown>) ?? {};
    const allg = (meta["Allgemein"] as Record<string, unknown>) ?? {};
    const lr = (meta["Landesrecht"] as Record<string, unknown>) ?? {};
    const tech = (meta["Technisch"] as Record<string, unknown>) ?? {};

    let titel = lr["Kurztitel"] ?? allg["Titel"] ?? "";
    if (typeof titel === "object" && titel !== null) titel = (titel as Record<string, unknown>)["item"] ?? "";

    return {
      gericht: String(tech["Organ"] ?? "Landesrecht"),
      gz: String(titel || "?").slice(0, 120),
      datum: String(lr["Inkrafttretedatum"] ?? allg["Aenderungsdatum"] ?? "?"),
      normen: String(titel ?? ""),
      schlagworte: "",
      url: String(allg["DokumentUrl"] ?? ""),
    };
  });

  return { total, results };
}
