import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

/** Archivo carries the UI chrome — a grotesque with signage lineage, not Inter.
 *  Plex Mono carries every number, ID and timestamp. "All data is mono" is
 *  itself the design statement. */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AB Analytics",
  description: "Kommandokonsoll for feltsalg — AB Marketing",
};

export const viewport: Viewport = {
  themeColor: "#0b0a10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* translate="no": Chrome was auto-translating the Norwegian into English
       and, worse, swapping text nodes underneath React, which is what throws
       "removeChild: the node to be removed is not a child of this node". The
       console is Norwegian for Norwegian users, so there is nothing to gain
       from translating it and a crash to lose. */
    <html lang="nb" translate="no" className="notranslate" data-density="comfortable">
      <head>
        {/* IBM Plex Sans powers the Kommandosenter (Claude Design port); the
            literal family name is needed because the port sets it inline. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      {/* Extensions write their own attributes onto <body> before React
          hydrates (ColorZilla adds cz-shortcut-listen, Bitdefender adds
          bis_register), which React reports as a mismatch. This covers this
          one element's attributes only, so a real mismatch anywhere inside
          still surfaces. */}
      <body suppressHydrationWarning className={`${archivo.variable} ${plexMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
