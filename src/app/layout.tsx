import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Scale } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RIS Radar – Österreichische Rechtsrecherche",
  description:
    "Judikatur und Bundesrecht live durchsuchen – OGH, VwGH, VfGH, BVwG. Bereitgestellt von Dr. Christian Kovac.",
  openGraph: {
    title: "RIS Radar – Österreichische Rechtsrecherche",
    description: "Judikatur und Bundesrecht aus dem Rechtsinformationssystem des Bundes live durchsuchen.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Header */}
        <header className="bg-primary text-primary-foreground py-8 md:py-10 border-b-4 border-accent">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-center gap-3 mb-2">
              <Scale className="h-7 w-7 text-accent" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-serif">
                RIS Radar
              </h1>
            </div>
            <p className="text-primary-foreground/80 text-base max-w-2xl">
              Österreichisches Rechtsinformationssystem – Judikatur &amp; Bundesrecht live durchsuchen
            </p>
            <p className="text-primary-foreground/50 text-sm mt-2">
              Bereitgestellt von{" "}
              <em>Dr. Christian Kovac</em> – KI-Unternehmensberatung |{" "}
              <a
                href="https://christian-kovac.at"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                christian-kovac.at
              </a>
            </p>
          </div>
        </header>

        {/* Main */}
        <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-primary text-primary-foreground/60 py-6 text-center text-sm">
          <div className="container mx-auto px-4">
            <div className="mb-3 flex justify-center">
              <Scale className="h-5 w-5 text-primary-foreground/30" />
            </div>
            <p className="mb-1 text-primary-foreground/70">
              Quelle: RIS – Rechtsinformationssystem des Bundes | Lizenz: CC BY 4.0
            </p>
            <p>
              Bereitgestellt von <em>Dr. Christian Kovac</em> – KI-Unternehmensberatung |{" "}
              <a
                href="https://christian-kovac.at"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                christian-kovac.at
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
