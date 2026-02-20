import type { Metadata } from "next";
import "./globals.css";

import RouteTransition from "@/components/RouteTransition";
import GreenBackground from "@/components/GreenBackground";

export const metadata: Metadata = {
  title: "Prevención QR",
  description: "Registro de asistencia con QR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <GreenBackground />
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}