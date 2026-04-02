"use client";

import { useState } from "react";
import {
  Search, ChevronDown, ChevronUp, ExternalLink,
  Calendar, ShieldAlert, Sparkles, Loader2, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";

type RisResultItem = {
  gericht: string;
  gz: string;
  datum: string;
  normen: string;
  schlagworte: string;
  url: string;
};

type RisSearchResult = {
  total: number;
  results: RisResultItem[];
};

type AnalyzeState = {
  url: string;
  gericht: string;
  gz: string;
  question: string;
  loading: boolean;
  summary: string | null;
  error: string | null;
};

const QUICK_SEARCHES = ["Mietrecht", "WEG", "Kaufvertrag", "Gewährleistung", "Grundbuch", "§ 879 ABGB"];
const GERICHTE = ["OGH", "VwGH", "VfGH", "BVwG"] as const;

export default function RisSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [typ, setTyp] = useState<"judikatur" | "bundesrecht" | "bgbl" | "landesrecht">("judikatur");
  const [gericht, setGericht] = useState<string>("OGH");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState("20");
  const [page, setPage] = useState(1);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [data, setData] = useState<RisSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analyze, setAnalyze] = useState<AnalyzeState | null>(null);
  const [copied, setCopied] = useState(false);

  // Suche direkt mit übergebenen Parametern – keine Stale-Closure-Probleme
  const doSearch = async (overrides: {
    term?: string;
    pageNum?: number;
    searchTyp?: string;
    searchGericht?: string;
  } = {}) => {
    const term = overrides.term ?? activeSearch;
    const pageNum = overrides.pageNum ?? 1;
    const searchTypValue = overrides.searchTyp ?? typ;
    const searchGerichtValue = overrides.searchGericht ?? gericht;

    if (!term.trim()) return;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: term,
      typ: searchTypValue,
      limit,
      page: String(pageNum),
      gericht: searchGerichtValue,
    });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const res = await fetch(`/api/ris/search?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unbekannter Fehler");
        setData(null);
      } else {
        setData(json as RisSearchResult);
      }
    } catch {
      setError("Verbindungsfehler – bitte erneut versuchen.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchTerm.trim()) {
      setPage(1);
      setActiveSearch(searchTerm.trim());
      doSearch({ term: searchTerm.trim(), pageNum: 1, searchTyp: typ, searchGericht: gericht });
    }
  };

  const handleQuickSearch = (term: string) => {
    setSearchTerm(term);
    setPage(1);
    setActiveSearch(term);
    doSearch({ term, pageNum: 1 });
  };

  const handleTypChange = (newTyp: "judikatur" | "bundesrecht" | "bgbl" | "landesrecht") => {
    setTyp(newTyp);
    setPage(1);
    if (activeSearch) doSearch({ pageNum: 1, searchTyp: newTyp });
  };

  const handleGerichtChange = (newGericht: string) => {
    setGericht(newGericht);
    setPage(1);
    if (activeSearch) doSearch({ pageNum: 1, searchGericht: newGericht });
  };

  const handleNextPage = () => {
    const next = page + 1;
    setPage(next);
    doSearch({ pageNum: next });
  };

  const handleCopy = () => {
    if (!analyze?.summary) return;
    navigator.clipboard.writeText(analyze.summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const runAnalyze = async () => {
    if (!analyze || !analyze.question.trim()) return;
    setAnalyze((prev) => prev && { ...prev, loading: true, summary: null, error: null });

    try {
      const resp = await fetch("/api/ris/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: analyze.url, question: analyze.question.trim() }),
      });
      const json = (await resp.json()) as { summary?: string; error?: string };
      if (!resp.ok || json.error) {
        setAnalyze((prev) => prev && { ...prev, loading: false, error: json.error ?? "Unbekannter Fehler" });
      } else {
        setAnalyze((prev) => prev && { ...prev, loading: false, summary: json.summary ?? null });
      }
    } catch {
      setAnalyze((prev) => prev && { ...prev, loading: false, error: "Verbindungsfehler." });
    }
  };

  return (
    <>
      {/* Suchbereich */}
      <section className="bg-card rounded-lg shadow-sm border p-6 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="z.B. Mietrecht, § 879 ABGB oder Kaufvertrag Gewährleistung"
                className="pl-10 text-base py-5"
              />
            </div>
            <Button type="submit" size="lg" className="py-5 px-6">
              Suchen
            </Button>
          </div>

          {/* Typ-Auswahl */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">Suche in:</span>
            {([
              { key: "judikatur", label: "Urteile" },
              { key: "bundesrecht", label: "Bundesgesetze" },
              { key: "landesrecht", label: "Landesrecht" },
              { key: "bgbl", label: "BGBl" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTypChange(key)}
                className={`text-sm px-4 py-2 min-h-[44px] rounded-full border transition-all font-medium ${
                  typ === key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-accent hover:text-accent active:bg-accent/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Gerichts-Auswahl (nur bei Judikatur) */}
          {typ === "judikatur" && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">Gericht:</span>
              {GERICHTE.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleGerichtChange(g)}
                  className={`text-sm px-4 py-2 min-h-[44px] rounded-full border transition-all font-medium ${
                    gericht === g
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-accent hover:text-accent active:bg-accent/10"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {/* Schnellsuche */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground mr-1 hidden sm:inline">Schnellsuche:</span>
            {QUICK_SEARCHES.map((term) => (
              <Button
                key={term}
                variant="outline"
                size="sm"
                onClick={() => handleQuickSearch(term)}
                className="rounded-full text-xs min-h-[40px] px-3"
                type="button"
              >
                {term}
              </Button>
            ))}
          </div>

          {/* Erweiterte Filter */}
          <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen} className="border-t pt-3 mt-1">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary cursor-pointer">
              {isAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Erweiterte Filter
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/50 p-4 rounded-md border">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom" className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Datum von
                  </Label>
                  <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo" className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Datum bis
                  </Label>
                  <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit" className="text-sm font-medium">Ergebnisse pro Seite</Label>
                  <Select value={limit} onValueChange={(val) => { if (val) setLimit(val); }}>
                    <SelectTrigger id="limit">
                      <SelectValue placeholder="20" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 Ergebnisse</SelectItem>
                      <SelectItem value="50">50 Ergebnisse</SelectItem>
                      <SelectItem value="100">100 Ergebnisse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>
      </section>

      {/* Ergebnisse */}
      <section>
        {isLoading && (
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted rounded animate-pulse mb-6" />
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden border-l-4 border-l-muted">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border-l-4 border-destructive p-6 rounded-r-md flex items-start gap-4">
            <ShieldAlert className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-destructive mb-1 font-serif">Fehler bei der Suche</h3>
              <p className="text-destructive/90">{error}</p>
            </div>
          </div>
        )}

        {data && !isLoading && (
          <div>
            <div className="mb-6 flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-medium text-primary">
                <span className="font-bold">{data.total}</span> Treffer für{" "}
                <span className="italic">&lsquo;{activeSearch}&rsquo;</span>
                {typ !== "judikatur" && (
                  <Badge variant="outline" className="ml-2">
                    {typ === "bundesrecht" ? "Bundesgesetze" : typ === "landesrecht" ? "Landesrecht" : "BGBl"}
                  </Badge>
                )}
              </h2>
            </div>

            {data.results.length === 0 ? (
              <div className="text-center py-16 px-4 bg-muted/50 border rounded-lg border-dashed">
                <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-xl font-serif font-medium mb-2">Keine Ergebnisse</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Versuchen Sie andere Suchbegriffe oder Synonyme.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.results.map((result, index) => (
                  <Card
                    key={`${result.gz}-${index}`}
                    className="overflow-hidden border-l-4 border-l-accent hover:shadow-md transition-shadow group"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-serif font-bold text-primary mb-1 group-hover:text-accent transition-colors">
                            {result.gericht}
                          </h3>
                          <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {result.gz}
                          </code>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap bg-card border px-3 py-1 rounded-full">
                          <Calendar className="h-3.5 w-3.5 mr-1.5 text-accent" />
                          {result.datum}
                        </div>
                      </div>

                      {result.normen && (
                        <div className="mb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Normen</h4>
                          <p className="text-sm">{result.normen}</p>
                        </div>
                      )}

                      {result.schlagworte && result.schlagworte !== "-" && (
                        <div className="mb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Schlagworte</h4>
                          <div className="flex flex-wrap gap-1">
                            {result.schlagworte
                              .split(";")
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .slice(0, 8)
                              .map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => handleQuickSearch(tag)}
                                  className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-white transition-all cursor-pointer"
                                >
                                  {tag}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t flex flex-wrap justify-between items-center gap-3">
                        {result.url && (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-accent hover:text-primary transition-colors"
                          >
                            → Volltext im RIS
                            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                          </a>
                        )}
                        {result.url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex items-center gap-1.5 border-accent/40 text-accent hover:bg-accent hover:text-white transition-all"
                            onClick={() => setAnalyze({ url: result.url, gericht: result.gericht, gz: result.gz, question: "", loading: false, summary: null, error: null })}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Frage zum Dokument
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {data.total > data.results.length && (
                  <div className="flex justify-center pt-6 pb-2">
                    <Button variant="outline" onClick={handleNextPage}>
                      Weitere Ergebnisse laden
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* KI-Analyse Dialog */}
      <Dialog open={!!analyze} onOpenChange={(open) => { if (!open) setAnalyze(null); }}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-primary">
              <Sparkles className="h-5 w-5 text-accent" />
              Smarte Zusammenfassung
            </DialogTitle>
            <DialogDescription>
              {analyze?.gericht} – <code className="text-xs">{analyze?.gz}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="analyze-question" className="text-sm font-medium mb-2 block">
                Ihre Frage zum Dokument
              </Label>
              <Textarea
                id="analyze-question"
                placeholder="z.B. Was bedeutet das für mich? Welche Auswirkungen hat das? Was muss ich beachten?"
                value={analyze?.question ?? ""}
                onChange={(e) => setAnalyze((prev) => prev && { ...prev, question: e.target.value })}
                className="min-h-[80px] resize-none"
                disabled={analyze?.loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runAnalyze();
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">Strg+Enter zum Absenden</p>
            </div>

            <Button
              onClick={runAnalyze}
              disabled={!analyze?.question.trim() || analyze?.loading}
              className="w-full"
            >
              {analyze?.loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse läuft…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Zusammenfassung erstellen
                </>
              )}
            </Button>

            {analyze?.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 text-sm text-destructive">
                {analyze.error}
              </div>
            )}

            {analyze?.summary && (
              <div className="bg-muted/50 border rounded-md p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ergebnis</h4>
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2.5" onClick={handleCopy}>
                    {copied ? (
                      <><Check className="h-3.5 w-3.5 text-green-500 mr-1" /> Kopiert</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1" /> Kopieren</>
                    )}
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none text-foreground prose-headings:text-primary prose-headings:font-serif prose-strong:text-foreground prose-li:marker:text-accent">
                  <ReactMarkdown>{analyze.summary}</ReactMarkdown>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t mt-3">
                  KI-generierte Analyse – ersetzt keine Rechtsberatung.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
