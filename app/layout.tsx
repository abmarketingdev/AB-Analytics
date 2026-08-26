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
    <html lang="nb" data-density="comfortable">
      <body className={`${archivo.variable} ${plexMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
