"use client";

import { useState, useEffect } from "react";
import { Scale, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Beim Start prüfen ob schon eingeloggt (Session Cookie)
  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d: { ok: boolean }) => {
        setIsAuthed(d.ok);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setIsAuthed(true);
      } else {
        setError(data.error ?? "Falsches Passwort");
      }
    } catch {
      setError("Verbindungsfehler");
    } finally {
      setIsLoading(false);
    }
  };

  // Ladebildschirm
  if (isLoading && !isAuthed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary">
        <Loader2 className="h-8 w-8 text-accent animate-spin" />
      </div>
    );
  }

  // Eingeloggt → App zeigen
  if (isAuthed) {
    return <>{children}</>;
  }

  // Passwort-Screen – überdeckt das gesamte Layout
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary px-4">
      <div className="bg-card rounded-xl shadow-lg border p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-1 justify-center">
          <Scale className="h-6 w-6 text-accent" />
          <h1 className="text-xl font-bold font-serif text-primary">RIS Radar</h1>
        </div>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Zugang nur mit Passwort
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben"
              className="pl-10"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={!password.trim() || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Einloggen"
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          <em>Dr. Christian Kovac</em> – KI-Beratung |{" "}
          <a href="https://christian-kovac.at" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            christian-kovac.at
          </a>
        </p>
      </div>
    </div>
  );
}
