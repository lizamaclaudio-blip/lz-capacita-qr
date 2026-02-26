import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LZ Capacita QR",
    template: "%s · LZ Capacita QR",
  },
  description: "Trazabilidad ejecutiva para capacitaciones: QR, firma digital y PDF final.",
  applicationName: "LZ Capacita QR",
  icons: {
    icon: [{ url: "/brand/lzq-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/lzq-mark.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0B0F" },
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${space.variable}`}>
      <body suppressHydrationWarning className="min-h-screen antialiased">
        {/* Fondo executive (blobs neutros) */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>

        {children}
      </body>
    </html>
  );
}
